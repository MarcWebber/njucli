---
name: njucli-campus
description: 查询南京大学公开通知、文章、食堂信息和 NJU Mirror 开源镜像，汇总指定日期的课程、借阅和体育预约。用户涉及南大校园综合信息、镜像源或 njucli campus 时使用。
---

# 校园信息与今日安排

以下命令在本 Skill 目录运行。

## 开源镜像

```bash
node scripts/run.mjs campus mirrors ubuntu --format json
node scripts/run.mjs campus mirrors pypi --format json
node scripts/run.mjs campus mirrors --format json
```

实时读取 NJU Mirror 的公开 JSON，按名称关键词匹配（忽略大小写），返回镜像地址、同步状态和已有帮助链接。省略关键词列出全部镜像。查询可直接通过 HTTP 完成，无需校园登录。安装包版本和软件源配置按返回的镜像目录及帮助文档选择。

接口与验证范围见[镜像接口](references/mirrors.md)。

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
