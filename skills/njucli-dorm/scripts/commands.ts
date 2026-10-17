import type { Command } from "commander";
import { z } from "zod";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../../../src/core/command.js";
import { parseCampusDate } from "../../../src/core/dates.js";
import { AppError } from "../../../src/core/errors.js";
import { requiredText } from "../../../src/core/guards.js";
import type { ReadTool } from "../../../src/mcp/read.js";
import type { DormServices } from "./client.js";

function campusId(input: string): number {
  const id = Number(input);
  if (!Number.isSafeInteger(id) || id <= 0) throw new AppError("INVALID_INPUT", "校区 ID 须为 campuses 返回的正整数");
  return id;
}

function billRange(from?: string, to?: string) {
  const end = parseCampusDate(to);
  const start = new Date(`${end}T00:00:00.000Z`);
  start.setUTCDate(1);
  start.setUTCMonth(start.getUTCMonth() - 2);
  const begin = from === undefined ? start.toISOString().slice(0, 10) : parseCampusDate(from);
  if (begin > end) throw new AppError("INVALID_INPUT", "开始日期须早于或等于结束日期");
  return { from: begin, to: end };
}

function directory(data: Array<{ id: string | number; name: string }>) {
  return { data, text: data.length ? data.map(row => `${row.id}\t${row.name}`).join("\n") : "暂无目录记录" };
}

export function registerDormCommands(program: Command, service: DormServices, runtime: CommandRuntime): Command {
  const group = program.command("dorm").description("宿舍电费目录与本人充值记录查询");
  addFormatOption(group.command("campuses").description("查询电费系统支持的校区及 ID"))
    .action((options: FormatOptions) => runCommand(runtime, options, async () => directory(await service(client => client.campuses()))));
  addFormatOption(group.command("buildings <campus-id>").description("查询校区的宿舍楼栋"))
    .action((campus: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const id = campusId(campus);
      return directory(await service(client => client.buildings(id)));
    }));
  addFormatOption(group.command("rooms <campus-id> <building-id>").description("查询楼栋的电费房间目录"))
    .action((campus: string, building: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const id = campusId(campus);
      const target = requiredText(building, "楼栋 ID");
      return directory(await service(client => client.rooms(id, target)));
    }));
  addFormatOption(group.command("bills").description("查询本人电费充值记录，默认本月及前两个月至今天")
    .option("--from <date>", "开始日期 YYYY-MM-DD")
    .option("--to <date>", "结束日期 YYYY-MM-DD，默认今天"))
    .action((options: FormatOptions & { from?: string; to?: string }) => runCommand(runtime, options, async () => {
      const range = billRange(options.from, options.to);
      const bills = await service(client => client.bills(range.from, range.to));
      return {
        data: { ...range, bills },
        text: bills.length ? bills.map(row => `${row.paidAt}\t${row.campus}\t${row.building}\t${row.room}\t${row.amount.toFixed(2)} 元\t${row.status}`).join("\n")
          : `${range.from} 至 ${range.to} 暂无电费充值记录`,
      };
    }));
  return group;
}

export function registerDormTools(read: ReadTool, service: DormServices): void {
  read("dorm_campuses", "查询宿舍电费系统支持的校区及 ID。", {}, () => service(client => client.campuses()));
  const campus = z.number().int().positive().describe("campuses 返回的校区 ID");
  read("dorm_buildings", "查询指定校区的宿舍楼栋。", { campus }, args => service(client => client.buildings(args.campus)));
  read("dorm_rooms", "查询楼栋的电费房间目录。", { campus, building: z.string().trim().min(1) }, args => service(client => client.rooms(args.campus, args.building)));
  read("dorm_bills", "查询本人电费充值记录，默认本月及前两个月至今天。", {
    from: z.string().optional(), to: z.string().optional(),
  }, async args => {
    const range = billRange(args.from, args.to);
    return { ...range, bills: await service(client => client.bills(range.from, range.to)) };
  });
}
