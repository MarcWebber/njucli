# 机构基础信息接口

## 来源与范围

提供 127 个机构分类与入口，收录 5395 条教师名录条目，以及 191 条后勤服务电话。收录范围详见 [coverage.md](coverage.md)。

名录条目来自各学院官网，包含退休、行政、兼职、博士后等身份标注。职称与身份合成一列展示；跨院兼任按官网标注保留。缺失联系方式（phone、email、office）仅表示本轮未提取。缺失职称时保留已有名录职称；仅当数据未取得职称且没有名录身份时，才展示为“职称待核对”。

教师分类仅保留网页导航路径的末级栏目。课程、论文与联系方式不进入研究方向字段。快照数据与实网读取均采用同一套数据清理规则。

## 实时读取与解析

| 动作 | 请求与解析 |
| --- | --- |
| `list --live` | `GET https://www.nju.edu.cn/xybm.htm`；解析 `.yxbm > ul` 提取分类容器，直接 `h3` 为分类名，`li > h4 > a` 为机构，`.bm-er > a` 为子机构。 |
| `services --live` | `GET https://www.nju.edu.cn/xyfw/hqfw.htm`；解析 `#vsb_content_2 table` 并处理 `rowspan`、`colspan` 展开部门与电话。 |
| `show --live` | 读取记录 `source.url` 指向的学院简介页面，按 `source.selector` 提取最长 400 字符的官网原网页摘录。本地学院简介为依据官网原文概括（最长 160 字）。 |
| `teacher --live` | GET 教师指定来源主页，实时提取职称/身份、电话、邮箱、办公地点及最长 160 字的研究方向；无法提取联系方式时留空，缺实时职称保留已有名录职称。 |

所有页面编码按 HTTP 或 meta 声明解析，网络与解析异常由统一输出层报告。

## 快照与数据结构

结构化数据唯一存储于 `skills/njucli-institution/references/机构资料.json`，打包的 `dist` 不再复制此文件。

数据结构精确包含：`schemaVersion`、`generatedAt`、`institutions`、`records`、`services`、`coverage`。

- 记录字段：`id`、`institutionId`、`kind`、`title`、`text`、`source`，以及可选的 `role`、`category`、`department`、`phone`、`email`、`office`。
- `source` 字段：`url`、`fetchedAt`、可选 `selector`。
- `coverage.rosterSource`：可选为单学院名录来源。

## 导出与检索

- **本地检索**：`teachers` 与 `search` 支持姓名、职称/身份、分类、单位及联系方式（电话、邮箱、办公地点）等多字段组合过滤。
- **导出行为**：`dump --output <目录>` 始终导出整个本地资料库，包含 `机构资料.json` 及其衍生的中文 Markdown 文件。
- 导出文件写入复用 `core/fs.ts` 的 `saveFile`，执行文本覆盖写入，新文件权限设为 0600，已有文件保留原权限。
