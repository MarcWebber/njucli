import { checkDocumentEdit, documentContentSchema, documentSnapshotSchema } from './documents.js';
import { chartSchema, chartWhiteboard, checkWhiteboardEdit, whiteboardContentSchema, whiteboardSnapshotSchema } from './whiteboards.js';
import { z } from 'zod';
import type { McpTool } from '../../../src/mcp/tools.js';
import type { BoxServices } from './services.js';
import { BOX_SHARE_TYPES, BOX_PERMISSIONS } from './client.js';

const boxRepo = z.string().min(1).describe("南大云盘资料库 ID，来自 box_repos");

const boxPath = z.string().startsWith("/").describe("云盘绝对路径");

const boxPage = { page: z.number().int().min(1).optional(), pageSize: z.number().int().min(1).optional() };

export function registerBoxTools(tool: McpTool, service: BoxServices): void {
  tool("box_info", "查看南大云盘存储用量。", {}, () => service.info());
  tool("box_repos", "列出当前账号可见的南大云盘资料库。", {}, () => service.repos());
  tool("box_list", "列出云盘目录内容。", { repoId: boxRepo, path: boxPath.optional() }, ({ repoId, path }) => service.list(repoId, path));
  tool("box_scan", "递归扫描指定或全部普通资料库，返回文件、目录与大小。", { repoId: boxRepo.optional(), path: boxPath.optional() }, ({ repoId, path }) => service.scan(repoId, path));
  tool("box_search", "搜索云盘文件名与内容。", { query: z.string().min(1), repoId: boxRepo.optional(), ...boxPage }, ({ query, repoId, page, pageSize }) => service.search(query, repoId, page, pageSize));
  tool("box_detail", "查看云盘文件或目录详情。", { repoId: boxRepo, path: boxPath }, ({ repoId, path }) => service.detail(repoId, path));
  tool("box_link", "返回云盘官方内部链接，供预览和在线编辑。", { repoId: boxRepo, path: boxPath }, ({ repoId, path }) => service.link(repoId, path));
  tool("box_doc_read", "读取 SeaDoc 在线文档的最新结构化正文、版本和固定链接。", {
    repoId: boxRepo, path: boxPath.endsWith(".sdoc"),
  }, ({ repoId, path }) => service.docRead(repoId, path));
  tool("box_whiteboard_read", "读取云盘 Excalidraw 白板或图表的原生元素、版本与在线编辑链接。", {
    repoId: boxRepo, path: boxPath.endsWith(".exdraw"),
  }, ({ repoId, path }) => service.whiteboardRead(repoId, path));
  tool("box_shares", "分页列出已有分享链接，含 url 与用于撤销的 id。", { repoId: boxRepo.optional(), path: boxPath.optional(), ...boxPage }, ({ repoId, path, page, pageSize }) => service.shares(repoId, path, page, pageSize));
  tool("box_upload_links", "查询已有收集文件的上传链接。", { repoId: boxRepo.optional(), path: boxPath.optional() }, ({ repoId, path }) => service.uploadLinks(repoId, path));
  tool("box_starred", "查询云盘收藏。", {}, () => service.starred());
  tool("box_history", "分页查询资料库版本历史。", { repoId: boxRepo, ...boxPage }, ({ repoId, page, pageSize }) => service.history(repoId, page, pageSize));
  tool("box_trash", "查询回收站，返回恢复标识和分页 cursor。", { repoId: boxRepo, path: boxPath.optional(), cursor: z.string().min(1).optional() }, ({ repoId, path, cursor }) => service.trash(repoId, path, cursor));
  tool("box_deleted_repos", "查询可恢复的已删除资料库。", {}, () => service.deletedRepos());
  tool("box_groups", "查询可共享的群组。", {}, () => service.groups());
  tool("box_collaborators", "查询云盘目录或资料库的协作成员与权限。", { repoId: boxRepo, path: boxPath.optional(), type: z.enum(BOX_SHARE_TYPES).optional() }, ({ repoId, path, type }) => service.collaborators(repoId, path, type));
  tool("box_create_repo", "创建资料库并回读。", { name: z.string().trim().min(1) }, ({ name }) => service.createRepo(name), { destructiveHint: false });
  tool("box_rename_repo", "重命名指定资料库并回读。", { repoId: boxRepo, name: z.string().trim().min(1) }, ({ repoId, name }) => service.renameRepo(repoId, name), { destructiveHint: true });
  tool("box_remove_repo", "删除指定资料库并核对。", { repoId: boxRepo }, ({ repoId }) => service.removeRepo(repoId), { destructiveHint: true });
  tool("box_restore_repo", "恢复已删除资料库并回读。", { repoId: boxRepo }, ({ repoId }) => service.restoreRepo(repoId), { destructiveHint: false });
  tool("box_doc_create", "创建 SeaDoc 在线文档，写入正文并回读。", {
    repoId: boxRepo, path: boxPath.endsWith(".sdoc"), content: documentContentSchema,
  }, ({ repoId, path, content }) => { checkDocumentEdit(content); return service.docCreate(repoId, path, content); }, { destructiveHint: false });
  tool("box_doc_update", "对比原文快照后更新 SeaDoc 正文并回读；base 使用 box_doc_read 的结果。", {
    repoId: boxRepo, path: boxPath.endsWith(".sdoc"), content: documentContentSchema, base: documentSnapshotSchema,
  }, ({ repoId, path, content, base }) => { checkDocumentEdit(content, base); return service.docUpdate(repoId, path, content, base); }, { destructiveHint: true });
  tool("box_whiteboard_create", "创建可在线编辑的白板并回读；省略 content 创建空白画布。", {
    repoId: boxRepo, path: boxPath.endsWith(".exdraw"), content: whiteboardContentSchema.default({ elements: [] }),
  }, ({ repoId, path, content }) => { checkWhiteboardEdit(content); return service.whiteboardCreate(repoId, path, content); }, { destructiveHint: false });
  tool("box_whiteboard_update", "对比原白板后更新并回读；base 使用 box_whiteboard_read 的结果。", {
    repoId: boxRepo, path: boxPath.endsWith(".exdraw"), content: whiteboardContentSchema, base: whiteboardSnapshotSchema,
  }, ({ repoId, path, content, base }) => { checkWhiteboardEdit(content, base); return service.whiteboardUpdate(repoId, path, content, base); }, { destructiveHint: true });
  tool("box_chart_create", "从数据创建可编辑的柱状图或折线图并回读。", {
    repoId: boxRepo, path: boxPath.endsWith(".exdraw"), chart: chartSchema,
  }, ({ repoId, path, chart }) => service.whiteboardCreate(repoId, path, chartWhiteboard(chart)), { destructiveHint: false });
  tool("box_doc_embed_whiteboard", "将云盘白板或图表嵌入在线文档并回读。", {
    repoId: boxRepo, path: boxPath.endsWith(".sdoc"), boardRepo: boxRepo, boardPath: boxPath.endsWith(".exdraw"), base: documentSnapshotSchema, after: z.string().min(1).optional(),
  }, ({ repoId, path, boardRepo, boardPath, base, after }) => service.docEmbedWhiteboard(repoId, path, boardRepo, boardPath, base, after), { destructiveHint: true });
  tool("box_download", "下载云盘文件或目录到本地，覆盖指定输出。", {
    repoId: boxRepo, path: boxPath, output: z.string().min(1),
  }, ({ repoId, path, output }) => service.download(repoId, path, output), { destructiveHint: true });
  tool("box_upload", "上传本地文件或目录并逐文件核对；replace 为 true 时覆盖同名文件。", {
    repoId: boxRepo, local: z.string().min(1), parent: boxPath.optional(), replace: z.boolean().optional(),
  }, ({ repoId, local, parent, replace }) => service.upload(repoId, local, parent, replace), { destructiveHint: true });
  tool("box_mkdir", "创建目录及父目录并回读。", { repoId: boxRepo, path: boxPath }, ({ repoId, path }) => service.mkdir(repoId, path), { destructiveHint: false });
  tool("box_rename", "重命名指定文件或目录并回读。", { repoId: boxRepo, path: boxPath, name: z.string().min(1) }, ({ repoId, path, name }) => service.rename(repoId, path, name), { destructiveHint: true });
  tool("box_remove", "删除指定文件或目录并核对。", { repoId: boxRepo, path: boxPath }, ({ repoId, path }) => service.remove(repoId, path), { destructiveHint: true });
  tool("box_copy", "复制文件或目录，等待完成后回读。", {
    repoId: boxRepo, path: boxPath, destinationRepo: boxRepo, destinationDir: boxPath,
  }, ({ repoId, path, destinationRepo, destinationDir }) => service.copy(repoId, path, destinationRepo, destinationDir), { destructiveHint: true });
  tool("box_move", "移动文件或目录，核对目标和来源。", {
    repoId: boxRepo, path: boxPath, destinationRepo: boxRepo, destinationDir: boxPath,
  }, ({ repoId, path, destinationRepo, destinationDir }) => service.move(repoId, path, destinationRepo, destinationDir), { destructiveHint: true });
  tool("box_share", "创建指定文件或目录的分享链接并回读。", {
    repoId: boxRepo, path: boxPath, password: z.string().optional(), expireDays: z.number().int().positive().optional(), previewOnly: z.boolean().optional(),
  }, ({ repoId, path, ...options }) => service.share(repoId, path, options), { destructiveHint: false });
  tool("box_unshare", "撤销指定分享链接并核对。", { linkId: z.string().min(1) }, ({ linkId }) => service.unshare(linkId), { destructiveHint: true });
  tool("box_upload_link", "为指定目录创建收集文件的上传链接并回读。", {
    repoId: boxRepo, path: boxPath, password: z.string().optional(), expireDays: z.number().int().positive().optional(),
  }, ({ repoId, path, ...options }) => service.uploadLink(repoId, path, options), { destructiveHint: false });
  tool("box_revoke_upload_link", "撤销指定上传链接并核对。", { linkId: z.string().min(1) }, ({ linkId }) => service.revokeUploadLink(linkId), { destructiveHint: true });
  tool("box_star", "收藏指定文件或目录并回读。", { repoId: boxRepo, path: boxPath }, ({ repoId, path }) => service.star(repoId, path), { destructiveHint: false });
  tool("box_unstar", "取消指定文件或目录的收藏并回读。", { repoId: boxRepo, path: boxPath }, ({ repoId, path }) => service.unstar(repoId, path), { destructiveHint: true });
  tool("box_lock", "锁定指定文件并核对。", { repoId: boxRepo, path: boxPath }, ({ repoId, path }) => service.lock(repoId, path), { destructiveHint: true });
  tool("box_unlock", "解除指定文件锁定并核对。", { repoId: boxRepo, path: boxPath }, ({ repoId, path }) => service.unlock(repoId, path), { destructiveHint: true });
  tool("box_restore", "从指定版本恢复文件或目录并回读。", {
    repoId: boxRepo, path: boxPath, commitId: z.string().min(1), directory: z.boolean().optional(),
  }, ({ repoId, path, commitId, directory }) => service.restore(repoId, path, commitId, directory), { destructiveHint: true });
  tool("box_share_to", "将指定资料库或目录共享给用户或群组并回读权限。", {
    repoId: boxRepo, path: boxPath, type: z.enum(BOX_SHARE_TYPES), recipient: z.string().min(1), permission: z.enum(BOX_PERMISSIONS),
  }, ({ repoId, path, type, recipient, permission }) => service.shareTo(repoId, path, type, recipient, permission), { destructiveHint: true });
  tool("box_unshare_to", "移除指定用户或群组的共享权限并核对。", {
    repoId: boxRepo, path: boxPath, type: z.enum(BOX_SHARE_TYPES), recipient: z.string().min(1),
  }, ({ repoId, path, type, recipient }) => service.unshareTo(repoId, path, type, recipient), { destructiveHint: true });
}
