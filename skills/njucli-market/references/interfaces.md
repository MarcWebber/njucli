# 南哪咸鱼接口

## 会话与请求

频道入口为 `https://pd.qq.com/g/51b9k8wlql`。每次业务调用先 GET 主页，取得 `uuid` 和 `p_uin` 游客 Cookie，随后在同一次调用中复用。会话保留在调用内存中。

读取接口采用 POST，前缀为 `https://pd.qq.com/qunng/guild/gotrpc/noauth/trpc.qchannel.commreader.ComReader/`。请求头为 `Content-Type: application/json`、游客 Cookie、`Referer`、`X-QQ-Client-AppId: 537246381` 和 JSON 格式的 `x-oidb`。

| 方法 | `uint32_service_type` | 请求和响应 |
| --- | --- | --- |
| `GetGuildFeeds` | 12 | `guild_number=51b9k8wlql`、`count=10`、`from=7`、`get_type=2`、`sortOption=1`、`need_channel_list=true`、`need_top_info=false`；返回 `vecFeed`、`channels`、`feedAttchInfo`、`isFinish`。 |
| `GetChannelTimelineFeeds` | 11 | `guild_number`、`channelSign.channel_id`、`count=10`、`from=7`、`sortOption=1`、`need_top_info=false`；返回帖子与相同分页字段。 |
| `GetFeedDetail` | 5 | `feedId`、`from=2`、`detail_type=1`、`channelSign.guild_number`，以及 `extInfo.mapInfo` 中的 `qc-tabid=ark`、`qc-pageid=pc`；返回 `data.feed`。 |

第一页使用空字符串 `feedAttchInfo`，后续页原样传回前一页的游标。`isFinish` 的 `true` / `1` 表示到达列表末尾，`false` / `0` / `null` 表示继续读取。末页的游标可为 `null`。请求中的 `count=10` 为前端实际参数；实测板块页可返回 12 条，扫描数量使用实际返回条数。列表持续更新时，结果反映各页请求时的平台状态。列表末尾表示平台在本次游客请求中提供的范围；历史完整覆盖需要结合登录搜索另行核对。

响应外层通过 `retcode=0` 判断成功。帖子字段包括 `id`、秒级 `createTime`、富文本 `title.contents` / `contents.contents`、`poster.id` / `poster.nick`、`channelInfo`、`images[].vecImageUrl` 和 `commentCount`。图片输出每组最大宽度的原始地址。

`poster.id` 表示频道作者身份。联系方式与 QQ 身份关联依据作者公开内容和平台明确提供的关联。

## 搜索契约

CLI 搜索依次读取最新列表，在标题和正文中匹配全部关键词，并输出扫描页数、帖子数、时间范围和继续游标。默认搜索 5 页，用户可指定正整数页数。作者筛选按 `poster.id` 精确匹配。

腾讯网页的 `InGuildSearch/NewSearch` 在游客调用中返回业务码 4000，要求登录认证。游客全站搜索 `GuildSearchAggregation/Search` 返回全站内容。当前 CLI 使用南哪咸鱼自身的分页列表完成范围明确的关键词查询。

## 验证范围

公开 HTTP 已验证游客会话、最新列表连续翻页、鼓楼二手板块读取和帖子详情。CLI、MCP 与安装产物的执行结果见[验证报告](verification.md)。

个人 QQ 登录后的频道内搜索属于后续验证范围。用户通过 QQ 完成联系和发布。服务端索引可用于后续跨时间范围检索、排序和减少重复请求；当前调用直接访问腾讯。
