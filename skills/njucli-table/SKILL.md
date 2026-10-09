---
name: njucli-table
description: 操作南京大学协同表格 (table.nju.edu.cn / SeaTable)，包括查询表格、创建登分表等模板、读取与批量写入数据、管理视图与字段。用户涉及协同表格任务时使用。
---

# 协同表格

以下命令在本 Skill 目录运行。首次使用需登录：`node scripts/run.mjs auth login table`。

## 查找与读取

```bash
node scripts/run.mjs table workspaces --format json
node scripts/run.mjs table bases --format json
node scripts/run.mjs table show UUID --format json
node scripts/run.mjs table rows UUID "工作表名" --page 1 --size 100 --format json
node scripts/run.mjs table rows UUID "工作表名" --view "待登分" --format json
node scripts/run.mjs table row UUID "工作表名" ROW_ID --format json
```

表格 `UUID` 取自 `bases`；工作表名、列名和视图名取自 `show`；行 ID 取自 `rows` 返回的 `_id`。
分页读取按返回的 `nextPage` 是否为 null 逐页获取，每页最多 1000 行。

## 创建表格与使用模板

```bash
node scripts/run.mjs table create "课程登分表" --preset gradebook --format json
node scripts/run.mjs table templates "作业" --format json
node scripts/run.mjs table create "作业表" --template homework-upload-new --format json
node scripts/run.mjs table preset gradebook --output ./gradebook.json --format json
node scripts/run.mjs table create "自定义表" --input ./gradebook.json --format json
```

`--template`、`--preset`、`--input` 任选一种，省略时创建空白表。官方模板 ID 使用 `templates` 返回的 `name`。默认在个人工作区创建，其他工作区 ID 从 `workspaces` 获取，用 `--workspace ID` 指定。

登分表自带公式和视图，权重与等级按课程要求调整。需要定制时，先用 `preset` 导出[登分模板](templates/gradebook.json)，修改后用 `--input` 创建。文件结构为 `{"tables":[{"name":"工作表名","columns":[...],"views":[...]}]}`。

## 写入与更新记录

```bash
node scripts/run.mjs table append UUID "工作表名" --input ./rows.json --format json
node scripts/run.mjs table update UUID "工作表名" --input ./updates.json --format json
```

- 追加新行（append）的输入格式为字段名键值对数组：
  `[{"学号": "DEMO-001", "姓名": "同学", "平时成绩": 85}]`
- 更新现有行（update）的输入格式须包含行 ID：
  `[{"row_id": "从 rows 获取的 _id", "row": {"期末成绩": 90}}]`

每批可提交 1–1000 行。学号等编号保持字符串格式，空数值填 `null`，公式列由平台自动计算。
复杂字段沿用 `show` 或 `rows` 返回的格式，附件使用已有文件对象。写入结果不明时，先查对应行，确认哪些已保存。

## 字段与视图维护

```bash
node scripts/run.mjs table sheet-add UUID --input sheet.json --format json
node scripts/run.mjs table column-add UUID "工作表名" --input column.json --format json
node scripts/run.mjs table view-add UUID "工作表名" --input view.json --format json
node scripts/run.mjs table view-update UUID "工作表名" --input view.json --format json
```

输入格式可以参考[登分模板](templates/gradebook.json)：`sheet.json` 使用 `tables` 中的一个对象，`column.json` 使用 `columns` 中的一个对象，`view.json` 使用 `views` 中的一个对象。字段使用 `column_name/column_type/column_data`；公式用 `{字段名}` 引用，按依赖顺序排列，首列使用原始数据。

修改视图时，`name` 填已有视图名，其余设置按需提供。创建中途失败时，保留已返回的表格 UUID 并在原表上修正。完成后给出表格链接和写入结果。接口字段见[接口说明](references/interfaces.md)。
