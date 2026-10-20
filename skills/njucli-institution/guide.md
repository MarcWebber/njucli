# 学校机构与教师

公开资料查询无需校园账号。主要用于查询教师的办公电话和邮箱。使用 `njucli institution` 查询。

## 查询联系方式与基础信息

优先返回已有公开电话或邮箱的结果；检索和详情文本会将联系方式置于履历前。

```bash
njucli institution teachers 曹帅 --institution public --format json
njucli institution show im --format json
njucli institution search 人工智能 --kind teacher --format json
```

**查询说明：**
- **确认教师**：先按姓名、学院确认教师。
- **排序与展示**：`teachers` 和 `search --kind teacher` 会将已有公开联系方式的匹配结果排在前面。
- **机构联系方式**：当教师个人联系方式缺失时，可同时展示所在单位的办公联系方式（须明确标示为单位名称，禁止当成老师本人的联系方式）。
- **缺项说明**：联系方式缺失仅表示当前资料未收录，需继续核对该教师的官方个人页。
- **字段限制**：本地学院简介最长 160 字；教师研究方向最长 160 字。缺失实时职称时保留名录职称；无职称且无名录身份时显示“职称待核对”。

学院使用 `list` 返回的 ID 或完整名称，教师使用 `teachers` 返回的 ID。`--kind` 为 `overview` 或 `teacher`；每页默认 20 条，`--limit` 为 1–100，`--offset` 从 0 开始。多个空格分隔的关键词须全部命中。

## 官网实时核对与后勤电话

若本地快照缺少个人联系方式，可使用 `--live` 实时核对教师个人页。

```bash
njucli institution teacher public/曹帅 --live --format json
njucli institution teacher cs/周志华 --live --format json
njucli institution list --live --format json
njucli institution services 水电 --live --format json
```

- `teacher --live`：实时提取最新研究方向与实际联系方式。如个人页有明确链接的官方个人主页，必要时也可进一步检查。
- `show --live`：读取官网原网页摘录（最长 400 字符），展示机构办公联系方式。

## 导出与本地检索

```bash
njucli institution dump --output ./nju-knowledge --format json
```

- `dump` 始终导出整个本地资料库，包含 `机构资料.json`（不复制到 dist）及各学院中文 Markdown 文件。
- 导出的学院 Markdown 顶部只写一次单位办公联系方式；教师表格包含：姓名、职称/身份、单位、电话、邮箱、办公地点和来源。研究方向不在表格内，可通过详情或 JSON 查询。
- 文本覆盖写入复用 `core/fs.ts` 的 `saveFile`，新文件权限设为 0600，已有文件保留原权限。

本 Skill 提供六个只读 MCP 工具供 AI 调用：`institution_list`、`institution_show`、`institution_teachers`、`institution_teacher`、`institution_search`、`institution_services`。接口契约与数据结构详见 [interfaces.md](references/interfaces.md)。
