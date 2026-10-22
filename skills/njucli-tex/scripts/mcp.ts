import { z } from 'zod';
import type { McpTool } from '../../../src/mcp/tools.js';
import type { TexServices } from './services.js';

export function registerTexTools(tool: McpTool, service: TexServices): void {
  tool("tex_projects", "List the student's TeXPage projects and current version identifiers.", { query: z.string().optional(), page: z.number().int().min(1).optional() }, ({ query, page }) => service.projects(query, page));
  tool("tex_templates", "List TeXPage templates without creating a project.", { page: z.number().int().min(1).optional() }, ({ page }) => service.templates(page));
  tool("tex_files", "List the file paths and identifiers in a TeX project version.", { projectKey: z.string().min(1), versionNo: z.string().min(1) }, ({ projectKey, versionNo }) => service.files(projectKey, versionNo));
  tool("tex_read", "Read an existing UTF-8 text file by its project file identifier.", { projectKey: z.string().min(1), versionNo: z.string().min(1), fileKey: z.string().min(1) }, ({ projectKey, versionNo, fileKey }) => service.read(projectKey, versionNo, fileKey));
  tool("tex_log", "Read the latest compiler log without starting a compilation.", { projectKey: z.string().min(1), versionNo: z.string().min(1) }, ({ projectKey, versionNo }) => service.log(projectKey, versionNo));
  const project = { projectKey: z.string().min(1), versionNo: z.string().min(1) };
  tool("tex_create", "创建空白 TeX 项目并核对结果。", { name: z.string().trim().min(1) }, ({ name }) => service.create(name), { destructiveHint: false });
  tool("tex_from_template", "按指定模板创建 TeX 项目并核对结果。", { templateKey: z.string().min(1) }, ({ templateKey }) => service.createFromTemplate(templateKey), { destructiveHint: false });
  tool("tex_rename", "重命名指定 TeX 项目并核对结果。", { projectKey: project.projectKey, name: z.string().trim().min(1) }, ({ projectKey, name }) => service.rename(projectKey, name), { destructiveHint: true });
  tool("tex_download", "下载指定版本的项目 ZIP，覆盖本地输出文件。", { ...project, output: z.string().min(1) }, ({ projectKey, versionNo, output }) => service.download(projectKey, versionNo, output), { destructiveHint: true });
  tool("tex_pdf", "下载最近编译的 PDF，覆盖本地输出文件。", { ...project, output: z.string().min(1) }, ({ projectKey, versionNo, output }) => service.pdf(projectKey, versionNo, output), { destructiveHint: true });
  tool("tex_compile", "编译指定 LaTeX 文件，核对本次编译结果并保存 PDF。", { ...project, path: z.string().min(1), output: z.string().min(1) }, ({ projectKey, versionNo, path, output }) => service.compile(projectKey, versionNo, path, output), { destructiveHint: true });
  tool("tex_write", "使用 content 正文替换指定项目文件并回读核对。", { ...project, path: z.string().min(1), content: z.string() }, ({ projectKey, versionNo, path, content }) => service.write(projectKey, versionNo, path, content), { destructiveHint: true });
  tool("tex_upload", "上传本地文件至项目根目录，同名文件覆盖并核对内容。", { ...project, input: z.string().min(1) }, ({ projectKey, versionNo, input }) => service.upload(projectKey, versionNo, input), { destructiveHint: true });
}
