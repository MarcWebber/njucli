import { z } from 'zod';
import type { ReadTool } from '../../../src/mcp/read.js';
import type { SoftwareClient } from './client.js';

export function registerSoftwareTools(read: ReadTool, service: SoftwareClient): void {
  read("software_list", "查询南京大学正版软件目录。", { query: z.string().optional() }, ({ query }) => service.list(query));
  read("software_show", "读取软件官方说明链接及安装包列表。", { id: z.string().min(1) }, ({ id }) => service.show(id));
}
