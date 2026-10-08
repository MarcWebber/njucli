import type { Command } from "commander";

import type { CampusServices } from './services.js';
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../../../src/core/command.js";
import { optionalPositiveInteger } from "../../../src/core/options.js";
import { campusArticleText, campusArticlesText, campusSourcesText } from './text.js';

interface CampusArticleOptions extends FormatOptions {
  source: string;
  section: string;
}

interface CampusArticlesOptions extends CampusArticleOptions {
  page?: string;
}

export function registerCampusCommands(
  program: Command,
  service: CampusServices,
  runtime: CommandRuntime,
): Command {
  const campus = program.command("campus").description("查询校园信息与日程汇总");

  addFormatOption(campus.command("today [date]").description("汇总指定日期的课程、借阅与体育预约"))
    .action(async (date: string | undefined, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.today(date);
      return { data, text: [
        `日期：${data.date}`,
        `课程：${data.course.length} 项`,
        `借阅：${data.library.length} 项`,
        `体育预约：${data.sports.length} 项`,
      ].join("\n") };
    }));

  addFormatOption(campus.command("canteens [query]").description("查询官方学生食堂目录和电话（非实时菜单）"))
    .action(async (query: string | undefined, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.canteens(query);
      return { data, text: [...data.items.map((item) => `${item.name}\t${item.phone}`), `来源：${data.sourceUrl}`].join("\n") };
    }));

  addFormatOption(campus.command("sources").description("列出支持的信息源与栏目"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = service.sources();
      return { data, text: campusSourcesText(data) };
    }));

  addFormatOption(campus.command("articles").description("查询栏目文章")
    .requiredOption("--source <source>", "信息源 ID")
    .requiredOption("--section <section>", "栏目 ID")
    .option("--page <page>", "页码"))
    .action(async (options: CampusArticlesOptions) => runCommand(runtime, options, async () => {
      const page = optionalPositiveInteger(options.page, "--page");
      const data = await service.articles(options.source, options.section, page);
      return {
        data,
        text: campusArticlesText(data),
      };
    }));

  addFormatOption(campus.command("article <article-id>").description("读取一篇文章")
    .requiredOption("--source <source>", "信息源 ID")
    .requiredOption("--section <section>", "栏目 ID"))
    .action(async (articleId: string, options: CampusArticleOptions) => runCommand(runtime, options, async () => {
      const data = await service.article(options.source, options.section, articleId);
      return {
        data,
        text: campusArticleText(data),
      };
    }));

  return campus;
}
