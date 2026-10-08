import type { Command } from "commander";

import type { TexServices } from './services.js';
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../../../src/core/command.js";
import type { TexProject } from "./types.js";
import { optionalPositiveInteger } from "../../../src/core/options.js";

export function registerTexCommands(
  program: Command,
  service: TexServices,
  runtime: CommandRuntime,
): Command {
  const tex = program.command("tex").description("使用南京大学 TeXPage 写作平台");

  addFormatOption(tex.command("templates").description("列出官方 LaTeX 模板及其模板编号")
    .option("--page <page>", "页码"))
    .action(async (options: FormatOptions & { page?: string }) => runCommand(runtime, options, async () => {
      const data = await service.templates(optionalPositiveInteger(options.page, "--page"));
      return { data, text: [
        ...data.items.map((item) => `${item.name}\t${item.key}`),
        ...(data.hasMore ? ["还有下一页，使用 --page 继续查询"] : []),
      ].join("\n") || "无" };
    }));

  addFormatOption(tex.command("projects [query]").description("列出或搜索我的 TeX 项目")
    .option("--page <page>", "页码"))
    .action(async (query: string | undefined, options: FormatOptions & { page?: string }) => runCommand(runtime, options, async () => {
      const data = await service.projects(query, optionalPositiveInteger(options.page, "--page"));
      return {
        data,
        text: [
          ...data.items.map(projectText),
          ...(data.hasMore ? ["还有下一页，使用 --page 继续查询"] : []),
        ].join("\n") || "无",
      };
    }));

  addFormatOption(tex.command("create <name>").description("新建空白 TeX 项目并核对创建结果"))
    .action(async (name: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.create(name);
      return { data, text: projectText(data) };
    }));

  addFormatOption(tex.command("from-template <template-key>").description("按模板新建 TeX 项目并核对创建结果"))
    .action(async (templateKey: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.createFromTemplate(templateKey);
      return { data, text: projectText(data) };
    }));

  addFormatOption(tex.command("rename <project-key> <name>").description("重命名 TeX 项目并核对修改结果"))
    .action(async (projectKey: string, name: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.rename(projectKey, name);
      return { data, text: projectText(data) };
    }));

  addFormatOption(tex.command("download <project-key>").description("下载指定版本的 TeX 项目 ZIP，替换指定输出文件")
    .requiredOption("--version <version-no>", "projects 返回的版本号")
    .requiredOption("--output <path>", "保存路径"))
    .action(async (projectKey: string, options: FormatOptions & { version: string; output: string }) => runCommand(runtime, options, async () => {
      const data = await service.download(projectKey, options.version, options.output);
      return { data, text: `${data.path}\t${data.bytes} bytes` };
    }));

  addFormatOption(tex.command("files <project-key>").description("列出指定版本的项目文件")
    .requiredOption("--version <version-no>", "projects 返回的版本号"))
    .action(async (projectKey: string, options: FormatOptions & { version: string }) => runCommand(runtime, options, async () => {
      const data = await service.files(projectKey, options.version);
      return {
        data,
        text: data.map((file) => `${file.isDir ? "目录" : "文件"}\t${file.path}\t${file.fileKey}`).join("\n") || "无",
      };
    }));

  addFormatOption(tex.command("pdf <project-key>").description("下载最近编译的 PDF，替换指定输出文件")
    .requiredOption("--version <version-no>", "projects 返回的版本号")
    .requiredOption("--output <path>", "PDF 保存路径"))
    .action(async (projectKey: string, options: FormatOptions & { version: string; output: string }) => runCommand(runtime, options, async () => {
      const data = await service.pdf(projectKey, options.version, options.output);
      return { data, text: `${data.path}\t${data.bytes} bytes` };
    }));

  addFormatOption(tex.command("compile <project-key> <file-path>").description("编译指定 LaTeX 文件并下载 PDF，替换指定输出文件")
    .requiredOption("--version <version-no>", "projects 返回的版本号")
    .requiredOption("--output <path>", "PDF 保存路径"))
    .action(async (projectKey: string, filePath: string, options: FormatOptions & { version: string; output: string }) => runCommand(runtime, options, async () => {
      const data = await service.compile(projectKey, options.version, filePath, options.output);
      return { data, text: `${data.path}\t${data.bytes} bytes` };
    }));

  addFormatOption(tex.command("log <project-key>").description("读取最近一次编译日志，供定位 LaTeX 错误")
    .requiredOption("--version <version-no>", "projects 返回的版本号"))
    .action(async (projectKey: string, options: FormatOptions & { version: string }) => runCommand(runtime, options, async () => {
      const data = await service.log(projectKey, options.version);
      return { data, text: data };
    }));

  addFormatOption(tex.command("read <project-key> <file-key>").description("读取项目文本文件正文")
    .requiredOption("--version <version-no>", "projects 返回的版本号"))
    .action(async (projectKey: string, fileKey: string, options: FormatOptions & { version: string }) => runCommand(runtime, options, async () => {
      const data = await service.read(projectKey, options.version, fileKey);
      return { data, text: data };
    }));

  addFormatOption(tex.command("write <project-key> <file-path>").description("用本地 UTF-8 正文替换项目文件并核对保存结果")
    .requiredOption("--version <version-no>", "projects 返回的版本号")
    .requiredOption("--input <local-path>", "本地 UTF-8 文件路径"))
    .action(async (projectKey: string, filePath: string, options: FormatOptions & { version: string; input: string }) => runCommand(runtime, options, async () => {
      const data = await service.write(projectKey, options.version, filePath, options.input);
      return { data, text: `${data.path}\t${data.bytes} bytes` };
    }));

  addFormatOption(tex.command("upload <project-key> <local-file>").description("上传单个文件到项目根目录，同名文件直接替换并核对内容")
    .requiredOption("--version <version-no>", "projects 返回的版本号"))
    .action(async (projectKey: string, localFile: string, options: FormatOptions & { version: string }) => runCommand(runtime, options, async () => {
      const data = await service.upload(projectKey, options.version, localFile);
      return { data, text: `${data.path}\t${data.fileKey}\t${data.bytes} bytes` };
    }));

  return tex;
}

function projectText(project: TexProject): string {
  return `${project.name}\t${project.projectKey}\t${project.versionNo}\t${project.url}`;
}
