---
name: njucli-table
description: 操作南京大学协同表格 (table.nju.edu.cn / SeaTable)，包括查询表格、创建登分表等模板、读取与批量写入数据、管理视图与字段。用户涉及协同表格任务时使用。
---

# 协同表格

首次使用需登录：`njucli auth login table`。

业务读取与填写优先使用 CLI/API。遇到现有命令覆盖范围之外的入口，先按[接口说明](references/interfaces.md)查证 HTTP 契约；浏览器用于需要本人交互的登录验证或用户明确要求的页面操作。

## 外部应用填报

通知中的 `https://table.nju.edu.cn/external-apps/UUID/` 是应用入口。先查看页面 ID、字段、必填要求和默认值：

```bash
njucli table app-show "应用 URL 或 UUID" --format json
njucli table app-rows "应用 URL 或 UUID" "表格页 ID" --format json
```

外部应用命令通过 HTTP 复用当前账号会话；会话到期时，使用该账号已保存的统一认证凭据登录。凭据或访问权限需要处理时，命令返回具体原因。

将待填写内容保存为字段名键值对 JSON，例如：

```json
{"地点":"示例实习单位办公楼","起始日期":"2026-10-19","结束日期":null}
```

按表单实际字段填写；当前支持文本及 `YYYY-MM-DD` 日期。账号 ID、姓名默认值由应用的 `{creator.id}`、`{creator.name}` 配置填入。必填项使用用户提供的信息，选填项可省略或填 `null`。

```bash
njucli table form-submit "应用 URL 或 UUID" "表单页 ID" \
  --input ./form.json --readback-page "表格页 ID" --format json
```

`--readback-page` 选择同一工作表、显示全部提交字段的表格页。命令提交一次，并比较提交前后的行 ID 与字段，返回本次新增记录及详情链接。遇到提交或回读错误，先运行 `app-rows` 确认保存状态，再决定后续操作。此流程适用于新增填报记录；附件、关联记录和其他复杂字段需按各自接口契约处理。

`app-rows` 支持 `--page`、`--size`（1–1000），按 `nextPage` 分页。MCP 提供 `table_app_show`、`table_app_rows` 和 `table_form_submit`；提交使用 `app`、`pageId`、`input` 与 `readbackPage`。

## 查找与读取

```bash
njucli table workspaces --format json
njucli table bases --format json
njucli table show UUID --format json
njucli table rows UUID "工作表名" --page 1 --size 100 --format json
njucli table rows UUID "工作表名" --view "待登分" --format json
njucli table row UUID "工作表名" ROW_ID --format json
```

表格 `UUID` 取自 `bases`；工作表名、列名和视图名取自 `show`；行 ID 取自 `rows` 返回的 `_id`。
分页读取按返回的 `nextPage` 是否为 null 逐页获取，每页最多 1000 行。

## 创建表格与使用模板

```bash
njucli table create "课程登分表" --preset gradebook --format json
njucli table templates "作业" --format json
njucli table create "作业表" --template homework-upload-new --format json
njucli table preset gradebook --output ./gradebook.json --format json
njucli table create "自定义表" --input ./gradebook.json --format json
```

`--template`、`--preset`、`--input` 任选一种，省略时创建空白表。官方模板 ID 使用 `templates` 返回的 `name`。默认在个人工作区创建，其他工作区 ID 从 `workspaces` 获取，用 `--workspace ID` 指定。

登分表自带公式和视图，权重与等级按课程要求调整。需要定制时，先用 `preset` 导出[登分模板](templates/gradebook.json)，修改后用 `--input` 创建。文件结构为 `{"tables":[{"name":"工作表名","columns":[...],"views":[...]}]}`。

## 写入与更新记录

```bash
njucli table append UUID "工作表名" --input ./rows.json --format json
njucli table update UUID "工作表名" --input ./updates.json --format json
```

- 追加新行（append）的输入格式为字段名键值对数组：
  `[{"学号": "DEMO-001", "姓名": "同学", "平时成绩": 85}]`
- 更新现有行（update）的输入格式须包含行 ID：
  `[{"row_id": "从 rows 获取的 _id", "row": {"期末成绩": 90}}]`

每批可提交 1–1000 行。学号等编号保持字符串格式，空数值填 `null`，公式列由平台自动计算。
复杂字段沿用 `show` 或 `rows` 返回的格式，附件使用已有文件对象。写入结果不明时，先查对应行，确认哪些已保存。

需要从表格生成在线报告时，读取指定数据后使用 Box 的 `doc-create/doc-read/doc-update`；选定字段可整理为 `chart.json`，用 `box chart-create` 生成可编辑图表，再用 `box doc-embed-whiteboard` 嵌入报告。最后把文档返回的 `url` 填回指定行。文档存入南大云盘，访问沿用云盘权限。流程见[表格到在线报告](../njucli-box/references/documents.md#表格到在线报告)。

## 字段与视图维护

```bash
njucli table sheet-add UUID --input sheet.json --format json
njucli table column-add UUID "工作表名" --input column.json --format json
njucli table view-add UUID "工作表名" --input view.json --format json
njucli table view-update UUID "工作表名" --input view.json --format json
```

输入格式可以参考[登分模板](templates/gradebook.json)：`sheet.json` 使用 `tables` 中的一个对象，`column.json` 使用 `columns` 中的一个对象，`view.json` 使用 `views` 中的一个对象。字段使用 `column_name/column_type/column_data`；公式用 `{字段名}` 引用，按依赖顺序排列，首列使用原始数据。

修改视图时，`name` 填已有视图名，其余设置按需提供。创建中途失败时，保留已返回的表格 UUID 并在原表上修正。完成后给出表格链接和写入结果。接口字段见[接口说明](references/interfaces.md)。
