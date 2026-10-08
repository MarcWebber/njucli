---
name: njucli-table
description: 查询南京大学协同表格和官方模板，创建带公式与视图的登分表，读取、新增及按行 ID 修改记录。适用于 table.nju.edu.cn 和 SeaTable 表格任务。
---

# 协同表格

将 `SKILL_DIR` 设为本 Skill 目录的绝对路径。首次登录可运行 `node "$SKILL_DIR/scripts/run.mjs" auth login table`。

## 查找与读取

```bash
node "$SKILL_DIR/scripts/run.mjs" table workspaces --format json
node "$SKILL_DIR/scripts/run.mjs" table bases --format json
node "$SKILL_DIR/scripts/run.mjs" table templates "评分" --format json
node "$SKILL_DIR/scripts/run.mjs" table show UUID --format json
node "$SKILL_DIR/scripts/run.mjs" table rows UUID "课程成绩" --page 1 --size 100 --format json
node "$SKILL_DIR/scripts/run.mjs" table rows UUID "课程成绩" --view "待登分" --format json
node "$SKILL_DIR/scripts/run.mjs" table row UUID "课程成绩" ROW_ID --format json
```

表格 UUID 和链接来自 `bases`；工作表、字段和视图名称来自 `show`；行 ID 来自 `rows` 的 `_id`。按 `nextPage` 翻页至 null，每页最多 1000 行；满页后的下一页可能为空。

## 创建表格

```bash
node "$SKILL_DIR/scripts/run.mjs" table create "本学期作业" --template homework-upload-new --format json
node "$SKILL_DIR/scripts/run.mjs" table create "课程登分表" --preset gradebook --format json
node "$SKILL_DIR/scripts/run.mjs" table preset gradebook --output ./gradebook.json --format json
node "$SKILL_DIR/scripts/run.mjs" table create "自定义登分表" --input ./gradebook.json --format json
```

`--template/--preset/--input` 选一种，也可不传以建空白表格。官方模板 ID 使用 `templates` 返回的 `name`，`link` 可预览。默认使用个人工作区，`--workspace ID` 指定可访问的工作区。

[登分模板](templates/gradebook.json) 包含学生信息、三项成绩、总评、等级及排名、班级、待登分和需关注视图。示例权重为 30%/20%/50%，等级阈值为 90/80/70/60；按课程要求修改后创建。零分参与计算，缺分时总评留空；排名使用隐藏数值列“排序分”。

自定义结构为 `{"tables":[{"name":"工作表名","columns":[...],"views":[...]}]}`，字段使用 `column_name/column_type/column_data`。从模板或 `show` 取得字段选项；首列使用原始数据，公式列按依赖顺序排列，公式以 `{字段名}` 引用。

## 填写记录

先用 `show/rows` 核对字段和已有行。新增 JSON 是字段名作键的行数组；修改 JSON 使用实际行 ID：

```json
[{"学号":"DEMO-001","姓名":"示例同学","平时成绩":80,"作业成绩":90,"期末成绩":85}]
```

```json
[{"row_id":"从 rows 取得的 _id","row":{"期末成绩":90}}]
```

```bash
node "$SKILL_DIR/scripts/run.mjs" table append UUID "课程成绩" --input ./rows.json --format json
node "$SKILL_DIR/scripts/run.mjs" table update UUID "课程成绩" --input ./updates.json --format json
```

每批 1–1000 行，修改只提交指定字段。学号保持字符串，空数值用 null，计算字段交给平台生成。复杂字段沿用 `show/rows` 的格式，附件引用已有文件对象。成功结果包含逐行回读；失败后先查对应行，避免重复新增。

## 字段和视图

`sheet-add UUID --input sheet.json` 新增工作表，输入为上述 `tables` 的单个对象。以下命令接在 `node "$SKILL_DIR/scripts/run.mjs" table` 后：

| 任务 | 命令与输入 |
| --- | --- |
| 新增字段 | `column-add UUID "课程成绩" --input column.json`，单个字段定义 |
| 新增视图 | `view-add UUID "课程成绩" --input view.json` |
| 修改视图 | `view-update UUID "课程成绩" --input view.json`，name 使用已有视图名称 |

视图按字段名称配置，省略设置保留原值。例如：

```json
{"name":"优秀成绩","sorts":[{"column":"排序分","direction":"down"}],"groupbys":[{"column":"班级","direction":"up"}],"filters":[{"column":"排序分","predicate":"greater_or_equal","value":90}],"conjunction":"And","hidden":["备注","排序分"]}
```

创建中途失败会返回已建表格的 UUID，继续修正该表。完成后交付表格链接和写入结果。字段协议、公式处理及验证范围见[接口说明](references/interfaces.md)。
