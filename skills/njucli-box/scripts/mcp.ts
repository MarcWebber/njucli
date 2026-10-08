import { z } from 'zod';
import type { ReadTool } from '../../../src/mcp/read.js';
import type { BoxServices } from './services.js';
import { BOX_SHARE_TYPES } from './client.js';

const boxRepo = z.string().min(1).describe("南大云盘资料库 ID，来自 box_repos");

const boxPath = z.string().startsWith("/").describe("云盘绝对路径");

const boxPage = { page: z.number().int().min(1).optional(), pageSize: z.number().int().min(1).optional() };

export function registerBoxTools(read: ReadTool, service: BoxServices): void {
  read("box_info", "查看南大云盘存储用量。", {}, () => service.info());
  read("box_repos", "列出当前账号可见的南大云盘资料库。", {}, () => service.repos());
  read("box_list", "列出云盘目录内容。", { repoId: boxRepo, path: boxPath.optional() }, ({ repoId, path }) => service.list(repoId, path));
  read("box_scan", "递归扫描指定或全部普通资料库，返回文件、目录与大小。", { repoId: boxRepo.optional(), path: boxPath.optional() }, ({ repoId, path }) => service.scan(repoId, path));
  read("box_search", "搜索云盘文件名与内容。", { query: z.string().min(1), repoId: boxRepo.optional(), ...boxPage }, ({ query, repoId, page, pageSize }) => service.search(query, repoId, page, pageSize));
  read("box_detail", "查看云盘文件或目录详情。", { repoId: boxRepo, path: boxPath }, ({ repoId, path }) => service.detail(repoId, path));
  read("box_link", "返回云盘官方内部链接，供预览和在线编辑。", { repoId: boxRepo, path: boxPath }, ({ repoId, path }) => service.link(repoId, path));
  read("box_shares", "分页列出已有分享链接，含 url 与用于撤销的 id。", { repoId: boxRepo.optional(), path: boxPath.optional(), ...boxPage }, ({ repoId, path, page, pageSize }) => service.shares(repoId, path, page, pageSize));
  read("box_upload_links", "查询已有收集文件的上传链接。", { repoId: boxRepo.optional(), path: boxPath.optional() }, ({ repoId, path }) => service.uploadLinks(repoId, path));
  read("box_starred", "查询云盘收藏。", {}, () => service.starred());
  read("box_history", "分页查询资料库版本历史。", { repoId: boxRepo, ...boxPage }, ({ repoId, page, pageSize }) => service.history(repoId, page, pageSize));
  read("box_trash", "查询回收站，返回恢复标识和分页 cursor。", { repoId: boxRepo, path: boxPath.optional(), cursor: z.string().min(1).optional() }, ({ repoId, path, cursor }) => service.trash(repoId, path, cursor));
  read("box_deleted_repos", "查询可恢复的已删除资料库。", {}, () => service.deletedRepos());
  read("box_groups", "查询可共享的群组。", {}, () => service.groups());
  read("box_collaborators", "查询云盘目录或资料库的协作成员与权限。", { repoId: boxRepo, path: boxPath.optional(), type: z.enum(BOX_SHARE_TYPES).optional() }, ({ repoId, path, type }) => service.collaborators(repoId, path, type));
}
