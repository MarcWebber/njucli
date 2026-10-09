---
name: njucli-campus
description: 查询南京大学公开通知、文章、食堂信息，汇总指定日期的课程、借阅和体育预约。用户涉及南大校园综合信息或 njucli campus 时使用。
---

# 校园信息与今日安排

以下命令在本 Skill 目录运行。

## 今日安排汇总

```bash
node scripts/run.mjs campus today --format json
node scripts/run.mjs campus today YYYY-MM-DD --format json
```

省略日期时查询南京当地当天。结果包含当天课程、本人在借图书及应还时间，以及当天的体育预约。

需要登录时，按提示通过 `node scripts/run.mjs auth login 站点名` 完成认证。

## 通知与文章

```bash
node scripts/run.mjs campus sources --format json
node scripts/run.mjs campus articles --source nju --section news --page 1 --format json
node scripts/run.mjs campus article ARTICLE_ID --source nju --section news --format json
```

先用 `sources` 查找信息源和栏目，再查询文章。`ARTICLE_ID` 来自文章列表的 `id`；读取正文时沿用相同的 `source` 和 `section`。

团委等来源在部分网络下需要校园 VPN。

## 食堂信息

```bash
node scripts/run.mjs campus canteens --format json
node scripts/run.mjs campus canteens "六食堂" --format json
```

可按食堂名称筛选，结果包含学校公开的名称和电话。
