import { readFile } from "node:fs/promises";
import type { Command } from "commander";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../../../src/core/command.js";
import { AppError } from "../../../src/core/errors.js";
import type { ItxiaClient, ItxiaOrder } from "./client.js";
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
      catch { throw new AppError("INVALID_INPUT", "预约信息文件需要合法 JSON"); }
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
        if (options.name !== undefined || options.phone !== undefined) throw new AppError("INVALID_INPUT", "请选择预约单编号，或姓名和手机号这一组查询条件");
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
  return itxia;
}

function orderText(data: ItxiaOrder): string {
  return [
    `预约单 ${data.id} · ${data.statusText}`,
    `查看链接：${data.url}（填写预约时的姓名和手机号查看本单）`,
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
