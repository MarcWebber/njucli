import { z } from "zod";
import { load } from "cheerio";

import { AppError } from "../../core/errors.js";
import { requiredText } from "../../core/guards.js";
import type { FetchLike, FetchResponse } from "../../core/types.js";
import type { TexFile, TexProject, TexProjectPage } from "./types.js";

export const TEX_BASE_URL = "https://tex.nju.edu.cn";

const versionSchema = z.string().min(1);
const projectSchema = z.object({
  projectKey: z.string().min(1),
  projectName: z.string(),
  selectedVersion: z.object({
    versionNo: versionSchema,
  }),
});

const pageSchema = z.object({
  list: z.array(projectSchema),
  pinnedList: z.array(projectSchema),
  hasMore: z.boolean(),
});

const envelopeSchema = z.object({
  status: z.object({ code: z.number() }),
  result: z.unknown().optional(),
});

const filesSchema = z.array(z.object({
  fileKey: z.string().min(1),
  filePath: z.string(),
  isDir: z.boolean(),
  fileType: z.unknown().optional(),
}));

export class TexClient {
  constructor(private readonly fetch: FetchLike) {}

  async templates(page = 1): Promise<{ items: { key: string; name: string }[]; hasMore: boolean }> {
    const response = await texResponse(this.fetch, `/zh/template?page=${page}`, {
      headers: { accept: "text/html" },
    });
    const $ = load(await response.text());
    if ($("h1").text().trim() !== "LaTeX 模板") throw new Error("TeX 未返回模板目录页面");
    const items = $('a[href^="/zh/template/"]').has("h2").map((_, item) => ({
      key: $(item).attr("href")!.slice("/zh/template/".length),
      name: $(item).find("h2").text().trim(),
    })).get();
    return { items, hasMore: $(`a[href="/zh/template?page=${page + 1}"]`).length > 0 };
  }

  async projects(query?: string, page = 1): Promise<TexProjectPage> {
    const params = new URLSearchParams({
      page: String(page),
      projectName: query?.trim() ?? "",
      sortBy: "updateAt",
      getType: "all",
    });
    const result = pageSchema.parse(await texRequest(this.fetch, `/api/project?${params}`));
    const items = new Map<string, TexProject>();
    for (const row of [...result.list, ...result.pinnedList]) {
      const versionNo = row.selectedVersion.versionNo;
      if (!items.has(row.projectKey)) {
        items.set(row.projectKey, {
          projectKey: row.projectKey,
          name: row.projectName,
          versionNo,
          url: `${TEX_BASE_URL}/project/user/${encodeURIComponent(row.projectKey)}/${encodeURIComponent(versionNo)}`,
        });
      }
    }
    return { items: [...items.values()], hasMore: result.hasMore };
  }

  async create(nameInput: string): Promise<TexProject> {
    const name = requiredText(nameInput, "项目名称");
    const result = await texRequest(this.fetch, "/api/project", {
      method: "POST",
      body: JSON.stringify({ projectName: name }),
    });
    const { projectKey } = z.object({ projectKey: z.string().min(1) }).parse(result);
    return this.readback(projectKey, name);
  }

  async rename(projectKey: string, nameInput: string): Promise<TexProject> {
    const name = requiredText(nameInput, "项目名称");
    await texRequest(this.fetch, "/api/project/rename", {
      method: "PUT",
      body: JSON.stringify({ projectKey, projectName: name }),
    });
    return this.readback(projectKey, name);
  }

  async createFromTemplate(templateKey: string): Promise<TexProject> {
    const result = await texRequest(this.fetch, "/api/project/byTemplate", {
      method: "POST",
      body: JSON.stringify({ key: templateKey, isGuide: false }),
    });
    const created = z.object({
      projectKey: z.string().min(1),
      versionNo: versionSchema,
    }).parse(result);
    return this.readback(created.projectKey, undefined, created.versionNo);
  }

