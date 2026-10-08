import { z } from 'zod';
import type { ReadTool } from '../../../src/mcp/read.js';
import type { TexServices } from './services.js';

export function registerTexTools(read: ReadTool, service: TexServices): void {
  read("tex_projects", "List the student's TeXPage projects and current version identifiers.", { query: z.string().optional(), page: z.number().int().min(1).optional() }, ({ query, page }) => service.projects(query, page));
  read("tex_templates", "List TeXPage templates without creating a project.", { page: z.number().int().min(1).optional() }, ({ page }) => service.templates(page));
  read("tex_files", "List the file paths and identifiers in a TeX project version.", { projectKey: z.string().min(1), versionNo: z.string().min(1) }, ({ projectKey, versionNo }) => service.files(projectKey, versionNo));
  read("tex_read", "Read an existing UTF-8 text file by its project file identifier.", { projectKey: z.string().min(1), versionNo: z.string().min(1), fileKey: z.string().min(1) }, ({ projectKey, versionNo, fileKey }) => service.read(projectKey, versionNo, fileKey));
  read("tex_log", "Read the latest compiler log without starting a compilation.", { projectKey: z.string().min(1), versionNo: z.string().min(1) }, ({ projectKey, versionNo }) => service.log(projectKey, versionNo));
}
