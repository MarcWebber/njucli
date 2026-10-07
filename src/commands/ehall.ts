import type { Command } from "commander";
import { readFile } from "node:fs/promises";

import type { NjuServices } from "../app/services.js";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../core/command.js";
import { AppError } from "../core/errors.js";
import type { EHallApplicationState, EHallTaskKind } from "../domains/ehall/types.js";
import { tripInputSchema } from "../domains/ehall/trip.js";
import { optionalPositiveInteger } from "./options.js";
import {
  ehallApplicationsText,
  ehallServiceLinkText,
  ehallServicesText,
  ehallTasksText,
} from "./text.js";

interface PageOptions extends FormatOptions {
  page?: string;
  pageSize?: string;
}

interface TripOptions extends FormatOptions {
  input?: string;
  holiday?: string;
  stay?: boolean;
  from?: string;
  to?: string;
  destination?: string;
  address?: string;
  transport?: string;
  serviceNumber?: string;
  returnTransport?: string;
  phone?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  onCampus?: boolean;
  offCampus?: boolean;
  residence?: string;
  dryRun?: boolean;
}

export function registerEHallCommands(
  program: Command,
  service: NjuServices["ehall"],
  runtime: CommandRuntime,
): Command {
  const ehall = program.command("ehall").description("网上办事大厅查询与行程填报");

  addFormatOption(ehall.command("trip").description("查询研究生节假日行程登记、默认联系方式与缺失信息"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.trip();
      const status = { open: "待填报", submitted: "已登记", closed: "当前无需登记" }[data.status];
      return { data, text: [
        `${data.holiday?.name ?? "行程登记"}：${status}`,
        ...(data.holiday ? [`假期：${data.holiday.from} 至 ${data.holiday.to}；登记截止：${data.holiday.deadline}`, `假期编号：${data.holiday.id}`] : []),
        data.missing.length ? `需补充：${data.missing.join("、")}` : "联系方式可复用已有登记；填写本次行程即可。",
        ...data.records.flatMap((r) => [
          `登记 ${r.id}：${r.stayOnCampus ? "全程留校" : `${r.from} 至 ${r.to}`}`,
          ...r.stops.map((s) => `  ${s.from} 至 ${s.to}：${s.destination}，${s.address}，${s.transport}${s.serviceNumber ? ` ${s.serviceNumber}` : ""}`),
        ]),
      ].join("\n") };
    }));

  addFormatOption(ehall.command("trip-submit").description("提交研究生节假日行程并回读核对")
    .option("--stay", "假期全程留校")
    .option("--from <date>", "离校日期 YYYY-MM-DD")
    .option("--to <date>", "返校日期 YYYY-MM-DD")
    .option("--destination <place>", "目的地市或区县")
    .option("--address <address>", "目的地详细地址，具体到门牌号")
    .option("--transport <transport>", "交通方式")
    .option("--service-number <number>", "车次、航班号或班次")
    .option("--return-transport <transport>", "返校交通方式")
    .option("--phone <phone>", "更新本人手机号，默认复用已有资料")
    .option("--emergency-contact <name>", "更新紧急联系人")
    .option("--emergency-phone <phone>", "更新紧急联系电话")
    .option("--on-campus", "目前住校")
    .option("--off-campus", "目前不住校")
    .option("--residence <address>", "目前校外居住地址")
    .option("--holiday <id>", "指定假期编号，默认当前开放假期")
    .option("--input <file>", "多段复杂行程的 JSON 文件，可选")
    .option("--dry-run", "读取默认信息并检查完整行程，返回预览"))
    .action(async (options: TripOptions) => runCommand(runtime, options, async () => {
      let value: unknown;
      if (options.input) {
        if (Object.entries(options).some(([key, v]) => !["input", "dryRun", "format"].includes(key) && v !== undefined)) {
          throw new AppError("INVALID_INPUT", "--input 与直接填写行程的参数不能同时使用");
        }
        try { value = JSON.parse(await readFile(options.input, "utf8")); }
        catch (error) {
          if (!(error instanceof SyntaxError)) throw error;
          throw new AppError("INVALID_INPUT", "行程文件不是有效 JSON");
        }
      } else {
        const hasTrip = [options.from, options.to, options.destination, options.address, options.transport, options.serviceNumber, options.returnTransport].some((v) => v !== undefined);
        if (options.stay && hasTrip) throw new AppError("INVALID_INPUT", "--stay 不能与外出行程参数同时使用");
        if (!options.stay && !hasTrip) throw new AppError("INVALID_INPUT", "请说明本次行程：全程留校用 --stay；外出提供 --from、--to、--destination、--address、--transport");
        if (options.onCampus && options.offCampus) throw new AppError("INVALID_INPUT", "--on-campus 与 --off-campus 不能同时使用");
        value = {
          holidayId: options.holiday, stayOnCampus: options.stay ?? false,
          phone: options.phone, emergencyContact: options.emergencyContact, emergencyPhone: options.emergencyPhone,
          onCampus: options.onCampus ? true : options.offCampus ? false : undefined, residence: options.residence,
          trips: options.stay ? [] : [{ returnTransport: options.returnTransport, stops: [{
            from: options.from, to: options.to, destination: options.destination, address: options.address,
            transport: options.transport, serviceNumber: options.serviceNumber,
          }] }],
        };
      }
      const parsed = tripInputSchema.safeParse(value);
      if (!parsed.success) throw new AppError("INVALID_INPUT", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("；"));
      const data = await service.submitTrip(parsed.data, options.dryRun);
      return { data, text: data.submitted
        ? `${data.plan.holiday.name}行程已提交并核对，登记编号：${data.recordId}`
        : [
          `${data.plan.holiday.name}行程检查通过（预览）：${data.plan.stayOnCampus ? "全程留校" : `${data.plan.trips.length} 段离返校行程`}`,
          ...data.plan.trips.flatMap((t) => t.stops.map((s) => `${s.from} 至 ${s.to}：${s.destination.name}，${s.address}，${s.transport.name}${s.serviceNumber ? ` ${s.serviceNumber}` : ""}`)),
        ].join("\n") };
    }));

  addFormatOption(ehall.command("services [query]").description("搜索可用服务入口"))
    .action(async (query: string | undefined, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.services(query);
      return { data, text: ehallServicesText(data) };
    }));

  addFormatOption(ehall.command("tasks").description("查询待办、已办或我发起的任务")
    .option("--kind <kind>", "任务类型：todo、done 或 started", "todo")
    .option("--page <page>", "页码")
    .option("--page-size <size>", "每页条数"))
    .action(async (options: PageOptions & { kind: string }) => runCommand(runtime, options, async () => {
      const data = await service.tasks(
        taskKind(options.kind),
        optionalPositiveInteger(options.page, "--page"),
        optionalPositiveInteger(options.pageSize, "--page-size"),
      );
      return { data, text: ehallTasksText(data) };
    }));

  addFormatOption(ehall.command("applications").description("查询我发起的办件")
    .option("--state <state>", "办件状态：active、completed 或 cancelled", "active")
    .option("--page <page>", "页码")
    .option("--page-size <size>", "每页条数"))
    .action(async (options: PageOptions & { state: string }) => runCommand(runtime, options, async () => {
      const data = await service.applications(
        applicationState(options.state),
        optionalPositiveInteger(options.page, "--page"),
        optionalPositiveInteger(options.pageSize, "--page-size"),
      );
      return { data, text: ehallApplicationsText(data) };
    }));

  addFormatOption(ehall.command("link <app-id>").description("返回官方应用入口，不填写或提交表单"))
    .action(async (appId: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.serviceLink(appId);
      return { data, text: ehallServiceLinkText(data) };
    }));

  return ehall;
}

function taskKind(value: string): EHallTaskKind {
  if (value === "todo" || value === "done" || value === "started") return value;
  throw new AppError("INVALID_INPUT", `不支持的任务类型：${value}`);
}

function applicationState(value: string): EHallApplicationState {
  if (value === "active" || value === "completed" || value === "cancelled") return value;
  throw new AppError("INVALID_INPUT", `不支持的办件状态：${value}`);
}
