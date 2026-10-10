---
name: njucli-library
description: 查询南京大学图书馆馆藏、馆藏位置、可借状态与本人借阅。用户涉及南大图书检索或借阅时使用。
---

# 图书馆

以下命令在本 Skill 目录运行。连接校园网或官方 VPN 后，书目和馆藏直接访问 `https://opac.nju.edu.cn`；本人借阅复用统一认证派生的图书馆会话，需要时自动恢复。手动登录使用 `node scripts/run.mjs auth login opac`。

出现 `UNABLE_TO_VERIFY_LEAF_SIGNATURE` 或 `unable to verify the first certificate` 时，按[HTTPS 证书配置](references/network.md)补齐官网缺少的中间证书。

## 书目检索与馆藏分布

```bash
node scripts/run.mjs library search "关键词" --format json
node scripts/run.mjs library search "书名" --field title --page 1 --page-size 20 --format json
node scripts/run.mjs library book BOOK_ID --format json
node scripts/run.mjs library holdings BOOK_ID --format json
```

`--field` 可选 `all`（默认）、`title`、`author`、`isbn`、`callno`（索书号）。

`BOOK_ID` 来自 `search` 返回的 `bookId`。先查书目，再通过 `holdings` 查询馆藏位置、索书号及可借状态，将这些信息连同题名提供给用户。

## 本人借阅查询

```bash
node scripts/run.mjs library loans --format json
```

返回当前在借图书列表、应还日期及逾期状态；支持 `--page` 和 `--page-size`，页码从 1 开始。逾期按南京当地日期与应还日期比较。

2026-10-10 已核对五种检索字段、翻页、空结果、详情、跨页馆藏、读者登录和当前借阅空列表。统一 CLI、独立 Skill 与只读 MCP 的实网结果见[验证报告](https://github.com/MarcWebber/njucli/blob/main/docs/reports/2026-10-10-intranet.md)。
