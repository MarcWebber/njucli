---
name: njucli-ehall
description: 查询南京大学教务与网上办事大厅 (e-Hall)，包括课表、成绩、考试、培养方案、导出日历，办理研究生选退课与假期行程填报。用户涉及教务、选课或办事大厅时使用。
---

# 教务与网上办事

以下命令在本 Skill 目录运行。

## 课表查询与日历导出

```bash
node scripts/run.mjs ehall today --format json
node scripts/run.mjs ehall week --format json
node scripts/run.mjs ehall next --format json
node scripts/run.mjs ehall schedule --format json
node scripts/run.mjs ehall graduate-schedule --format json
node scripts/run.mjs ehall export ./schedule.ics --format json
```

本科课表用 `schedule` 查询，`today`、`week`、`next` 分别查看某日、本周和下一节课程；日期可填 `today`、`tomorrow` 或 `YYYY-MM-DD`。`export` 导出本科课表为 ICS 日历，同名文件会被覆盖。

研究生课表用 `graduate-schedule` 查询。课表可加 `--term 学期ID` 指定学期，省略时采用当前或默认学期；本科的学期 ID 从 `ehall terms` 获取。

## 研究生成绩、考试与培养方案

```bash
node scripts/run.mjs ehall grades --format json
node scripts/run.mjs ehall exams --format json
node scripts/run.mjs ehall plan --format json
```

`grades`（成绩）和 `exams`（考试安排）可加 `--term` 查询指定学期，省略时查询当前或默认学期；`plan` 查询研究生培养方案。

## 研究生选课与退课

```bash
node scripts/run.mjs ehall available "关键词" --kind public --format json
node scripts/run.mjs ehall select 教学班ID --kind public --format json
node scripts/run.mjs ehall selected --format json
node scripts/run.mjs ehall withdraw 教学班ID --format json
```

先查 `available`，方案内课程用 `--kind plan`，公选课用 `--kind public`。教学班 ID 来自结果中的 `classId`；提交选课时沿用同一类别。

退课先查 `selected`，再用对应的 `classId` 执行 `withdraw`。选退课结果不明确时，先查 `selected` 确认当前状态，再决定后续操作。

## 办事服务与假期行程

```bash
node scripts/run.mjs ehall services "证明" --format json
node scripts/run.mjs ehall link 应用ID --format json
node scripts/run.mjs ehall tasks --kind todo --format json
node scripts/run.mjs ehall applications --state active --format json
node scripts/run.mjs ehall trip --format json
```

应用 ID 来自 `services` 的 `appId`，用 `link` 获取官网入口。

`tasks` 查看任务（`--kind` 支持 `todo/done/started`）；`applications` 查看本人发起的审批（`--state` 支持 `active/completed/cancelled`）。

假期行程先用 `trip` 查询当前假期、已有登记与必填字段。留校、离返校及多段行程的具体填报参数见[行程填报](references/trip.md)。提交结果不明时先查 `trip` 确认。

接口字段见[接口说明](references/interfaces.md)。
