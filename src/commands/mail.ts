import input from "@inquirer/input";
import password from "@inquirer/password";
import type { Command } from "commander";

import type { NjuServices } from "../app/services.js";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../core/command.js";
import { requireConfirmation } from "../core/confirmation.js";
import { AppError } from "../core/errors.js";
import { optionalPositiveInteger } from "./options.js";

type ListOptions = FormatOptions & { folder?: string; unread?: boolean; limit?: string; before?: string };

export function registerMailCommands(program: Command, service: NjuServices["mail"], runtime: CommandRuntime): Command {
  const mail = program.command("mail").description("绑定校园邮箱、查询邮件和下载附件（不修改已读状态）");
  addFormatOption(mail.command("bind").description("在本机隐藏输入客户端专用密码，验证后存入系统钥匙串"))
    .action((options: FormatOptions) => runCommand(runtime, options, async () => {
      if (!process.stdin.isTTY) throw new AppError("USER_ACTION_REQUIRED", "请在本机交互终端运行 njucli mail bind");
      const context = { output: process.stderr };
      process.stderr.write("首次请在 https://mail.nju.edu.cn/ 的设置中开启 IMAP 并生成客户端专用密码。不要输入校园 SSO 密码。\n");
      const address = await input({ message: "校园邮箱完整地址", validate: (value) => /^[^\s@]+@(?:smail\.)?nju\.edu\.cn$/i.test(value.trim()) || "请输入南大邮箱地址" }, context);
      const secret = await password({ message: "客户端专用密码", validate: (value) => value.length > 0 || "请输入专用密码" }, context);
      const data = await service.bind(address, secret);
      return { data, text: `已绑定 ${data.address}，后续查询直接使用 IMAP` };
    }));

  addFormatOption(mail.command("status").description("查看本机绑定信息，不连接邮箱"))
    .action((options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.status();
      return { data, text: data.bound ? `已绑定 ${data.address}` : "尚未绑定，运行 njucli mail bind" };
    }));

  addFormatOption(mail.command("unbind").description("删除本机保存的邮箱凭据，不更改服务端设置").option("--yes", "确认解绑"))
    .action((options: FormatOptions & { yes?: boolean }) => runCommand(runtime, options, async () => {
      requireConfirmation(options.yes === true);
      const data = await service.unbind();
      return { data, text: data.removed ? "已删除本机邮箱凭据" : "没有已保存的邮箱凭据" };
    }));

  addFormatOption(mail.command("folders").description("列出邮件夹路径"))
    .action((options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.folders();
      return { data, text: data.map((item) => `${item.path}\t${item.selectable ? "可查询" : "目录"}`).join("\n") || "无" };
    }));

  listOptions(mail.command("list").description("按新到旧列出邮件"))
    .action((options: ListOptions) => runCommand(runtime, options, async () => {
      const data = await service.list(queryOptions(options));
      return { data, text: listText(data) };
    }));

  listOptions(mail.command("search <query>").description("搜索邮件头和正文"))
    .action((query: string, options: ListOptions) => runCommand(runtime, options, async () => {
      const data = await service.search(query, queryOptions(options));
      return { data, text: listText(data) };
    }));

  addFormatOption(mail.command("read <id>").description("读取一封邮件正文和附件编号"))
    .action((id: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.read(id);
      return { data, text: [data.subject, data.text, ...data.attachments.map((file) => `附件 ${file.id}\t${file.name ?? "未命名"}\t${file.bytes} bytes`)].join("\n") };
    }));

  addFormatOption(mail.command("download <id> <attachment>").description("下载指定附件到本地，替换输出文件")
    .requiredOption("--output <path>", "保存路径"))
    .action((id: string, attachment: string, options: FormatOptions & { output: string }) => runCommand(runtime, options, async () => {
      const data = await service.download(id, optionalPositiveInteger(attachment, "attachment")!, options.output);
      return { data, text: `${data.path}\t${data.bytes} bytes` };
    }));
  return mail;
}

function listOptions(command: Command) {
  return addFormatOption(command.option("--folder <path>", "邮件夹路径，默认 INBOX").option("--unread", "只查未读")
    .option("--limit <count>", "条数，默认 20").option("--before <uid>", "使用上页的 nextBefore 继续查询"));
}

function queryOptions(options: ListOptions) {
  return { folder: options.folder, unread: options.unread,
    limit: optionalPositiveInteger(options.limit, "--limit"), before: optionalPositiveInteger(options.before, "--before") };
}

function listText(data: Awaited<ReturnType<NjuServices["mail"]["list"]>>) {
  return [...data.items.map((item) => `${item.unread ? "未读" : "已读"}\t${item.subject}\t${item.date ?? ""}\t${item.id}`),
    ...(data.nextBefore === null ? [] : [`下一页：--before ${data.nextBefore}`])].join("\n") || "无";
}
