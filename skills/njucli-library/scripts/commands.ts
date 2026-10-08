import type { Command } from "commander";

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
  const library = program.command("library").description("查询图书馆馆藏与借阅");

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
