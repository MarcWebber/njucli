---
name: njucli-library
description: 查询南京大学图书馆馆藏、馆藏位置、可借状态与本人借阅。用户涉及南大图书检索或借阅时使用。
---

# 图书馆

以下命令在本 Skill 目录运行。书目和馆藏查询通过 WebVPN，借阅还需要图书馆读者登录。按提示运行 `node scripts/run.mjs auth login vpn` 或 `auth login opac`。

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

返回当前在借图书列表、应还日期及逾期状态。
