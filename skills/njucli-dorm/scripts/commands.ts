import type { Command } from "commander";
import { z } from "zod";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../../../src/core/command.js";
import { parseCampusDate } from "../../../src/core/dates.js";
import { AppError } from "../../../src/core/errors.js";
import { requiredText } from "../../../src/core/guards.js";
import type { ReadTool } from "../../../src/mcp/read.js";
import type { DormClient, DormServices } from "./client.js";

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

function bindingText(row: Awaited<ReturnType<DormClient["bindings"]>>[number]) {
  return `${row.id}\t${row.campus}\t${row.building}\t${row.room}`;
}

export function registerDormCommands(program: Command, service: DormServices, runtime: CommandRuntime): Command {
  const group = program.command("dorm").description("宿舍电费绑定、充值记录与住宿查询");
  addFormatOption(group.command("bindings").description("查看当前账号已绑定的电费房间及绑定 ID"))
    .action((options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.electricity(client => client.bindings());
      return { data, text: data.length ? data.map(bindingText).join("\n") : "当前账号尚未绑定电费房间" };
    }));
  addFormatOption(group.command("bind <campus-id> <building-id> <room-id>").description("绑定电费房间并回读确认")
    .option("--replace <binding-id>", "修改 bindings 返回的现有绑定记录"))
    .action((campus: string, building: string, room: string, options: FormatOptions & { replace?: string }) => runCommand(runtime, options, async () => {
      const id = campusId(campus);
      const buildingId = requiredText(building, "楼栋 ID");
      const roomId = requiredText(room, "房间 ID");
      const replace = options.replace === undefined ? undefined : requiredText(options.replace, "绑定 ID");
      const data = await service.electricity(client => client.bind(id, buildingId, roomId, replace));
      return { data, text: `已绑定：${bindingText(data)}` };
    }));
  addFormatOption(group.command("unbind <binding-id>").description("解除当前账号的电费房间绑定并回读确认"))
    .action((binding: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const id = requiredText(binding, "绑定 ID");
      const data = await service.electricity(client => client.unbind(id));
      return { data, text: `已解除绑定：${data.id}` };
    }));
  addFormatOption(group.command("housing").description("查询本人分配的住宿地址"))
    .action((options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.housing(client => client.addresses());
      return { data, text: data.length ? data.map(row => row.address).join("\n") : "暂无住宿地址" };
    }));
  addFormatOption(group.command("applications").description("查询本人的住宿申请及审核状态"))
    .action((options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.housing(client => client.applications());
      return { data, text: data.length ? data.map(row => `${row.id}\t${row.type}\t${row.appliedAt}\t${row.status}`).join("\n") : "暂无住宿申请记录" };
    }));
  addFormatOption(group.command("campuses").description("查询电费系统支持的校区及 ID"))
    .action((options: FormatOptions) => runCommand(runtime, options, async () => directory(await service.electricity(client => client.campuses()))));
  addFormatOption(group.command("buildings <campus-id>").description("查询校区的宿舍楼栋"))
    .action((campus: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const id = campusId(campus);
      return directory(await service.electricity(client => client.buildings(id)));
    }));
  addFormatOption(group.command("rooms <campus-id> <building-id>").description("查询楼栋的电费房间目录"))
    .action((campus: string, building: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const id = campusId(campus);
      const target = requiredText(building, "楼栋 ID");
      return directory(await service.electricity(client => client.rooms(id, target)));
    }));
  addFormatOption(group.command("bills").description("查询本人电费充值记录，默认本月及前两个月至今天")
    .option("--from <date>", "开始日期 YYYY-MM-DD")
    .option("--to <date>", "结束日期 YYYY-MM-DD，默认今天"))
    .action((options: FormatOptions & { from?: string; to?: string }) => runCommand(runtime, options, async () => {
      const range = billRange(options.from, options.to);
      const bills = await service.electricity(client => client.bills(range.from, range.to));
      return {
        data: { ...range, bills },
        text: bills.length ? bills.map(row => `${row.paidAt}\t${row.campus}\t${row.building}\t${row.room}\t${row.amount.toFixed(2)} 元\t${row.status}`).join("\n")
          : `${range.from} 至 ${range.to} 暂无电费充值记录`,
      };
    }));
  return group;
}

export function registerDormTools(read: ReadTool, service: DormServices): void {
  read("dorm_bindings", "查询当前账号已绑定的电费房间及绑定 ID。", {}, () => service.electricity(client => client.bindings()));
  read("dorm_housing", "查询本人分配的住宿地址。", {}, () => service.housing(client => client.addresses()));
  read("dorm_applications", "查询本人的住宿申请及审核状态。", {}, () => service.housing(client => client.applications()));
  read("dorm_campuses", "查询宿舍电费系统支持的校区及 ID。", {}, () => service.electricity(client => client.campuses()));
  const campus = z.number().int().positive().describe("campuses 返回的校区 ID");
  read("dorm_buildings", "查询指定校区的宿舍楼栋。", { campus }, args => service.electricity(client => client.buildings(args.campus)));
  read("dorm_rooms", "查询楼栋的电费房间目录。", { campus, building: z.string().trim().min(1) }, args => service.electricity(client => client.rooms(args.campus, args.building)));
  read("dorm_bills", "查询本人电费充值记录，默认本月及前两个月至今天。", {
    from: z.string().optional(), to: z.string().optional(),
  }, async args => {
    const range = billRange(args.from, args.to);
    return { ...range, bills: await service.electricity(client => client.bills(range.from, range.to)) };
  });
}
