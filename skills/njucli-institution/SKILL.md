---
name: njucli-institution
description: 查询南京大学机构目录、学院简介、教师姓名、职称/身份、单位、公开电话、邮箱、办公地点、研究方向及后勤电话。支持本地检索、官网实时核对和整个本地资料库导出。
---

# 学校机构与教师

公开资料查询无需校园账号。以下命令在本 Skill 目录运行；统一 CLI 使用 `njucli institution` 代替 `node scripts/run.mjs institution`。

## 查询基础信息

```bash
node scripts/run.mjs institution list 政府 --format json
node scripts/run.mjs institution show public --format json
node scripts/run.mjs institution teachers 社会保障 --institution public --format json
node scripts/run.mjs institution teachers 李宣东 --institution software --format json
node scripts/run.mjs institution teachers lxd@nju.edu.cn --format json
node scripts/run.mjs institution search 人工智能 --kind teacher --format json
node scripts/run.mjs institution teacher software/李宣东 --format json
```

**参数与字段说明：**

- 学院使用 `list` 返回的 ID 或完整名称；教师使用 `teachers` 返回的 ID。
- 支持按姓名、职称/身份、分类、单位、电话、邮箱、办公地点及研究方向等多字段联合检索。多个空格分隔的关键词须全部命中。
- `--kind` 为 `overview` 或 `teacher`；每页默认 20 条，`--limit` 为 1–100，`--offset` 从 0 开始。
- 本地学院简介为依据官网原文概括（最长 160 字）；教师研究方向最长 160 字。
- 仅当数据未取得职称且没有名录身份时，才显示“职称待核对”；缺实时职称时保留已有名录职称。空联系方式仅表示未提取。
- 职称与身份已合成一列。跨学院兼任教师按官网标注保留。

## 官网核对与后勤电话

```bash
node scripts/run.mjs institution teacher software/李宣东 --live --format json
node scripts/run.mjs institution show public --live --format json
node scripts/run.mjs institution list --live --format json
node scripts/run.mjs institution services 水电 --live --format json
```

- 默认使用本地快照。`--live` 触发官网实时核对。
- `show --live` 读取官网原网页摘录（最长 400 字符）。
- `teacher --live` 提取最新研究方向与实际联系方式。

## 导出与本地检索

```bash
node scripts/run.mjs institution dump --output ./nju-knowledge --format json
rg -n '社会保障|公共政策' ./nju-knowledge/institutions
```

- `dump` 始终导出整个本地资料库，包含 `机构资料.json`、`机构目录.md`、`后勤电话.md` 及各学院中文 Markdown 文件。
- 文本覆盖写入复用 `core/fs.ts` 的 `saveFile`，新文件权限设为 0600，已有文件保留原权限。

导出的Markdown表格包含：姓名、职称/身份、单位、电话、邮箱、办公地点和来源。为避免表格过宽，研究方向不列入表格，可通过teacher详情命令或JSON输出格式查询。

本 Skill 提供六个只读 MCP 工具供 AI 调用：`institution_list`、`institution_show`、`institution_teachers`、`institution_teacher`、`institution_search`、`institution_services`。接口契约与数据结构详见 [interfaces.md](references/interfaces.md)。
