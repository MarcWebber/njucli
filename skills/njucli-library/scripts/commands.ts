import type { Command } from "commander";
import { z } from "zod";
import { readJsonFile } from "../../../src/core/fs.js";
import { libraryRequestInput, libraryPhone, libraryPhoneCode } from "./input.js";

import type { LibraryServices } from './services.js';
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../../../src/core/command.js";
import {
  optionalPositiveInteger,
} from "../../../src/core/options.js";
import { AppError } from "../../../src/core/errors.js";
import { LIBRARY_SEARCH_FIELDS, type LibrarySearchField } from "./types.js";
import {
  libraryBookText,
  libraryHoldingsText,
  libraryLoansText,
  librarySearchText,
} from './text.js';

interface LibraryPageOptions extends FormatOptions {
  page?: string;
  pageSize?: string;
}

export function registerLibraryCommands(
  program: Command,
  service: LibraryServices,
  runtime: CommandRuntime,
): Command {
  const library = program.command("library").description("图书馆检索、借阅、预约与跨校区委托");

  addFormatOption(library.command("search <query>").description("检索馆藏")
    .option("--field <field>", `检索字段：${LIBRARY_SEARCH_FIELDS.join("、")}`)
    .option("--page <page>", "页码")
    .option("--page-size <size>", "每页条数"))
    .action(async (query: string, options: LibraryPageOptions & { field?: string }) => runCommand(runtime, options, async () => {
      const field = librarySearchField(options.field);
      const page = optionalPositiveInteger(options.page, "--page");
      const pageSize = optionalPositiveInteger(options.pageSize, "--page-size");
      const data = await service.search(query, field, page, pageSize);
      return { data, text: librarySearchText(data) };
    }));

  addFormatOption(library.command("book <book-id>").description("读取图书详情"))
    .action(async (bookId: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.book(bookId);
      return { data, text: libraryBookText(data) };
    }));

  addFormatOption(library.command("holdings <book-id>").description("查询馆藏位置与可借状态"))
    .action(async (bookId: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.holdings(bookId);
      return { data, text: libraryHoldingsText(data) };
    }));

  addFormatOption(library.command("loans").description("查询我的借阅")
    .option("--page <page>", "页码")
    .option("--page-size <size>", "每页条数"))
    .action(async (options: LibraryPageOptions) => runCommand(runtime, options, async () => {
      const page = optionalPositiveInteger(options.page, "--page");
      const pageSize = optionalPositiveInteger(options.pageSize, "--page-size");
      const data = await service.loans(page, pageSize);
      return { data, text: libraryLoansText(data) };
    }));

  const output = <T>(data: T) => ({ data, text: JSON.stringify(data, null, 2) });
  addFormatOption(library.command("contacts").description("查询图书馆联系信息及官方验证状态"))
    .action((options: FormatOptions) => runCommand(runtime, options, async () => output(await service.contacts())));
  addFormatOption(library.command("phone-code").description("向本人指定手机号发送一次官方图书馆验证码").requiredOption("--phone <number>", "本人手机号，可使用 profile.phone"))
    .action((options: FormatOptions & { phone: string }) => runCommand(runtime, options, async () => output(await service.sendPhoneCode(libraryPhone.parse(options.phone)))));
  addFormatOption(library.command("phone-verify").description("回填用户提供的本次验证码并回读官方手机号验证状态")
    .requiredOption("--phone <number>", "本次接收验证码的手机号").requiredOption("--code <code>", "用户提供的当前短信验证码"))
    .action((options: FormatOptions & { phone: string; code: string }) => runCommand(runtime, options, async () => output(await service.verifyPhone(libraryPhone.parse(options.phone), libraryPhoneCode.parse(options.code)))));
  addFormatOption(library.command("email-verification").description("向本人邮箱发送一次图书馆联系方式验证链接").requiredOption("--email <address>", "本人邮箱，可使用 profile.email"))
    .action((options: FormatOptions & { email: string }) => runCommand(runtime, options, async () => output(await service.sendEmailVerification(z.email().parse(options.email)))));
  addFormatOption(library.command("renew <loan-id>").description("续借一本本人在借图书并回读应还日期"))
    .action((id: string, options: FormatOptions) => runCommand(runtime, options, async () => output(await service.renew(id))));
  addFormatOption(library.command("request-options <book-id>").description("读取可申请馆藏、本人申请资格及联系方式"))
    .action((id: string, options: FormatOptions) => runCommand(runtime, options, async () => output(await service.requestOptions(id))));
  addFormatOption(library.command("pickup-locations <book-id> <call-no>").description("读取图书预约与委托的取书地点及分卷"))
    .action((id: string, callNo: string, options: FormatOptions) => runCommand(runtime, options, async () => output(await service.pickupLocations(id, callNo))));
  addFormatOption(library.command("requests").description("查询本人图书请求")
    .option("--page <page>", "页码").option("--page-size <size>", "每页条数"))
    .action((options: LibraryPageOptions) => runCommand(runtime, options, async () => output(await service.requests(
      optionalPositiveInteger(options.page, "--page"), optionalPositiveInteger(options.pageSize, "--page-size"),
    ))));
  addFormatOption(library.command("request <request-id>").description("读取本人的一条图书请求详情"))
    .action((id: string, options: FormatOptions) => runCommand(runtime, options, async () => output(await service.request(id))));
  for (const [name, type, description] of [["reserve", 1, "预约一本图书"], ["entrust", 0, "提交一次跨校区图书委托"]] as const) {
    addFormatOption(library.command(name).description(description).requiredOption("--input <file>", "申请参数 JSON 文件"))
      .action((options: FormatOptions & { input: string }) => runCommand(runtime, options, async () => {
        const input = libraryRequestInput.parse(await readJsonFile<unknown>(options.input));
        return output(await service.submitRequest(type, input));
      }));
  }
  addFormatOption(library.command("cancel-request <request-id>").description("取消本人图书请求并回读"))
    .action((id: string, options: FormatOptions) => runCommand(runtime, options, async () => output(await service.cancelRequest(id))));
  return library;
}

function librarySearchField(value: string | undefined): LibrarySearchField | undefined {
  if (value === undefined) return undefined;
  if (!LIBRARY_SEARCH_FIELDS.includes(value as LibrarySearchField)) {
    throw new AppError("INVALID_INPUT", `不支持的图书检索字段：${value}`, {
      hint: `使用 ${LIBRARY_SEARCH_FIELDS.join("、")}`,
    });
  }
  return value as LibrarySearchField;
}
