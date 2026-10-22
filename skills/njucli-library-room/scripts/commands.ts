import type { Command } from "commander";
import { z } from "zod";
import type { McpTool } from "../../../src/mcp/tools.js";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../../../src/core/command.js";
import { readJsonFile } from "../../../src/core/fs.js";
import { roomBookingInput, type LibraryRoomServices } from "./rooms.js";

const positive = z.coerce.number().int().positive();
const text = z.string().trim().min(1);
const output = <T>(data: T) => ({ data, text: JSON.stringify(data, null, 2) });

export function registerLibraryRoomCommands(program: Command, service: LibraryRoomServices, runtime: CommandRuntime): Command {
  const group = program.command("library-room").description("图书馆研修间目录、时段与本人预约");
  addFormatOption(group.command("dates").description("查询可预约日期"))
    .action((options: FormatOptions) => runCommand(runtime, options, async () => output(await service(client => client.dates()))));
  addFormatOption(group.command("rooms <date>").description("查询房间及容量、开放时间").option("--type <id>", "房间类型"))
    .action((date: string, options: FormatOptions & { type?: string }) => runCommand(runtime, options, async () => output(await service(client => client.rooms(date, options.type === undefined ? undefined : positive.parse(options.type))))));
  addFormatOption(group.command("slots <room-id> <date>").description("查询房间可用时段及远端状态"))
    .action((id: string, date: string, options: FormatOptions) => runCommand(runtime, options, async () => output(await service(client => client.slots(positive.parse(id), date)))));
  addFormatOption(group.command("purposes").description("查询预约用途及编号"))
    .action((options: FormatOptions) => runCommand(runtime, options, async () => output(await service(client => client.purposes()))));
  addFormatOption(group.command("bookings").description("查询本人预约").option("--page <page>", "页码", "1").option("--size <size>", "每页条数", "10"))
    .action((options: FormatOptions & { page: string; size: string }) => runCommand(runtime, options, async () => output(await service(client => client.bookings(positive.parse(options.page), positive.parse(options.size))))));
  addFormatOption(group.command("book").description("创建指定房间和时间的预约并回读").requiredOption("--input <path>", "预约JSON"))
    .action((options: FormatOptions & { input: string }) => runCommand(runtime, options, async () => {
      const input = roomBookingInput.parse(await readJsonFile(options.input));
      return output(await service(client => client.book(input)));
    }));
  addFormatOption(group.command("cancel <id>").description("取消本人预约并回读"))
    .action((id: string, options: FormatOptions) => runCommand(runtime, options, async () => output(await service(client => client.cancel(text.parse(id))))));
  return group;
}

export function registerLibraryRoomTools(tool: McpTool, service: LibraryRoomServices): void {
  const id = z.number().int().positive();
  tool("library_room_dates", "查询研修间可预约日期。", {}, () => service(client => client.dates()));
  tool("library_room_rooms", "查询研修间房间、容量及开放时间。", { date: text, type: id.optional() }, args => service(client => client.rooms(args.date, args.type)));
  tool("library_room_slots", "查询指定研修间的时段状态。", { roomId: id, date: text }, args => service(client => client.slots(args.roomId, args.date)));
  tool("library_room_purposes", "查询研修间预约用途。", {}, () => service(client => client.purposes()));
  tool("library_room_bookings", "查询本人研修间预约。", { page: id.default(1), size: id.default(10) }, args => service(client => client.bookings(args.page, args.size)));
  tool("library_room_book", "创建用户指定的研修间预约并回读确认。", { input: roomBookingInput }, args => service(client => client.book(args.input)), { destructiveHint: false });
  tool("library_room_cancel", "取消本人指定研修间预约并回读。", { id: text }, args => service(client => client.cancel(args.id)), { destructiveHint: true });
}
