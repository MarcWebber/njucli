import { readFile } from "node:fs/promises";
import type { Command } from "commander";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../../../src/core/command.js";
import { AppError } from "../../../src/core/errors.js";
import { orderLinks, type ItxiaClient, type ItxiaOrder } from "./client.js";
import { identityInput, orderId, orderInput } from "./schema.js";

export function registerItxiaCommands(program: Command, service: ItxiaClient, runtime: CommandRuntime): Command {
  const itxia = program.command("itxia").description("IT 侠电脑维修预约与进度查询");
  addFormatOption(itxia.command("create").description("提交维修预约并回读确认")
    .requiredOption("--input <path>", "预约信息 JSON 文件，字段见 IT 侠 Skill")
    .option("--agree-terms", "已阅读并同意预约须知与服务条款"))
    .action((options: FormatOptions & { input: string; agreeTerms?: boolean }) => runCommand(runtime, options, async () => {
      if (!options.agreeTerms) throw new AppError("INVALID_INPUT", "请阅读预约须知与服务条款，同意后使用 --agree-terms 提交");
      const content = await readFile(options.input, "utf8");
      let value: unknown;
      try { value = JSON.parse(content); }
      catch { throw new AppError("INVALID_INPUT", "预约信息文件必须为合法的 JSON 格式"); }
      const parsed = orderInput.safeParse(value);
      if (!parsed.success) throw new AppError("INVALID_INPUT", "请核对预约信息字段", { details: parsed.error.issues });
      const data = await service.create(parsed.data);
      return { data, text: `预约已提交并核对\n${orderText(data)}` };
    }));

  addFormatOption(itxia.command("status [id]").description("按编号查询；或用预约时的姓名和手机号找回当前预约")
    .option("--name <name>", "预约时的姓名").option("--phone <phone>", "预约时的手机号"))
    .action((id: string | undefined, options: FormatOptions & { name?: string; phone?: string }) => runCommand(runtime, options, async () => {
      let data: ItxiaOrder;
      if (id !== undefined) {
        if (options.name !== undefined || options.phone !== undefined) throw new AppError("INVALID_INPUT", "请在预约单编号与“姓名和手机号”之间二选一，不可同时提供");
        const parsed = orderId.safeParse(id);
        if (!parsed.success) throw new AppError("INVALID_INPUT", "请填写预约单编号");
        data = await service.status(parsed.data);
      } else {
        const parsed = identityInput.safeParse(options);
        if (!parsed.success) throw new AppError("INVALID_INPUT", "请填写预约单编号，或同时提供 --name 和 --phone");
        data = await service.retrieve(parsed.data);
      }
      return { data, text: orderText(data) };
    }));
  addFormatOption(itxia.command("open <id>").description("输出打开预约单页面的链接与方法（不发起请求）"))
    .action((id: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const parsed = orderId.safeParse(id);
      if (!parsed.success) throw new AppError("INVALID_INPUT", "请填写预约单编号");
      const data = { id: parsed.data, ...orderLinks(parsed.data) };
      return { data, text: linkText(data) };
    }));

  addFormatOption(itxia.command("cancel <id>").description("取消预约（不可撤销，需 --yes 确认）")
    .option("--yes", "确认取消该预约单"))
    .action((id: string, options: FormatOptions & { yes?: boolean }) => runCommand(runtime, options, async () => {
      if (!options.yes) throw new AppError("INVALID_INPUT", "取消预约后无法恢复，请确认后使用 --yes 执行");
      const parsed = orderId.safeParse(id);
      if (!parsed.success) throw new AppError("INVALID_INPUT", "请填写预约单编号");
      const data = await service.cancel(parsed.data);
      return { data, text: `预约已取消\n${orderText(data)}` };
    }));
  return itxia;
}

function linkText(data: { id: string; url: string; openScript: string; retrieveUrl: string }): string {
  return [
    `预约单页面：${data.url}`,
    `打开方法：在已访问的 itxia.nju.edu.cn 页面按 F12 打开控制台，运行以下代码：`,
    `  ${data.openScript}`,
    `或在 ${data.retrieveUrl} 填写预约时的姓名和手机号找回本单。`,
  ].join("\n");
}

function orderText(data: ItxiaOrder): string {
  return [
    `预约单 ${data.id} · ${data.statusText}`,
    linkText(data),
    `${data.campusName} · ${data.brandModel} · ${data.os}`,
    `提交时间：${data.createTime}`,
    ...(data.handler ? [`处理人：${data.handler}`] : []),
    ...(data.freeTime ? [`空闲时间：${data.freeTime}`] : []),
    `问题描述：${data.description}`,
    ...data.attachments.map((item) => `附件：${item.fileName}`),
    `回复记录（${data.replies.length} 条）`,
    ...data.replies.map((reply) => [
      `${reply.createTime} · ${reply.author}`, reply.content,
      ...reply.attachments.map((item) => `附件：${item.fileName}`),
    ].join("\n")),
  ].join("\n");
}
