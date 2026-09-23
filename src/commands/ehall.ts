import type { Command } from "commander";

import type { NjuServices } from "../app/services.js";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../core/command.js";
import { AppError } from "../core/errors.js";
import type { EHallApplicationState, EHallTaskKind } from "../domains/ehall/types.js";
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

export function registerEHallCommands(
  program: Command,
  service: NjuServices["ehall"],
  runtime: CommandRuntime,
): Command {
  const ehall = program.command("ehall").description("查询网上办事大厅服务与流程");

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
