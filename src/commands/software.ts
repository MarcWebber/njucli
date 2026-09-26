import type { Command } from "commander";

import type { NjuServices } from "../app/services.js";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../core/command.js";

export function registerSoftwareCommands(program: Command, service: NjuServices["software"], runtime: CommandRuntime): Command {
  const software = program.command("software").description("查询正版软件与下载官方安装包");
  addFormatOption(software.command("list [query]").description("查询南大正版软件目录"))
    .action((query: string | undefined, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.list(query);
      return { data, text: data.map((item) => `${item.id}\t${item.name}\t${item.url}`).join("\n") };
    }));
  addFormatOption(software.command("show <id>").description("列出官方说明链接与安装包 ID"))
    .action((id: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.show(id);
      return { data, text: [data.name, data.url,
        "官方说明：", ...data.links.map((link) => `${link.name}\t${link.url}`),
        "安装包（校内包需校园网或 VPN）：", ...data.files.map((file) => `${file.id}\t${file.url}`),
      ].join("\n") };
    }));
  addFormatOption(software.command("download <id> <file-id>").description("下载所选安装包到本地，安装授权按官方指引完成")
    .requiredOption("--output <path>", "本地保存路径"))
    .action((id: string, fileId: string, options: FormatOptions & { output: string }) => runCommand(runtime, options, async () => {
      const data = await service.download(id, fileId, options.output);
      return { data, text: `已保存 ${data.path}（${data.bytes} 字节）` };
    }));
  return software;
}
