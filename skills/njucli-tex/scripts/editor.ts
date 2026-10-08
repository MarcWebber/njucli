import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";

import type { Page } from "playwright-core";
import { AppError } from "../../../src/core/errors.js";
import { isRecord } from "../../../src/core/guards.js";
import { TEX_BASE_URL, texResult, type TexClient } from "./client.js";

export async function writeTexFile(
  client: TexClient,
  page: Page,
  projectKey: string,
  versionNo: string,
  path: string,
  content: string,
): Promise<{ path: string; bytes: number }> {
  const { file, editor } = await openEditor(client, page, projectKey, versionNo, path);
  const text = content.replaceAll("\r\n", "\n");
  await editor.fill(text);
  const deadline = Date.now() + 20_000;
  do {
    if (await client.read(projectKey, versionNo, file.fileKey) === text) {
      return { path, bytes: Buffer.byteLength(text, "utf8") };
    }
    await delay(1_000);
  } while (Date.now() < deadline);
  throw new Error("TeX 编辑已发送，但等待保存超时，尚未读回相同正文；请读取文件确认，不要重复写入");
}

export async function uploadTexFile(
  client: TexClient,
  page: Page,
  projectKey: string,
  versionNo: string,
  name: string,
  content: Buffer,
) {
  if (name.startsWith(".")) throw new AppError("INVALID_INPUT", "TeX 网站不支持上传隐藏文件");
  if (content.byteLength >= 50 * 1024 * 1024) throw new AppError("INVALID_INPUT", "TeX 上传文件必须小于 50 MiB");
  const existing = (await client.files(projectKey, versionNo)).find((file) => file.path === name);
  if (existing?.isDir) throw new AppError("INVALID_INPUT", "TeX 根目录存在同名目录，不能用文件替换目录");
  await openProject(page, projectKey, versionNo);
  await page.locator(".explorer-header .icon-upload").click();
  const dialog = page.getByRole("dialog", { name: "上传文件", exact: true });
  await dialog.waitFor({ state: "visible" });
  if ((await dialog.locator(".ant-select-selection-item").innerText()).trim() !== "/") {
    throw new Error("TeX 上传目标不是项目根目录，未上传");
  }
  const registered = page.waitForResponse((response) => {
    const request = response.request();
    const url = new URL(response.url());
    if (url.origin !== TEX_BASE_URL || url.pathname !== "/api/project/file" || request.method() !== "POST") return false;
    const body: unknown = request.postDataJSON();
    return isRecord(body) && body.projectKey === projectKey && body.versionNo === versionNo &&
      body.addType === "upload" && body.isDir === false && body.parentKey === "0" && body.fileName === name && body.overwrite === (existing !== undefined);
  }, { timeout: 60_000 });
  const [response] = await Promise.all([
    registered,
    (async () => {
      await dialog.locator('input[type="file"][multiple]').setInputFiles({ name, mimeType: "application/octet-stream", buffer: content });
      // The native control detects duplicates locally, before transferring bytes.
      if (existing) await dialog.locator(".upload-list").getByRole("button", { name: "覆盖", exact: true }).click();
    })(),
  ]);
  if (!response.ok()) throw new Error(`TeX 上传登记 HTTP ${response.status()}；请查询状态，不要重复上传`);
  texResult(await response.json());
  return client.verifyUpload(projectKey, versionNo, name, content);
}

export async function compileTexFile(
  client: TexClient,
  page: Page,
  projectKey: string,
  versionNo: string,
  path: string,
): Promise<unknown> {
  const connection = page.waitForEvent("websocket", {
    predicate: (socket) => new URL(socket.url()).pathname === "/socket.io/",
    timeout: 30_000,
  });
  const [, socket] = await Promise.all([openEditor(client, page, projectKey, versionNo, path), connection]);
  const compile = page.locator(".project-menu .icon-compile");
  await compile.waitFor({ state: "visible", timeout: 60_000 });
  let requestId: string | undefined;
  const sent = socket.waitForEvent("framesent", {
    timeout: 60_000,
    predicate: ({ payload }) => {
      const message = socketMessage(payload, "request");
      if (!isRecord(message?.request) || !isRecord(message.data)) return false;
      if (message.request.action !== "get:/api/project/compile" ||
          message.data.projectKey !== projectKey || message.data.versionNo !== versionNo) return false;
      requestId = z.string().min(1).parse(message.request.requestId);
      return true;
    },
  });
  const received = socket.waitForEvent("framereceived", {
    timeout: 60_000,
    predicate: ({ payload }) => {
      const message = socketMessage(payload, "response");
      return requestId !== undefined && message?.requestId === requestId;
    },
  });
  const [, frame] = await Promise.all([sent, received, compile.click()]);
  const message = socketMessage(frame.payload, "response");
  if (message?.isCurrentTaskResult === false) throw new Error("TeX 编译未取得本次任务结果，不重复提交");
  return texResult(message);
}

function socketMessage(payload: string | Buffer, event: string): Record<string, unknown> | undefined {
  if (typeof payload !== "string" || !payload.startsWith("42[")) return undefined;
  const [name, value] = JSON.parse(payload.slice(2)) as [string, unknown];
  return name === event && isRecord(value) ? value : undefined;
}

async function openEditor(
  client: TexClient,
  page: Page,
  projectKey: string,
  versionNo: string,
  path: string,
) {
  const file = (await client.files(projectKey, versionNo)).find((item) => item.path === path && !item.isDir);
  if (!file) throw new AppError("NOT_FOUND", `TeX 文本文件不存在：${path}`);
  await client.read(projectKey, versionNo, file.fileKey);
  await openProject(page, projectKey, versionNo);
  const tree = page.locator(".project-directory");
  const parts = path.split("/");
  for (let depth = 1; depth < parts.length; depth++) {
    if (!await tree.getByTitle(parts.slice(0, depth + 1).join("/"), { exact: true }).isVisible()) {
      await tree.getByTitle(parts.slice(0, depth).join("/"), { exact: true }).click();
    }
  }
  await tree.getByTitle(path, { exact: true }).click();
  await page.getByText("正在加载文件...", { exact: true }).waitFor({ state: "hidden" });
  await page.locator(".project-directory .node-loading").waitFor({ state: "hidden" });
  await page.waitForFunction((expected: string) => {
    const parts = Array.from(document.querySelectorAll(".editor-footer-path-item"));
    return parts.slice(0, expected.split("/").length).map((part) => part.textContent).join("/") === expected;
  }, path);
  const editor = page.locator('.cm-content[contenteditable="true"]');
  await editor.waitFor({ state: "visible" });
  if (await page.locator(".project-info-item.sync-btn").isVisible()) {
    throw new AppError("USER_ACTION_REQUIRED", "该项目使用手动提交模式，请先在官方编辑器切回自动同步；尚未修改正文");
  }
  return { file, editor };
}

async function openProject(page: Page, projectKey: string, versionNo: string) {
  await page.goto(`${TEX_BASE_URL}/project/user/${encodeURIComponent(projectKey)}/${encodeURIComponent(versionNo)}`, { waitUntil: "domcontentloaded" });
  await page.locator(".project-directory").waitFor({ state: "visible" });
  await page.getByText("正在加载文件...", { exact: true }).waitFor({ state: "hidden" });
}
