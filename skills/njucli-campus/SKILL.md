---
name: njucli-campus
description: 查询南京大学公开通知、文章、食堂信息和 NJU Mirror 开源镜像，汇总指定日期的课程、借阅和体育预约，提供就业门户和校园巴士的官方查询指引。用户涉及南大校园综合信息、就业信息、班车、镜像源或 njucli campus 时使用。
---

# 校园信息与今日安排

## 开源镜像

```bash
njucli campus mirrors ubuntu --format json
njucli campus mirrors pypi --format json
njucli campus mirrors --format json
```

实时读取 NJU Mirror 的公开 JSON，按名称关键词匹配（忽略大小写），返回镜像地址、同步状态和已有帮助链接。省略关键词列出全部镜像。查询可直接通过 HTTP 完成，无需校园登录。安装包版本和软件源配置按返回的镜像目录及帮助文档选择。

接口与验证范围见[镜像接口](references/mirrors.md)。

## 今日安排汇总

```bash
njucli campus today --format json
njucli campus today YYYY-MM-DD --format json
```

省略日期时查询南京当地当天。结果包含当天课程、本人在借图书及应还时间，以及当天的体育预约。

需要登录时，按提示通过 `njucli auth login 站点名` 完成认证。

## 通知与文章

```bash
njucli campus sources --format json
njucli campus articles --source nju --section news --page 1 --format json
njucli campus article ARTICLE_ID --source nju --section news --format json
```

先用 `sources` 查找信息源和栏目，再查询文章。`ARTICLE_ID` 来自文章列表的 `id`；读取正文时沿用相同的 `source` 和 `section`。

团委等来源在部分网络下需要校园 VPN。

## 食堂信息

```bash
njucli campus canteens --format json
njucli campus canteens "六食堂" --format json
```

可按食堂名称筛选，结果包含学校公开的名称和电话。

## 就业与校园巴士

| 服务 | 使用方式 |
| --- | --- |
| 就业信息 | 打开[南京大学就业门户](https://job.nju.edu.cn/career)，按用户的就业问题查找信息，返回简短摘要和原始页面链接。 |
| 校园巴士 | 根据出发地、目的地和出行日期，在南京大学 APP 的校园巴士入口查阅线路、站点和当日安排；使用方式见[官方 APP 指南](https://itsc.nju.edu.cn/bc/cd/c21475a507085/pagem.htm)。 |

仙林校区内巴士可在 APP 搜索“巴士路线实时显示”查看车辆位置，详见[官方说明](https://www.nju.edu.cn/info/1055/439161.htm)。跨校区出行按对应班车线路查询，时刻和临时调整以出行当天的官方信息为准。助手将这些查询交给官方页面或 APP，并保留结果来源。
