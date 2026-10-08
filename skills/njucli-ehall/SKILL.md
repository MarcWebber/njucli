---
name: njucli-ehall
description: 查询南京大学成绩、考试、培养方案和课表，导出日历，办理研究生选课与退课，查询 e-Hall 服务和任务，填报节假日离返校行程。
---

# 教务与网上办事

## 运行

将 `SKILL_DIR` 设为本 Skill 所在目录的绝对路径：

```bash
node "$SKILL_DIR/scripts/run.mjs" ehall --help
```

## 常用操作

以下命令均接在 `node "$SKILL_DIR/scripts/run.mjs" ehall` 后，可加 `--format json` 读取结构化结果。

| 任务 | 命令 |
| --- | --- |
| 研究生成绩、考试、培养方案 | `grades`、`exams`、`plan` |
| 研究生课表 | `graduate-schedule [--term 学期ID]` |
| 本科个人课表与学期 | `terms`、`current-term`、`schedule [--term 学期ID]` |
| 某日、本周、下一节课程 | `today [日期]`、`week [日期]`、`next` |
| 导出 ICS 日历 | `export 输出路径 [--term 学期ID]` |
| 研究生可选课程、已选课程 | `available [关键词]`、`selected` |
| 查询办事服务与官方入口 | `services [关键词]`、`link 应用ID` |
| 待办、已办、本人发起的任务 | `tasks`；`--kind` 可选 `todo`、`done`、`started` |
| 本人发起的办件 | `applications`；`--state` 可选 `active`、`completed`、`cancelled` |
| 假期行程查询与填报 | `trip`、`trip-submit` |

```bash
node "$SKILL_DIR/scripts/run.mjs" ehall grades --format json
node "$SKILL_DIR/scripts/run.mjs" ehall graduate-schedule --format json
node "$SKILL_DIR/scripts/run.mjs" ehall today --format json
node "$SKILL_DIR/scripts/run.mjs" ehall export ./schedule.ics --format json
node "$SKILL_DIR/scripts/run.mjs" ehall services "证明" --format json
```

`grades`、`exams` 和课表查询可用 `--term` 指定学校返回的学期 ID，省略时采用当前或接口默认学期。本科个人课表的学期 ID 从 `terms` 取得；`today/week` 接受 `today`、`tomorrow` 或 `YYYY-MM-DD`。日历保存到用户指定位置。

## 选课与填报

选课先查询 `available`，方案内课程用 `--kind plan`，公选课用 `--kind public`；教学班 ID 取结果中的 `classId`。用户指定课程后运行 `select 教学班ID --kind public`，`--kind` 与查询范围保持一致。退课先查 `selected`，再运行 `withdraw 教学班ID`。每次提交后核对返回结果；结果不明时先查询 `selected` 确认现状。

假期行程先用 `trip` 读取当前假期、已有登记和缺失字段，一次收齐本次行程后提交。留校、离返校及多段行程的参数见[行程填报](references/trip.md)。向用户交付登记结果和 `recordId`；失败后先查询当前登记。

接口字段和验证范围见[接口说明](references/interfaces.md)。
