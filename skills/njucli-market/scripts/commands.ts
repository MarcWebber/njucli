import type { Command } from "commander";
import { z } from "zod";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../../../src/core/command.js";
import { AppError } from "../../../src/core/errors.js";
import type { McpTool } from "../../../src/mcp/tools.js";
import type { MarketClient, MarketPost } from "./client.js";

const querySchema = z.string().trim().min(1);
const idSchema = z.string().regex(/^B_[A-Za-z0-9_]+$/, "请提供帖子结果中的 id。");
const browseShape = {
  board: z.string().regex(/^\d+$/).optional(), cursor: z.string().min(1).optional(),
  author: z.string().regex(/^\d+$/).optional(), pages: z.coerce.number().int().positive().default(1),
};
const browseSchema = z.object(browseShape);

function parseInput<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError("INVALID_INPUT", "请核对关键词、帖子 ID 和分页参数。", { details: result.error.issues });
  return result.data;
}

function postText(item: MarketPost): string {
  return [`${item.title}（${item.board.name}）`, `${item.author.name} · ${item.publishedAt}`,
    `帖子 ID：${item.id}；作者 ID：${item.author.id}`, item.body, item.url,
    ...item.images.map(url => `图片：${url}`)].join("\n");
}

function browseOutput(data: Awaited<ReturnType<MarketClient["browse"]>>) {
  const { scope } = data;
  return { data, text: [
    `本次按最新顺序扫描 ${scope.scannedPages} 页、${scope.scannedPosts} 条帖子，匹配 ${data.items.length} 条。`,
    `扫描时间范围：${scope.oldest ?? "空"} 至 ${scope.newest ?? "空"}。`,
    ...data.items.map(item => [`${item.title}（${item.board.name}）`,
      `${item.author.name} · ${item.publishedAt} · 作者 ID：${item.author.id}`,
      `帖子 ID：${item.id}`, item.body.length > 160 ? `${item.body.slice(0, 160)}…` : item.body,
      item.url].join("\n")),
    data.nextCursor ? `继续查询时沿用板块、作者及关键词，并传 --cursor '${data.nextCursor}'。` : "本次已到达列表末尾。",
  ].join("\n\n") };
}

function browseOptions(command: Command, pages: string): Command {
  return addFormatOption(command.option("--board <id>", "boards 返回的板块 ID")
    .option("--author <id>", "按帖子返回的稳定作者 ID 筛选")
    .option("--pages <count>", "本次按顺序读取的页数，实际条数由腾讯返回", pages)
    .option("--cursor <value>", "上次同一列表返回的 nextCursor"));
}

export function registerMarketCommands(program: Command, client: MarketClient, runtime: CommandRuntime): Command {
  const market = program.command("market").description("直连南哪咸鱼，查看板块、逐页检索帖子和阅读详情");
  addFormatOption(market.command("boards").description("列出南哪咸鱼板块及 ID"))
    .action((options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await client.boards();
      return { data, text: data.map(board => `${board.id}\t${board.name}`).join("\n") };
    }));
  browseOptions(market.command("posts").description("按最新顺序读取帖子，支持连续分页和作者筛选"), "1")
    .action((options: FormatOptions) => runCommand(runtime, options, async () => browseOutput(await client.browse(parseInput(browseSchema, options)))));
  browseOptions(market.command("search <query>").description("逐页扫描最新帖子，匹配标题和正文中的全部关键词"), "5")
    .action((query: string, options: FormatOptions) => runCommand(runtime, options, async () =>
      browseOutput(await client.browse(parseInput(browseSchema, options), parseInput(querySchema, query)))));
  addFormatOption(market.command("show <id>").description("实时读取帖子正文、作者、图片与官方链接"))
    .action((id: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await client.show(parseInput(idSchema, id));
      return { data, text: postText(data) };
    }));
  return market;
}

export function registerMarketTools(tool: McpTool, client: MarketClient): void {
  tool("market_boards", "列出南哪咸鱼的二手交易与校园互助板块。", {}, () => client.boards());
  tool("market_posts", "直连南哪咸鱼，按最新顺序分页读取帖子；作者参数使用结果中的稳定作者 ID。", browseShape,
    input => client.browse(input));
  tool("market_search", "逐页读取南哪咸鱼最新帖子，在标题和正文中匹配全部关键词。结果附扫描范围和继续游标；依据 scope 向用户说明覆盖范围。", {
    ...browseShape, pages: browseShape.pages.default(5), query: querySchema,
  }, ({ query, ...input }) => client.browse(input, query));
  tool("market_show", "实时读取南哪咸鱼帖子正文、作者、图片及原帖链接。作者 ID 属于腾讯频道身份。", { id: idSchema }, ({ id }) => client.show(id));
}
