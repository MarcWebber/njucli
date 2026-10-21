import { z } from 'zod';
import type { McpTool } from '../../../src/mcp/tools.js';
import type { SoftwareClient } from './client.js';

export function registerSoftwareTools(tool: McpTool, service: SoftwareClient): void {
  tool("software_list", "查询南京大学正版软件目录。", { query: z.string().optional() }, ({ query }) => service.list(query));
  tool("software_show", "读取软件官方说明链接及安装包列表。", { id: z.string().min(1) }, ({ id }) => service.show(id));
  tool("software_download", "下载所选校园软件安装包，覆盖本地输出文件。", {
    id: z.string().min(1), fileId: z.string().min(1), output: z.string().min(1),
  }, ({ id, fileId, output }) => service.download(id, fileId, output), { destructiveHint: true });

}
