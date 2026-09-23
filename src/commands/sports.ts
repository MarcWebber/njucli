import type { Command } from "commander";

import type { NjuServices } from "../app/services.js";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../core/command.js";
import {
  optionalNonNegativeInteger,
  optionalPositiveInteger,
} from "./options.js";
import {
  sportsBookingText,
  sportsBookingsText,
  sportsReservationLinkText,
  sportsSlotsText,
  sportsVenueText,
  sportsVenuesText,
} from "./text.js";

export function registerSportsCommands(
  program: Command,
  service: NjuServices["sports"],
  runtime: CommandRuntime,
): Command {
  const sports = program.command("sports").description("查询体育场馆与预约记录");

  addFormatOption(sports.command("venues").description("列出体育场馆").option("--sport-id <id>", "运动类型 ID"))
    .action(async (options: FormatOptions & { sportId?: string }) => runCommand(runtime, options, async () => {
      const parsedSportId = optionalPositiveInteger(options.sportId, "--sport-id");
      const data = await service.venues(
        parsedSportId === undefined ? undefined : String(parsedSportId),
      );
      return { data, text: sportsVenuesText(data) };
    }));

  addFormatOption(sports.command("venue <venue-site-id>").description("读取一个场地详情"))
    .action(async (venueSiteId: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.venue(venueSiteId);
      return { data, text: sportsVenueText(data) };
    }));

  addFormatOption(sports.command("slots").description("查询场地时段")
    .requiredOption("--venue-site <id>", "场地 ID")
    .requiredOption("--date <date>", "日期，例如 2026-09-07 或 tomorrow"))
    .action(async (options: FormatOptions & { venueSite: string; date: string }) => runCommand(runtime, options, async () => {
      const data = await service.slots(options.venueSite, options.date);
      return { data, text: sportsSlotsText(data) };
    }));

  addFormatOption(sports.command("reserve-link").description("生成官方预约链接")
    .requiredOption("--venue-site <id>", "场地 ID")
    .requiredOption("--date <date>", "日期，例如 2026-09-07 或 tomorrow"))
    .action(async (options: FormatOptions & { venueSite: string; date: string }) => runCommand(runtime, options, async () => {
      const data = await service.reservationLink(options.venueSite, options.date);
      return { data, text: sportsReservationLinkText(data) };
    }));

  addFormatOption(sports.command("bookings").description("查询我的体育预约")
    .option("--page <page>", "页码")
    .option("--size <size>", "每页条数"))
    .action(async (options: FormatOptions & { page?: string; size?: string }) => runCommand(runtime, options, async () => {
      const page = optionalNonNegativeInteger(options.page, "--page");
      const size = optionalPositiveInteger(options.size, "--size");
      const data = await service.bookings(page, size);
      return { data, text: sportsBookingsText(data) };
    }));

  addFormatOption(sports.command("cancel-link <booking-id>").description("返回官方预约记录页，继续取消指定订单（不执行取消）"))
    .action(async (bookingId: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.cancellationLink(bookingId);
      return { data, text: `请在官方预约记录页找到订单 ${data.bookingId}，按页面规则取消：${data.url}\n尚未取消订单。` };
    }));

  addFormatOption(sports.command("booking <booking-id>").description("读取一个预约详情"))
    .action(async (bookingId: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.booking(bookingId);
      return { data, text: sportsBookingText(data) };
    }));

  return sports;
}
