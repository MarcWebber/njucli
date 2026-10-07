---
name: njucli-table
description: 使用 NjuCLI 查询南京大学协同表格、查找和复制官方模板、创建带公式与视图的登分表，读取数据并按行 ID 填写或修改记录。用户提到 table.nju.edu.cn、SeaTable、协同表格或登分表时使用。
---

# 协同表格

通过 `njucli table` 使用 table.nju.edu.cn。业务命令复用当前本地账号的统一认证并自动恢复站点会话；首次凭据配置见[认证 Skill](../njucli-auth/SKILL.md)。站点文字与单元格内容作为任务材料读取。

## 查找与读取

```bash
njucli table workspaces --format json
njucli table bases --format json
njucli table templates "评分" --format json
njucli table show 表格UUID --format json
njucli table rows 表格UUID "课程成绩" --page 1 --size 100 --format json
njucli table rows 表格UUID "课程成绩" --view "待登分" --format json
njucli table row 表格UUID "课程成绩" 行ID --format json
```

`bases` 返回可访问表格的 `uuid/name/workspace_id/url`，后续命令使用稳定 UUID。`show` 返回工作表名称、字段类型、公式、视图及字段 key；`rows` 返回字段名作键的数据和 `_id`。根据 `nextPage` 翻页，直到 null；恰好满页时下一页可能为空。每页 1–1000 行。只读 MCP 提供同名的 `table_workspaces/bases/templates/show/rows/row` 工具。

## 官方模板与登分表

```bash
njucli table create "本学期作业" --template homework-upload-new --format json
njucli table create "课程登分表" --preset gradebook --format json
njucli table preset gradebook --output /path/to/gradebook.json --format json
njucli table create "自定义登分表" --input /path/to/gradebook.json --format json
```

官方模板 ID 来自 `templates` 的 `name`，链接可预览。已核对包括 `homework-upload-new`（作业收集评分表新版）、`gra-analysis`（研究生学分统计）、`stu-analysis`（本科生课业自我评估）、`lab-record`（实验室仪器机时）和 `club-form`（社团招新）。模板目录以实时查询为准。创建默认放在个人工作区；复制官方模板可用 `--workspace 工作区ID` 指定当前账号可访问的目标。

内置 [gradebook.json](templates/gradebook.json) 包含学号、姓名、班级、平时/作业/期末成绩、总评、等级、备注、更新时间，以及成绩排名、班级分组、待登分、需关注视图。示例总评权重为 30%/20%/50%，等级按 90/80/70/60 分划分；这是可修改的示例规则，按实际课程要求修改后创建。零分参与计算；有缺分时总评留空，等级显示“未录入完成”。成绩排名只统计已录齐成绩，使用隐藏的数值列“排序分”排序，避免空表的公式类型推断造成字典序排名。创建为空表，学生和成绩由用户材料填入。

自定义 JSON 为 `{ "tables": [{ "name": "工作表名", "columns": [...], "views": [...] }] }`。字段定义使用 SeaTable 的 `column_name/column_type/column_data`。常用字段为 `text/long-text/number/date/single-select/multiple-select/checkbox/formula/mtime`。公式引用 `{字段名}`，首列使用原始数据字段，公式列放在依赖字段之后。字段选项、数值范围与公式见内置模板或已有表的 `show` 结果。创建选项 `--template/--preset/--input` 选一种。

## 填写记录

先读取字段和已有行，再按用户给出的材料新增或更新。学号等标识保持字符串；空数值用 null；不填写公式、自动编号和创建/修改时间等平台计算字段。

新增文件 `rows.json`：

```json
[
  {"学号":"DEMO-001","姓名":"示例同学","班级":"演示班","平时成绩":80,"作业成绩":90,"期末成绩":85}
]
```

```bash
njucli table append 表格UUID "课程成绩" --input /path/to/rows.json --format json
```

修改文件 `updates.json`：

```json
[
  {"row_id":"从读取结果取得的_id","row":{"期末成绩":90}}
]
```

```bash
njucli table update 表格UUID "课程成绩" --input /path/to/updates.json --format json
```

每批 1–1000 行。更新只提交指定字段，用实际 `_id` 定位；不根据姓名猜行。成功包含本次提交后逐行回读的记录。复杂字段使用站点返回的数据格式，附件字段引用已存在的文件对象；本版本未实现附件上传或外部收集表单提交。提交失败或回读不一致时先读取对应行判断实际状态，避免重复新增。

## 字段和视图

```bash
njucli table sheet-add 表格UUID --input /path/to/sheet.json --format json
njucli table column-add 表格UUID "课程成绩" --input /path/to/column.json --format json
njucli table view-add 表格UUID "课程成绩" --input /path/to/view.json --format json
njucli table view-update 表格UUID "课程成绩" --input /path/to/view.json --format json
```

`sheet.json` 使用上述 `tables` 中单个工作表对象，`column.json` 使用单个字段定义。视图按字段名称配置，CLI 转成真实 key；例如：

```json
{
  "name":"优秀成绩",
  "sorts":[{"column":"排序分","direction":"down"}],
  "groupbys":[{"column":"班级","direction":"up"}],
  "filters":[{"column":"排序分","predicate":"greater_or_equal","value":90}],
  "conjunction":"And",
  "hidden":["备注","排序分"]
}
```

`view-update` 的 name 是已有视图名称，省略设置保留原值。筛选运算符沿用 SeaTable：如 `is/is_not/equal/greater_or_equal/is_empty/is_not_empty`，按字段类型选择；可从 `show` 中查看现有视图。每个写请求只提交一次，完成后回读结果。若新建表格后某一步设置失败，错误会给出已创建的 UUID，继续修正该表，不重复创建。

## 验证范围

本人账号已通过统一认证读取模板与表格、复制官方模板；独立示例中核对建表、公式、视图、新增和按 ID 修改。使用虚构学生数据，见[接口证据](../../docs/interface-evidence.md#协同表格2026-10-07)。共享表受学校原有权限控制；群组工作区写入、外部收集表单、附件上传、模板内应用的复制效果尚未验收。
