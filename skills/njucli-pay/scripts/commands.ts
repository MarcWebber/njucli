import type { Command } from "commander";
import { z } from "zod";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../../../src/core/command.js";
import { addDays, parseCampusDate } from "../../../src/core/dates.js";
import { AppError } from "../../../src/core/errors.js";
import { optionalPositiveInteger } from "../../../src/core/options.js";
import type { McpTool } from "../../../src/mcp/tools.js";
import type { PayServices } from "./client.js";

function billRange(from?: string, to?: string) {
  const end = parseCampusDate(to ?? "tomorrow");
  const begin = from === undefined ? addDays(end, -30) : parseCampusDate(from);
  if (begin >= end) throw new AppError("INVALID_INPUT", "开始日期须早于截止日期");
  return { from: begin, to: end };
}

export function registerPayCommands(program: Command, service: PayServices, runtime: CommandRuntime): Command {
  const group = program.command("pay").description("校园卡余额与消费、充值记录");
  addFormatOption(group.command("balance").description("查询本人校园卡余额"))
    .action((options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service(client => client.balance());
      return { data, text: `校园卡余额：${data.balance.toFixed(2)} 元` };
    }));
  addFormatOption(group.command("bills").description("查询本人校园卡交易记录，默认最近 30 天，每页 200 条")
    .option("--from <date>", "开始日期 YYYY-MM-DD，含当日")
    .option("--to <date>", "截止日期 YYYY-MM-DD，不含当日，默认明天")
    .option("--page <number>", "页码，从 1 开始"))
    .action((options: FormatOptions & { from?: string; to?: string; page?: string }) => runCommand(runtime, options, async () => {
      const range = billRange(options.from, options.to);
      const page = optionalPositiveInteger(options.page, "--page") ?? 1;
      const data = await service(client => client.bills(range.from, range.to, page));
      const rows = data.bills.map(row => `${row.date} ${row.time}\t${row.description}\t${row.location}\t${row.amount.toFixed(2)} 元\t余额：${row.balance === null ? "未提供" : `${row.balance.toFixed(2)} 元`}`);
      return { data, text: [
        `${data.from} 至 ${data.to}（不含截止日），第 ${data.page} 页，共 ${data.total} 条`,
        ...(rows.length ? rows : ["本页无交易记录"]),
      ].join("\n") };
    }));
  return group;
}

export function registerPayTools(tool: McpTool, service: PayServices): void {
  tool("pay_balance", "查询本人校园卡余额，单位为元。", {}, () => service(client => client.balance()));
  tool("pay_bills", "查询本人校园卡消费与充值记录，默认最近 30 天，每页 200 条。", {
    from: z.string().optional().describe("开始日期 YYYY-MM-DD，含当日"),
    to: z.string().optional().describe("截止日期 YYYY-MM-DD，不含当日，默认明天"),
    page: z.number().int().positive().optional().describe("页码，从 1 开始"),
  }, args => {
    const range = billRange(args.from, args.to);
    return service(client => client.bills(range.from, range.to, args.page ?? 1));
  });
}
