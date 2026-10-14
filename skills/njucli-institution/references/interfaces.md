# 机构基础信息接口

## 来源与范围

提供 127 个机构分类与入口，收录 5395 条教师名录条目，以及 191 条后勤服务电话。收录范围详见 [coverage.md](coverage.md)。

名录条目来自各学院官网，包含退休、行政、兼职、博士后等身份标注。职称与身份合成一列展示；跨院兼任按官网标注保留。缺失联系方式（phone、email、office）仅表示本轮未提取。缺失职称时保留已有名录职称；仅当数据未取得职称且没有名录身份时，才展示为“职称待核对”。

教师分类仅保留网页导航路径的末级栏目。快照与 `--live` 读取清除研究方向中的课程、论文和联系方式。

## 实时读取与解析

| 动作 | 请求与解析 |
| --- | --- |
| `list --live` | `GET https://www.nju.edu.cn/xybm.htm`；解析 `.yxbm > ul` 提取分类容器，直接 `h3` 为分类名，`li > h4 > a` 为机构，`.bm-er > a` 为子机构。 |
| `services --live` | `GET https://www.nju.edu.cn/xyfw/hqfw.htm`；解析 `#vsb_content_2 table` 并处理 `rowspan`、`colspan` 展开部门与电话。 |
| `show --live` | 读取记录 `source.url` 指向的页面，按 `source.selector` 提取最长 400 字符的原网页摘录。机构可选 `contact` 对象含 `phone`、`email`、`source`，来自官网办公联系方式。 |
| `teacher --live` | `GET` 教师指定主页。同一次 HTTP 请求按 `source.selector` (正文) 和可选的 `source.contactSelector` (个人联系卡片) 提取。实时提取职称/身份、电话、邮箱、办公地点及最长 160 字的研究方向；缺实时职称保留已有名录职称。 |

**联系方式提取规范：**

- **邮箱别名**：支持 邮件、电子邮件、电子信箱、邮箱、Email、E-mail、Mail；`at`/`dot`、`[at]`/`[dot]`、`(at)`/`(dot)` 均规范为标准邮箱。截断地址及 `username` 等模板占位不作为有效邮箱。
- **电话解析**：保留 `ext/转` 的分机号。
- **单位边界**：正文和个人联系卡片之外的通用网站页脚联系方式属于单位，禁止作为个人联系方式提取。

所有页面编码按 HTTP 或 meta 声明解析，网络与解析异常由统一输出层报告。

## 快照与数据结构

结构化数据唯一存储于 `skills/njucli-institution/references/机构资料.json`，打包的 `dist` 不复制此文件。

数据结构精确包含：`schemaVersion`、`generatedAt`、`institutions`、`records`、`services`、`coverage`。

- **机构字段**：包含可选的 `contact` 对象（含 `phone`, `email`, `source`）。
- **记录字段**：`id`、`institutionId`、`kind`、`title`、`text`、`source`，以及可选的 `role`、`category`、`department`、`phone`、`email`、`office`。
- **`source` 字段**：`url`、`fetchedAt`，以及可选的 `selector`、`contactSelector`。
- **`coverage.rosterSource`**：可选为单学院名录来源。

## 导出与检索

- **本地检索**：`teachers` 与 `search` 支持多字段组合过滤；`teachers` 和 `search --kind teacher` 优先展示已有公开电话或邮箱的匹配结果。
- **导出行为**：`dump --output <目录>` 始终导出整个本地资料库，包含 `机构资料.json` 及其衍生的中文 Markdown 文件。导出的学院 Markdown 只写一次单位办公联系方式。
- 导出文件写入复用 `core/fs.ts` 的 `saveFile`，执行文本覆盖写入，新文件权限设为 0600，已有文件保留原权限。
