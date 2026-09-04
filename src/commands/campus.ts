import type { Command } from "commander";

import type { NjuServices } from "../app/services.js";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../core/command.js";
import { optionalPositiveInteger } from "./options.js";
import { campusArticleText, campusArticlesText, campusSourcesText } from "./text.js";

interface CampusArticleOptions extends FormatOptions {
  source: string;
  section: string;
}

interface CampusArticlesOptions extends CampusArticleOptions {
  page?: string;
}

export function registerCampusCommands(
  program: Command,
  service: NjuServices["campus"],
  runtime: CommandRuntime,
): Command {
  const campus = program.command("campus").description("查询校园公开信息");

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
