import { z } from "zod";

const MARKET_URL = "https://pd.qq.com/g/51b9k8wlql";
const guildNumber = "51b9k8wlql";
const richText = z.object({
  contents: z.array(z.object({
    text_content: z.object({ text: z.string() }).nullish(),
    emoji_content: z.object({ name: z.string().nullish() }).nullish(),
    url_content: z.object({ url: z.string().nullish(), displayText: z.string().nullish() }).nullish(),
  })),
});
const feedSchema = z.object({
  id: z.string().min(1), createTime: z.string().regex(/^\d+$/),
  title: richText, contents: richText,
  poster: z.object({ id: z.string().min(1), nick: z.string() }),
  channelInfo: z.object({ name: z.string(), sign: z.object({ channel_id: z.string() }) }),
  images: z.array(z.object({ vecImageUrl: z.array(z.object({ url: z.string(), width: z.number() })) })),
  commentCount: z.number(),
});
const boardSchema = z.object({ name: z.string(), channel_id: z.string(), hidden_post_channel: z.number() });
const pageSchema = z.object({
  vecFeed: z.array(feedSchema),
  isFinish: z.union([z.boolean(), z.literal(0), z.literal(1), z.null()]).transform(value => value === true || value === 1),
  feedAttchInfo: z.string().nullable().transform(value => value ?? ""),
  channels: z.array(boardSchema),
});
const envelopeSchema = z.object({ retcode: z.number(), data: z.unknown() });

function text(value: z.infer<typeof richText>): string {
  return value.contents.map(part => {
    if (part.url_content) {
      const { displayText, url } = part.url_content;
      return displayText && url && displayText !== url ? `${displayText}（${url}）` : url ?? displayText ?? "";
    }
    return part.text_content?.text ?? part.emoji_content?.name ?? "";
  }).join("");
}

function post(feed: z.infer<typeof feedSchema>) {
  return {
    id: feed.id, title: text(feed.title), body: text(feed.contents),
    publishedAt: new Date(Number(feed.createTime) * 1000).toISOString(),
    author: { id: feed.poster.id, name: feed.poster.nick },
    board: { id: feed.channelInfo.sign.channel_id, name: feed.channelInfo.name },
    images: feed.images.flatMap(image => {
      const largest = image.vecImageUrl.reduce<typeof image.vecImageUrl[number] | undefined>(
        (best, item) => !best || item.width > best.width ? item : best, undefined);
      return largest ? [largest.url] : [];
    }),
    commentCount: feed.commentCount,
    url: `${MARKET_URL}/post/${encodeURIComponent(feed.id)}?subc=${feed.channelInfo.sign.channel_id}`,
  };
}

export type MarketPost = ReturnType<typeof post>;
type BrowseInput = { board?: string | undefined; cursor?: string | undefined; author?: string | undefined; pages: number };

async function openSession() {
  const response = await fetch(MARKET_URL);
  if (!response.ok) throw new Error(`腾讯频道主页返回 HTTP ${response.status}`);
  const cookie = response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  await response.body?.cancel();
  if (!cookie) throw new Error("请在腾讯频道主页核对游客访问状态，再执行查询。");
  return async (method: string, serviceType: number, data: unknown) => {
    const result = await fetch(`https://pd.qq.com/qunng/guild/gotrpc/noauth/trpc.qchannel.commreader.ComReader/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie, Referer: MARKET_URL,
        "X-QQ-Client-AppId": "537246381", "x-oidb": JSON.stringify({ uint32_service_type: serviceType }) },
      body: JSON.stringify(data),
    });
    if (!result.ok) throw new Error(`腾讯频道 ${method} 返回 HTTP ${result.status}`);
    const payload = envelopeSchema.parse(await result.json());
    if (payload.retcode !== 0) throw new Error(`腾讯频道 ${method} 返回业务码 ${payload.retcode}；请打开 ${MARKET_URL} 核对访问状态。`);
    return payload.data;
  };
}

async function readPage(request: Awaited<ReturnType<typeof openSession>>, board: string | undefined, cursor: string) {
  const data = await request(board ? "GetChannelTimelineFeeds" : "GetGuildFeeds", board ? 11 : 12, {
    count: 10, from: 7, guild_number: guildNumber, feedAttchInfo: cursor, sortOption: 1,
    need_top_info: false,
    ...(board ? { channelSign: { channel_id: board } } : { get_type: 2, need_channel_list: true }),
  });
  return pageSchema.parse(data);
}

export class MarketClient {
  async boards() {
    const page = await readPage(await openSession(), undefined, "");
    return page.channels.filter(board => board.hidden_post_channel === 0)
      .map(board => ({ id: board.channel_id, name: board.name }));
  }

  async browse(input: BrowseInput, query?: string) {
    const request = await openSession();
    let cursor = input.cursor ?? "";
    let finished = false;
    let scannedPosts = 0;
    let scannedPages = 0;
    const items: MarketPost[] = [];
    const terms = query?.toLocaleLowerCase().split(/\s+/) ?? [];
    let newestTime = -Infinity;
    let oldestTime = Infinity;
    for (let page = 0; page < input.pages; page++) {
      const result = await readPage(request, input.board, cursor);
      scannedPages++;
      scannedPosts += result.vecFeed.length;
      for (const raw of result.vecFeed) {
        const item = post(raw);
        const time = Date.parse(item.publishedAt);
        newestTime = Math.max(newestTime, time);
        oldestTime = Math.min(oldestTime, time);
        const content = `${item.title}\n${item.body}`.toLocaleLowerCase();
        if ((!input.author || item.author.id === input.author) && terms.every(term => content.includes(term))) items.push(item);
      }
      finished = result.isFinish;
      cursor = result.feedAttchInfo;
      if (finished) break;
      if (!cursor) throw new Error("腾讯频道分页响应需要有效的继续查询游标。");
    }
    return { channel: { name: "南哪咸鱼", url: MARKET_URL }, query: query ?? null,
      boardId: input.board ?? null, authorId: input.author ?? null, items,
      scope: { method: "latest-pages" as const, scannedPages, scannedPosts,
        newest: Number.isFinite(newestTime) ? new Date(newestTime).toISOString() : null,
        oldest: Number.isFinite(oldestTime) ? new Date(oldestTime).toISOString() : null, finished },
      nextCursor: finished ? null : cursor };
  }

  async show(id: string) {
    const request = await openSession();
    const data = await request("GetFeedDetail", 5, {
      feedId: id, from: 2, detail_type: 1, channelSign: { guild_number: guildNumber },
      extInfo: { mapInfo: [{ key: "qc-tabid", value: "ark" }, { key: "qc-pageid", value: "pc" }] },
    });
    return post(z.object({ feed: feedSchema }).parse(data).feed);
  }
}
