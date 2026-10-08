import { lstat, mkdir, readFile, readdir } from "node:fs/promises";
import { basename, dirname, join, posix, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { AppError } from "../../../src/core/errors.js";
import { saveFile } from "../../../src/core/fs.js";
import { requiredText } from "../../../src/core/guards.js";
import type { FetchLike } from "../../../src/core/types.js";

export const BOX_URL = "https://box.nju.edu.cn";
export const BOX_SHARE_TYPES = ["user", "group"] as const;
export const BOX_PERMISSIONS = ["r", "rw"] as const;
export type BoxShareType = typeof BOX_SHARE_TYPES[number];
export type BoxPermission = typeof BOX_PERMISSIONS[number];
const repoSchema = z.object({ id: z.string(), name: z.string(), size: z.number().optional(),
  permission: z.string(), encrypted: z.boolean(), type: z.string() });
const entrySchema = z.object({ id: z.string(), name: z.string(), type: z.enum(["file", "dir"]),
  size: z.number().optional(), mtime: z.number().optional(), parent_dir: z.string().optional(),
  permission: z.string().optional(), starred: z.boolean().optional(), is_locked: z.boolean().optional() });
const shareSchema = z.object({ token: z.string(), link: z.string(), repo_id: z.string(), path: z.string(),
  is_dir: z.boolean().optional(), expire_date: z.string().nullable().optional(),
  expiration_time: z.string().nullable().optional(), is_expired: z.boolean().optional(),
  password: z.string().nullable().optional(), permissions: z.object({
    can_download: z.boolean().optional(), can_edit: z.boolean().optional(), can_upload: z.boolean().optional(),
  }).optional() });
export interface BoxEntry {
  id: string; repoId: string; path: string; name: string; type: z.output<typeof entrySchema>["type"];
  size: number | undefined; modified: number | undefined; permission: string | undefined;
  starred: boolean | undefined; locked: boolean | undefined;
}
export interface BoxLinkOptions { password?: string | undefined; expireDays?: number | undefined; previewOnly?: boolean | undefined }
export interface BoxLink {
  id: string; url: string; repoId: string; path: string; isDir: boolean | undefined;
  expires: string | null | undefined; expired: boolean | undefined; protected: boolean;
  permissions: z.output<typeof shareSchema>["permissions"];
}

export class BoxClient {
  constructor(private readonly fetch: FetchLike, private readonly csrf?: string) {}

  async hasSession(): Promise<boolean> {
    const response = await this.fetch(`${BOX_URL}/api2/account/info/`);
    if (response.status === 401 || response.status === 403) return false;
    if (!response.ok) throw new Error(`南大云盘会话检查返回 HTTP ${response.status}`);
    parse(z.object({ usage: z.number(), total: z.number() }), JSON.parse(await response.text()));
    return true;
  }

  async info() {
    const data = parse(z.object({ name: z.string(), usage: z.number(), total: z.number(), space_usage: z.string() }),
      await this.request("/api2/account/info/"));
    return { name: data.name, usedBytes: data.usage, totalBytes: data.total, usage: data.space_usage };
  }

  async repos() {
    return parse(z.array(repoSchema), await this.request("/api2/repos/")).map((r) => ({
      id: r.id, name: r.name, size: r.size, permission: r.permission, encrypted: r.encrypted, type: r.type,
    }));
  }

  async createRepo(name: string) {
    name = requiredText(name, "资料库名称");
    const created = parse(z.object({ repo_id: z.string() }), await this.request("/api2/repos/?from=web", "POST", { name }));
    const result = await this.findRepo(created.repo_id);
    verify(result.name === name, "资料库创建回读");
    return result;
  }

  async renameRepo(repoId: string, name: string) {
    name = requiredText(name, "资料库名称");
    await this.request(`/api2/repos/${id(repoId)}/?op=rename`, "POST", { repo_name: name });
    const result = await this.findRepo(repoId);
    verify(result.name === name, "资料库名称回读");
    return result;
  }

  async removeRepo(repoId: string) {
    await this.findRepo(repoId);
    await this.request(`/api/v2.1/repos/${id(repoId)}/`, "DELETE");
    verify(!(await this.repos()).some((r) => r.id === repoId), "资料库删除回读");
    return { repoId, removed: true };
  }

  async deletedRepos() {
    return parse(z.array(z.object({ repo_id: z.string(), repo_name: z.string(), del_time: z.string() })),
      await this.request("/api/v2.1/deleted-repos/")).map((repo) => ({ id: repo.repo_id, name: repo.repo_name, deleted: repo.del_time }));
  }

  async restoreRepo(repoId: string) {
    await this.request("/api/v2.1/deleted-repos/", "POST", { repo_id: repoId });
    return this.findRepo(repoId);
  }

  async list(repoId: string, path = "/", recursive = false): Promise<BoxEntry[]> {
    path = boxPath(path);
    const params = new URLSearchParams({ p: path });
    if (recursive) params.set("recursive", "1");
    return parse(z.array(entrySchema), await this.request(`/api2/repos/${id(repoId)}/dir/?${params}`))
      .map((e) => entry(e, repoId, e.parent_dir ?? path));
  }

  async scan(repoId?: string, path = "/") {
    const repos = repoId ? [await this.findRepo(repoId)] : await this.repos();
    const entries: BoxEntry[] = [];
    const skipped = [];
    for (const repo of repos) {
      if (repo.encrypted && !repoId) { skipped.push({ repoId: repo.id, reason: "encrypted" }); continue; }
      entries.push(...await this.list(repo.id, path, true));
    }
    return { entries, files: entries.filter((e) => e.type === "file").length,
      directories: entries.filter((e) => e.type === "dir").length,
      bytes: entries.reduce((sum, e) => sum + (e.size ?? 0), 0), skipped };
  }

  async search(query: string, repoId?: string, page = 1, pageSize = 25) {
    const params = new URLSearchParams({ q: requiredText(query, "搜索词"), page: String(page), per_page: String(pageSize) });
    if (repoId) params.set("search_repo", repoId);
    const data = parse(z.object({ total: z.number(), has_more: z.boolean(), results: z.array(z.object({
      repo_id: z.string(), repo_name: z.string(), name: z.string(), fullpath: z.string(), is_dir: z.boolean(),
      size: z.number().optional(),
    })) }), await this.request(`/api2/search/?${params}`));
    return { total: data.total, more: data.has_more, page, entries: data.results.map((e) => ({
      repoId: e.repo_id, repoName: e.repo_name, path: e.fullpath, name: e.name, type: e.is_dir ? "dir" : "file", size: e.size,
    })) };
  }

  async detail(repoId: string, path: string): Promise<BoxEntry> {
    path = boxPath(path);
    if (path === "/") return { id: repoId, repoId, path, name: (await this.findRepo(repoId)).name,
      type: "dir", size: undefined, modified: undefined, permission: undefined, starred: undefined, locked: undefined };
    const result = (await this.list(repoId, posix.dirname(path))).find((e) => e.path === path);
    if (!result) throw new AppError("NOT_FOUND", `南大云盘路径不存在：${path}`);
    return result;
  }

  async link(repoId: string, path: string) {
    const target = await this.detail(repoId, path);
    const params = new URLSearchParams({ repo_id: repoId, path: target.path, is_dir: String(target.type === "dir") });
    const data = parse(z.object({ smart_link: z.string() }), await this.request(`/api/v2.1/smart-link/?${params}`));
    return { repoId, path: target.path, url: data.smart_link };
  }

  async download(repoId: string, path: string, output: string) {
    const target = await this.detail(repoId, path);
    if (target.type === "file") return this.downloadFile(repoId, target, output);
    const entries = await this.list(repoId, target.path, true);
    const root = resolve(output);
    await mkdir(root, { recursive: true });
    let bytes = 0, files = 0;
    for (const e of entries) {
      const relative = posix.relative(target.path, e.path);
      verify(relative !== ".." && !relative.startsWith("../") && !posix.isAbsolute(relative), "下载目录范围");
      const local = join(root, relative);
      if (e.type === "dir") await mkdir(local, { recursive: true });
      else {
        await mkdir(dirname(local), { recursive: true });
        bytes += (await this.downloadFile(repoId, e, local)).bytes;
        files++;
      }
    }
    return { path: root, bytes, files };
  }

  async upload(repoId: string, localPath: string, parent = "/", replace = false): Promise<BoxEntry[]> {
    parent = boxPath(parent);
    const files: BoxEntry[] = [];
    const visit = async (local: string, remote: string): Promise<void> => {
      const metadata = await lstat(local);
      if (metadata.isDirectory()) {
        const directory = posix.join(remote, basename(local));
        const current = (await this.list(repoId, remote)).find((e) => e.name === basename(local));
        if (!current) await this.mkdir(repoId, directory);
        else verify(current.type === "dir", "上传目录目标类型");
        for (const child of await readdir(local, { withFileTypes: true })) {
          if (child.isSymbolicLink()) throw new AppError("INVALID_INPUT", "上传目录中的符号链接需转换为普通文件");
          await visit(join(local, child.name), directory);
        }
        return;
      }
      if (!metadata.isFile()) throw new AppError("INVALID_INPUT", "上传材料应为普通文件或目录");
      const content = await readFile(local);
      const url = transferUrl(parse(z.string(), await this.request(`/api2/repos/${id(repoId)}/upload-link/?${new URLSearchParams({ p: remote, from: "web" })}`)));
      url.searchParams.set("ret-json", "1");
      const body = new FormData();
      body.set("parent_dir", remote); body.set("replace", replace ? "1" : "0");
      body.set("file", new Blob([content]), basename(local));
      const uploaded = parse(z.array(z.object({ name: z.string(), id: z.string(), size: z.number() })),
        await this.request(url.href, "POST", body));
      verify(uploaded.length === 1, "上传文件响应");
      const saved = uploaded[0]!;
      const result = await this.detail(repoId, posix.join(remote, saved.name));
      verify(result.id === saved.id && result.size === content.length, "上传文件标识与大小回读");
      verify(Buffer.from(await this.downloadBytes(repoId, result.path)).equals(content), "上传文件字节回读");
      files.push(result);
    };
    await visit(resolve(localPath), parent);
    return files;
  }

  async mkdir(repoId: string, path: string) {
    path = boxPath(path);
    await this.request(`/api2/repos/${id(repoId)}/dir/?${new URLSearchParams({ p: path })}`, "POST", { operation: "mkdir", create_parents: "true" });
    const result = await this.detail(repoId, path);
    verify(result.type === "dir", "目录创建回读");
    return result;
  }

  async rename(repoId: string, path: string, name: string) {
    name = fileName(name);
    const target = await this.detail(repoId, path);
    verify(target.path !== "/", "重命名目标应为文件或子目录");
    const endpoint = target.type === "dir" ? "/api2" : "/api/v2.1";
    await this.request(`${endpoint}/repos/${id(repoId)}/${target.type}/?${new URLSearchParams({ p: target.path })}`, "POST", { operation: "rename", newname: name });
    return this.detail(repoId, posix.join(posix.dirname(target.path), name));
  }

  async remove(repoId: string, path: string) {
    const target = await this.detail(repoId, path);
    verify(target.path !== "/", "删除目标应为文件或子目录");
    await this.request(`/api/v2.1/repos/${id(repoId)}/${target.type}/?${new URLSearchParams({ p: target.path })}`, "DELETE");
    verify(!(await this.list(repoId, posix.dirname(target.path))).some((e) => e.path === target.path), "文件删除回读");
    return { repoId, path: target.path, removed: true };
  }

  async copy(repoId: string, path: string, destinationRepo: string, destination: string) {
    return this.transfer("copy", repoId, path, destinationRepo, destination);
  }

  async move(repoId: string, path: string, destinationRepo: string, destination: string) {
    return this.transfer("move", repoId, path, destinationRepo, destination);
  }

  async shares(repoId?: string, path?: string, page = 1, pageSize = 25): Promise<BoxLink[]> {
    const params = new URLSearchParams({ page: String(page), per_page: String(pageSize) });
    if (repoId) params.set("repo_id", repoId);
    if (path) params.set("path", boxPath(path));
    return parse(z.array(shareSchema), await this.request(`/api/v2.1/share-links/?${params}`)).map(share);
  }

  async share(repoId: string, path: string, options: BoxLinkOptions = {}): Promise<BoxLink> {
    const target = await this.detail(repoId, path);
    const data = linkForm(target, options);
    data.permissions = JSON.stringify({ can_download: !options.previewOnly, can_edit: false, can_upload: false });
    const created = share(parse(shareSchema, await this.request("/api/v2.1/share-links/", "POST", data)));
    const result = share(parse(shareSchema, await this.request(`/api/v2.1/share-links/${id(created.id)}/`)));
    verify(result.id === created.id && result.repoId === repoId && boxPath(result.path) === target.path, "分享链接目标回读");
    verify(!options.password || result.protected, "分享链接密码设置回读");
    verify(result.permissions?.can_download === !options.previewOnly, "分享链接下载权限回读");
    return result;
  }

  async unshare(linkId: string) {
    const path = `/api/v2.1/share-links/${id(linkId)}/`;
    await this.request(path, "DELETE");
    const response = await this.fetch(`${BOX_URL}${path}`);
    verify(response.status === 404, "分享链接撤销回读");
    return { id: linkId, revoked: true };
  }

  async uploadLinks(repoId?: string, path?: string): Promise<BoxLink[]> {
    const params = new URLSearchParams();
    if (repoId) params.set("repo_id", repoId);
    if (path) params.set("path", boxPath(path));
    return parse(z.array(shareSchema), await this.request(`/api/v2.1/upload-links/?${params}`)).map(share);
  }

  async uploadLink(repoId: string, path: string, options: BoxLinkOptions = {}): Promise<BoxLink> {
    const target = await this.detail(repoId, path);
    verify(target.type === "dir", "上传链接目标应为目录");
    const created = share(parse(shareSchema, await this.request("/api/v2.1/upload-links/", "POST", linkForm(target, options))));
    const result = (await this.uploadLinks(repoId, target.path)).find((link) => link.id === created.id);
    verify(result?.repoId === repoId && boxPath(result.path) === target.path, "上传链接目标回读");
    verify(!options.password || result!.protected, "上传链接密码设置回读");
    return result!;
  }

  async revokeUploadLink(linkId: string) {
    const target = (await this.uploadLinks()).find((link) => link.id === linkId);
    if (!target) throw new AppError("NOT_FOUND", "上传链接不存在");
    await this.request(`/api/v2.1/upload-links/${id(linkId)}/`, "DELETE");
    verify(!(await this.uploadLinks(target.repoId, target.path)).some((link) => link.id === linkId), "上传链接撤销回读");
    return { id: linkId, revoked: true };
  }

  async starred() {
    return parse(z.object({ starred_item_list: z.array(z.object({ repo_id: z.string(), path: z.string(),
      obj_name: z.string(), is_dir: z.boolean() })) }), await this.request("/api/v2.1/starred-items/"))
      .starred_item_list.map((e) => ({ repoId: e.repo_id, path: e.path, name: e.obj_name, type: e.is_dir ? "dir" : "file" }));
  }

  async star(repoId: string, path: string) {
    const target = await this.detail(repoId, path);
    await this.request("/api/v2.1/starred-items/", "POST", { repo_id: repoId, path: target.path });
    verify((await this.starred()).some((e) => e.repoId === repoId && boxPath(e.path) === target.path), "收藏回读");
    return { repoId, path: target.path, starred: true };
  }

  async unstar(repoId: string, path: string) {
    path = boxPath(path);
    await this.request(`/api/v2.1/starred-items/?${new URLSearchParams({ repo_id: repoId, path })}`, "DELETE");
    verify(!(await this.starred()).some((e) => e.repoId === repoId && boxPath(e.path) === path), "取消收藏回读");
    return { repoId, path, starred: false };
  }

  async lock(repoId: string, path: string) { return this.setLock(repoId, path, true); }
  async unlock(repoId: string, path: string) { return this.setLock(repoId, path, false); }

  async history(repoId: string, page = 1, pageSize = 25) {
    const data = parse(z.object({ more: z.boolean(), data: z.array(z.object({ commit_id: z.string(),
      time: z.string(), description: z.string() })) }),
      await this.request(`/api/v2.1/repos/${id(repoId)}/history/?${new URLSearchParams({ page: String(page), per_page: String(pageSize) })}`));
    return { more: data.more, page, entries: data.data.map((e) => ({ commitId: e.commit_id, time: e.time, description: e.description })) };
  }

  async trash(repoId: string, path = "/", cursor?: string) {
    const params = new URLSearchParams({ path: boxPath(path) });
    if (cursor) params.set("scan_stat", cursor);
    const data = parse(z.object({ more: z.boolean(), scan_stat: z.string().nullable(), data: z.array(z.object({
      commit_id: z.string(), obj_id: z.string(), obj_name: z.string(), parent_dir: z.string(), is_dir: z.boolean(),
      size: z.number().optional(), deleted_time: z.string(),
    })) }), await this.request(`/api/v2.1/repos/${id(repoId)}/trash/?${params}`));
    return { more: data.more, cursor: data.scan_stat, entries: data.data.map((e) => ({ commitId: e.commit_id,
      id: e.obj_id, path: posix.join(e.parent_dir, fileName(e.obj_name)), type: e.is_dir ? "dir" : "file", size: e.size, deleted: e.deleted_time })) };
  }

  async restore(repoId: string, path: string, commitId: string, directory = false) {
    path = boxPath(path);
    await this.request(`/api2/repos/${id(repoId)}/${directory ? "dir" : "file"}/revert/`, "PUT", { p: path, commit_id: requiredText(commitId, "版本编号") });
    return this.detail(repoId, path);
  }

  async groups() {
    return parse(z.array(z.object({ id: z.number(), name: z.string() })), await this.request("/api/v2.1/shareable-groups/"));
  }

  async collaborators(repoId: string, path = "/", type: BoxShareType = "user") {
    return parse(z.array(z.object({ user_email: z.string().optional(), user_name: z.string().optional(),
      group_id: z.number().optional(), group_name: z.string().optional(), permission: z.string() })),
      await this.request(`/api2/repos/${id(repoId)}/dir/shared_items/?${new URLSearchParams({ p: boxPath(path), share_type: type })}`));
  }

  async shareTo(repoId: string, path: string, type: BoxShareType, recipient: string, permission: BoxPermission = "r") {
    path = boxPath(path);
    const data = { share_type: type, permission, [type === "user" ? "username" : "group_id"]: requiredText(recipient, "共享对象") };
    await this.request(`/api2/repos/${id(repoId)}/dir/shared_items/?${new URLSearchParams({ p: path })}`, "PUT", data);
    const result = (await this.collaborators(repoId, path, type)).find((e) => type === "user" ? e.user_email === recipient : String(e.group_id) === recipient);
    verify(result?.permission === permission, "成员共享权限回读");
    return result!;
  }

  async unshareTo(repoId: string, path: string, type: BoxShareType, recipient: string) {
    path = boxPath(path);
    const params = new URLSearchParams({ p: path, share_type: type, [type === "user" ? "username" : "group_id"]: recipient });
    await this.request(`/api2/repos/${id(repoId)}/dir/shared_items/?${params}`, "DELETE");
    verify(!(await this.collaborators(repoId, path, type)).some((e) => type === "user" ? e.user_email === recipient : String(e.group_id) === recipient), "成员共享撤销回读");
    return { repoId, path, type, recipient, revoked: true };
  }

  private async findRepo(repoId: string) {
    const result = (await this.repos()).find((repo) => repo.id === repoId);
    if (!result) throw new AppError("NOT_FOUND", "南大云盘资料库不存在");
    return result;
  }

  private async setLock(repoId: string, path: string, locked: boolean) {
    const target = await this.detail(repoId, path);
    verify(target.type === "file", "锁定目标应为文件");
    await this.request(`/api/v2.1/repos/${id(repoId)}/file/?${new URLSearchParams({ p: target.path })}`, "PUT", { operation: locked ? "lock" : "unlock" });
    const result = await this.detail(repoId, target.path);
    verify(result.locked === locked, "文件锁定状态回读");
    return result;
  }

  private async transfer(operation: "copy" | "move", repoId: string, path: string, destinationRepo: string, destination: string) {
    const target = await this.detail(repoId, path);
    verify(target.path !== "/", "复制移动目标应为文件或子目录");
    destination = boxPath(destination);
    verify((await this.detail(destinationRepo, destination)).type === "dir", "复制移动目标目录");
    const destinationPath = posix.join(destination, target.name);
    verify(!(await this.list(destinationRepo, destination)).some((e) => e.path === destinationPath), "目标目录应为空闲文件名");
    if (repoId === destinationRepo && target.type === "dir") verify(!destinationPath.startsWith(`${target.path}/`), "移动复制目录范围");
    const data = parse(z.object({ task_id: z.string().nullable().optional() }), await this.request(
      `/api/v2.1/repos/${repoId === destinationRepo ? "sync" : "async"}-batch-${operation}-item/`, "POST", {
        src_repo_id: repoId, src_parent_dir: posix.dirname(target.path), dst_repo_id: destinationRepo,
        dst_parent_dir: destination, src_dirents: [target.name],
      }, true));
    if (data.task_id) {
      const deadline = Date.now() + 180_000;
      while (true) {
        const progress = parse(z.object({ failed: z.boolean(), successful: z.boolean(), canceled: z.boolean().optional() }),
          await this.request(`/api/v2.1/query-copy-move-progress/?${new URLSearchParams({ task_id: data.task_id })}`));
        verify(!progress.failed && !progress.canceled, "复制移动任务执行", { taskId: data.task_id });
        if (progress.successful) break;
        verify(Date.now() < deadline, "复制移动任务等待超时", { taskId: data.task_id });
        await delay(1000);
      }
    }
    const result = await this.detail(destinationRepo, destinationPath);
    verify(result.type === target.type && result.size === target.size, "复制移动目标回读");
    if (operation === "move") verify(!(await this.list(repoId, posix.dirname(target.path))).some((e) => e.path === target.path), "移动来源回读");
    return result;
  }

  private async downloadBytes(repoId: string, path: string): Promise<Uint8Array> {
    const url = transferUrl(parse(z.string(), await this.request(`/api2/repos/${id(repoId)}/file/?${new URLSearchParams({ p: path, reuse: "1" })}`)));
    const response = await this.fetch(url);
    if (!response.ok) throw new Error(`南大云盘下载返回 HTTP ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  }

  private async downloadFile(repoId: string, file: BoxEntry, output: string) {
    const content = await this.downloadBytes(repoId, file.path);
    verify(file.size === undefined || content.byteLength === file.size, "下载文件大小");
    return saveFile(output, content);
  }

  private async request(path: string, method = "GET", data?: Record<string, unknown> | FormData, json = false): Promise<unknown> {
    const headers: Record<string, string> = { Accept: "application/json", Referer: `${BOX_URL}/` };
    if (method !== "GET" && this.csrf) headers["X-CSRFToken"] = this.csrf;
    let body: string | FormData | undefined;
    if (data instanceof FormData) body = data;
    else if (data) {
      headers["Content-Type"] = json ? "application/json" : "application/x-www-form-urlencoded";
      body = json ? JSON.stringify(data) : new URLSearchParams(data as Record<string, string>).toString();
    }
    const response = await this.fetch(path.startsWith("https:") ? path : `${BOX_URL}${path}`, {
      method, headers, ...(body === undefined ? {} : { body }), redirect: "manual",
    });
    if (response.status === 401 || (response.status === 302 && response.headers.get("location")?.includes("/accounts/login"))) {
      throw new AppError("AUTH_EXPIRED", "南大云盘会话已过期", { authCommand: "njucli auth login box" });
    }
    if (response.status === 404) throw new AppError("NOT_FOUND", "南大云盘目标不存在");
    // Legacy rename/mkdir endpoints return 301 and a JSON success string. Do not follow mutation redirects.
    if (!response.ok && response.status !== 301) throw new AppError("REMOTE_UNAVAILABLE", `南大云盘请求返回 HTTP ${response.status}`);
    const text = await response.text();
    if (!text && response.status === 204) return null;
    try { return JSON.parse(text); }
    catch { throw new AppError("REMOTE_SCHEMA_CHANGED", "南大云盘响应应为 JSON"); }
  }
}

export function boxPath(value: string): string {
  value = requiredText(value, "云盘路径");
  if (!value.startsWith("/") || /[\x00-\x1f\\]/.test(value) || value.split("/").includes("..")) throw new AppError("INVALID_INPUT", "云盘路径应从 / 开始并使用明确的目录名称");
  return posix.normalize(value).replace(/\/$/, "") || "/";
}

function fileName(value: string): string {
  if (!value || value === "." || value === ".." || /[/\\\x00-\x1f]/.test(value)) throw new AppError("INVALID_INPUT", "文件名应为单个有效名称");
  return value;
}
function id(value: string): string { return encodeURIComponent(requiredText(value, "标识")); }
function entry(e: z.output<typeof entrySchema>, repoId: string, parent: string): BoxEntry {
  return { id: e.id, repoId, path: posix.join(boxPath(parent), fileName(e.name)), name: e.name, type: e.type,
    size: e.size, modified: e.mtime, permission: e.permission, starred: e.starred, locked: e.is_locked };
}
function share(e: z.output<typeof shareSchema>): BoxLink {
  return { id: e.token, url: e.link, repoId: e.repo_id, path: e.path, isDir: e.is_dir,
    expires: e.expire_date ?? e.expiration_time, expired: e.is_expired, protected: Boolean(e.password), permissions: e.permissions };
}
function linkForm(target: BoxEntry, options: BoxLinkOptions): Record<string, string> {
  const data: Record<string, string> = { repo_id: target.repoId,
    path: target.type === "dir" ? `${target.path.replace(/\/$/, "")}/` : target.path };
  if (options.password) data.password = options.password;
  if (options.expireDays) data.expiration_time = new Date(Date.now() + options.expireDays * 86_400_000).toISOString();
  return data;
}
function transferUrl(value: string): URL {
  const url = new URL(value);
  if (url.origin !== BOX_URL || url.username || url.password) throw new AppError("REMOTE_SCHEMA_CHANGED", "文件传输地址应属于南大云盘官方站点");
  return url;
}
function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new AppError("REMOTE_SCHEMA_CHANGED", "南大云盘响应字段发生变化");
  return result.data;
}
function verify(condition: boolean, message: string, details?: unknown): void {
  if (!condition) throw new AppError("REMOTE_UNAVAILABLE", `南大云盘${message}待核对`, { details });
}