  async download(projectKey: string, versionNo: string): Promise<Uint8Array> {
    const params = new URLSearchParams({ projectKey, versionNo });
    const response = await texResponse(this.fetch, `/api/project/download?${params}`, {
      headers: { accept: "application/zip" },
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b ||
        !((bytes[2] === 3 && bytes[3] === 4) || (bytes[2] === 5 && bytes[3] === 6))) {
      throw new Error("TeX 未返回 ZIP 项目源码，未保存文件");
    }
    return bytes;
  }

  async compileResult(projectKey: string, versionNo: string): Promise<unknown> {
    return texRequest(this.fetch, `/api/project/compileResult/pdf?${new URLSearchParams({ projectKey, versionNo })}`);
  }

  async log(projectKey: string, versionNo: string): Promise<string> {
    return this.resultLog(await this.compileResult(projectKey, versionNo));
  }

  async pdf(projectKey: string, versionNo: string, result: unknown): Promise<Uint8Array> {
    const log = await this.resultLog(result);
    // TeXPage's log parser recognizes both ! errors and file:line errors.
    const errors = log.split(/\r?\n/).filter((line) =>
      /^(?!.*ignored error)(?:(.*):(\d+):|!)(?:\s?(.+) [Ee]rror:)? (.+?)$/.test(line) ||
      line === "No pages of output.");
    if (errors.length > 0) {
      throw new AppError("REMOTE_UNAVAILABLE", "TeX 编译失败，未下载旧 PDF", { details: { errors } });
    }
    z.object({ pdfUrl: z.string().min(1) }).parse(result);
    const params = new URLSearchParams({ projectKey, versionNo });
    const response = await texResponse(this.fetch, `/api/project/pdf/download?${params}`, {
      headers: { accept: "application/pdf" },
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") {
      throw new Error("TeX 未返回 PDF，请先编译项目");
    }
    return bytes;
  }

  private async resultLog(result: unknown): Promise<string> {
    const { logUrl } = z.object({ logUrl: z.url() }).parse(result);
    if (new URL(logUrl).origin !== "https://latex-file.texpageusercontent.com") {
      throw new Error("TeX 编译日志返回未确认的文件主机");
    }
    const response = await this.fetch(logUrl, { headers: { accept: "text/plain" } });
    if (!response.ok) throw new Error(`TeX 日志 HTTP ${response.status}`);
    if (response.headers.get("content-type")?.split(";")[0]?.trim() !== "text/plain") {
      throw new Error("TeX 未返回编译日志原文");
    }
    return response.text();
  }

  async files(projectKey: string, versionNo: string): Promise<TexFile[]> {
    return (await this.fileRows(projectKey, versionNo)).map((file) => ({
      fileKey: file.fileKey,
      path: file.filePath,
      isDir: file.isDir,
    }));
  }

  async verifyUpload(projectKey: string, versionNo: string, path: string, bytes: Uint8Array) {
    const file = (await this.files(projectKey, versionNo)).find((item) => item.path === path && !item.isDir);
    if (!file) throw new Error("TeX 上传已提交，但文件列表未读回目标；请查询状态，不要重复上传");
    const response = await this.fileResponse(projectKey, versionNo, file.fileKey);
    const saved = Buffer.from(await response.arrayBuffer());
    if (!saved.equals(bytes)) throw new Error("TeX 上传已提交，但远端文件与本地内容不一致；请查询状态，不要重复上传");
    return { fileKey: file.fileKey, path: file.path, bytes: saved.byteLength };
  }

  async read(projectKey: string, versionNo: string, fileKey: string): Promise<string> {
    const file = (await this.fileRows(projectKey, versionNo)).find((item) => item.fileKey === fileKey);
    if (!file) throw new AppError("NOT_FOUND", "项目中没有该文件");
    if (file.isDir || file.fileType !== "text/plain") {
      throw new AppError("INVALID_INPUT", "TeX read 只支持项目中的 text/plain 文件");
    }
    const response = await this.fileResponse(projectKey, versionNo, fileKey);
    const type = response.headers.get("content-type")?.split(";")[0]?.trim();
    if (type !== "application/octet-stream" && type !== "text/plain") {
      throw new Error("TeX 未返回项目文件，未读取正文");
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(await response.arrayBuffer());
  }

  private fileResponse(projectKey: string, versionNo: string, fileKey: string) {
    const params = new URLSearchParams({ projectKey, versionNo, fileKey });
    return texResponse(this.fetch, `/api/project/file?${params}`, {
      headers: { accept: "application/octet-stream" },
    });
  }

  private async fileRows(projectKey: string, versionNo: string) {
    const params = new URLSearchParams({ projectKey, versionNo });
    return filesSchema.parse(await texRequest(this.fetch, `/api/project/files?${params}`));
  }

  private async readback(projectKey: string, name?: string, versionNo?: string): Promise<TexProject> {
    const { items } = await this.projects(name);
    const project = items.find((item) => item.projectKey === projectKey &&
      (name === undefined || item.name === name) &&
      (versionNo === undefined || item.versionNo === versionNo));
    if (!project) {
      throw new Error("TeX 写请求已提交，但列表未读回对应项目；请查询状态，不要重复提交");
    }
    return project;
  }
}

export async function texRequest(fetch: FetchLike, path: string, init?: RequestInit): Promise<unknown> {
  const response = await texResponse(fetch, path, init);
  if (response.headers.get("content-type")?.includes("text/html")) {
    throw new AppError("USER_ACTION_REQUIRED", "TeX 返回浏览器验证页面，未取得接口数据");
  }
  return texResult(JSON.parse(await response.text()) as unknown);
}

export function texResult(value: unknown): unknown {
  const envelope = envelopeSchema.parse(value);
  const code = envelope.status.code;
  if (code === 1003) throw new AppError("AUTH_REQUIRED", "TeX 登录态失效", { authCommand: "njucli auth login tex" });
  if (code === 1010) throw new AppError("USER_ACTION_REQUIRED", "TeX 要求二次身份验证", { authCommand: "njucli auth login tex" });
  if (code !== 1) throw new Error(`TeX 接口返回错误码 ${code}`);
  return envelope.result;
}

async function texResponse(fetch: FetchLike, path: string, init: RequestInit = {}): Promise<FetchResponse> {
  const headers = new Headers({
    accept: "application/json",
    referer: `${TEX_BASE_URL}/console`,
  });
  if (init.body !== undefined) headers.set("content-type", "application/json;charset=utf-8");
  new Headers(init.headers).forEach((value, name) => headers.set(name, value));
  const redirect = (init.method ?? "GET").toUpperCase() === "GET" ? "follow" : "manual";
  const response = await fetch(new URL(path, TEX_BASE_URL), { ...init, headers, redirect });
  if (!response.ok) throw new Error(`TeX HTTP ${response.status}`);
  return response;
}
