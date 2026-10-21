import { z } from "zod";
import type { McpTool } from "../../../src/mcp/tools.js";
import type { InstitutionClient } from "./client.js";

export function registerInstitutionTools(tool: McpTool, service: InstitutionClient): void {
  const query = z.string().optional().describe("姓名、职称/身份、单位、联系方式或研究方向等关键词");
  const institution = z.string().min(1).optional().describe("机构 ID 或完整名称");
  const limit = z.number().int().min(1).max(100).optional();
  const offset = z.number().int().min(0).optional();
  const live = z.boolean().optional().describe("读取官方来源的当前内容，默认使用本地快照");
  tool("institution_list", "列出学校机构与官网入口。", { query, live }, ({ query, live }) => service.list(query, live));
  tool("institution_show", "读取学院简介。", { id: z.string().min(1), live }, ({ id, live }) => service.show(id, live));
  tool("institution_teachers", "从本地快照按姓名、职称/身份、单位、联系方式或研究方向检索教师。", { query, institution, limit, offset }, ({ query, ...options }) => service.teachers(query, options));
  tool("institution_teacher", "按教师 ID 读取基础信息。", { id: z.string().min(1), live }, ({ id, live }) => service.teacher(id, live));
  tool("institution_search", "检索学院与教师基础信息的本地快照。", { query: z.string().min(1), institution, kind: z.enum(["overview", "teacher"]).optional(), limit, offset }, ({ query, ...options }) => service.search(query, options));
  tool("institution_services", "查询后勤单位、部门和办公电话。", { query, live }, ({ query, live }) => service.services(query, live));
  tool("institution_dump", "导出本地机构与教师资料快照为 JSON 和 Markdown，覆盖指定目录的同名文件。", {
    output: z.string().min(1),
  }, ({ output }) => service.dump(output), { destructiveHint: true });
}
