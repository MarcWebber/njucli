# 南哪咸鱼直连验证

**实际 CLI 与 MCP 已验证板块读取、多页搜索、继续查询、作者筛选和帖子详情。** 本报告记录 2026-11-07 的公开实网结果，查询数据随腾讯频道更新。

执行环境为 Node.js 26.10.0、pnpm 10.27.0，CLI 入口为构建后的 `node dist/cli.js`。验证使用腾讯主页下发的游客会话。命令参数与摘要结果见[脱敏命令记录](verification.log)。记录保留数量、耗时和覆盖范围。

## 公开实网

| 执行入口与参数 | 实际结果与核对 |
| --- | --- |
| `market boards --format json` | 返回 11 个公开板块。 |
| `market posts --format json`，再传返回的 `--cursor` | 两页各返回 10 条；两页帖子 ID 的交集为 0。 |
| `market search 显示器 --board 635552598 --pages 10 --format json` | 扫描鼓楼二手 10 页、120 条，匹配 1 条；逐条核对关键词和板块 ID。本次范围为北京时间 2026-10-28 15:52:41 至 2026-11-07 02:24:25。 |
| 同一搜索传 `--pages 2 --cursor '<返回游标>'` | 实际读取 1 页，平台返回 0 条并标记列表结束；CLI 输出 `finished=true`、`nextCursor=null`。 |
| `market show '<搜索结果中的 id>' --format json` | 回读同一帖子，正文有效、作者 ID 一致，返回 2 张图片地址。 |
| `market posts --author '<返回作者 ID>' --pages 2 --format json` | 返回 1 条匹配帖子；逐条核对稳定作者 ID。 |
| MCP `market_search`，`query=显示器`、`board=635552598`、`pages=10` | 同样扫描 10 页、120 条，返回 1 条匹配结果；各次请求的时间范围随最新内容更新。 |
| MCP 参数 `pages=0` | 输入校验返回错误。 |
| CLI 参数 `--pages 0`、空白关键词及帖子 ID `invalid-id` | CLI 返回 `INVALID_INPUT`，进程退出码为 2；实际安装测试覆盖这三类输入。 |

一次实测中，10 页搜索耗时约 7.6 秒，详情读取耗时约 1.2 秒。耗时包含真实 CLI 子进程启动和远端请求，作为当前网络条件下的样本。

## 源码、构建与安装

- `pnpm install --frozen-lockfile` 完成依赖安装。
- `pnpm lint` 通过 TypeScript 检查。
- `pnpm test` 通过真实文件锁与安装测试。实际 tarball 安装后的统一 CLI、21 个 Skill、297 个 MCP 工具通过核对，新模块的命令与 MCP 一一对应。
- `npm pack --dry-run` 完成产物清单核对。
- MCP 工具列表包含 4 个 `market_*` 只读工具，`market_search` 默认页数为 5。

## 查询范围

当前搜索覆盖指定页数内、腾讯向游客公开提供的最新帖子。`finished` 表示当前远端列表的结束状态。完整历史搜索、个人 QQ 会话、作者 QQ 号关联属于后续验证范围。

用户通过 QQ 完成发布和联系；CLI 提供正文、图片和原帖入口。
