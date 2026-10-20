---
name: njucli-ehall
description: 查询南京大学教务与网上办事大厅 (e-Hall)，包括空闲教室、课表、成绩、考试、培养方案与日历导出，办理研究生选退课、行程填报、个人资料维护及奖学金草稿填写。
---

# 教务与网上办事

正式电子成绩单和自助打印证明使用已安装的 `njucli-self-service` Skill，或统一 CLI 的 `njucli self-service items 成绩单`。本 Skill 的成绩查询用于查看课程成绩。

## 空闲教室

使用当前账号的 EHall 会话，按日期、校区和节次直接查询。

```bash
njucli ehall classroom-campuses --format json
njucli ehall classroom-buildings 3 --format json
njucli ehall classrooms tomorrow --campus 3 --period 5-8 --format json
njucli ehall classrooms today --campus 3 --period 5 --building 11 --format json
```

校区代码由 `classroom-campuses` 获取，教学楼代码由 `classroom-buildings` 获取。日期支持 `today`、`tomorrow`、`YYYY-MM-DD`，省略日期使用今天。`--period` 必填，填写单节或连续区间；结果表示整个区间均空闲，包含教室、教学楼、座位数和空闲时间。

一次返回全部匹配教室，`total` 为匹配总数。只读 MCP 对应 `ehall_classroom_campuses`、`ehall_classroom_buildings`、`ehall_classrooms`。接口与验证范围见[空闲教室接口](references/interfaces.md#空闲教室)。

## 研究生个人资料

查询、填写和管理南京大学研究生的学术与荣誉资料，包括论文、获奖、专利、著作和参与项目。支持上传证书等附件。

- `njucli ehall profile --format json`：查询已有资料记录（省略 kind 返回所有开放栏目）。
- `njucli ehall profile-fields <kind> --format json`：查询指定类别的表单字段和字典选项。
- `njucli ehall profile-add <kind> --input <file> [--attachment <file>] --format json`：新增一条个人资料。
- `njucli ehall profile-remove <kind> <RECORD_ID> --format json`：删除指定资料记录。

详细字段、验证逻辑与填写指引，请参阅 [个人资料填写](references/profile.md)。

## 课表查询与日历导出

```bash
njucli ehall today --format json
njucli ehall week --format json
njucli ehall next --format json
njucli ehall schedule --format json
njucli ehall graduate-schedule --format json
njucli ehall export ./schedule.ics --format json
```

本科课表用 `schedule` 查询，`today`、`week`、`next` 分别查看某日、本周和下一节课程；日期可填 `today`、`tomorrow` 或 `YYYY-MM-DD`。`export` 导出本科课表为 ICS 日历，同名文件会被覆盖。

研究生课表用 `graduate-schedule` 查询。课表可加 `--term 学期ID` 指定学期，省略时采用当前或默认学期；本科的学期 ID 从 `ehall terms` 获取。

## 研究生成绩、考试与培养方案

```bash
njucli ehall grades --format json
njucli ehall exams --format json
njucli ehall plan --format json
```

`grades`（成绩）和 `exams`（考试安排）可加 `--term` 查询指定学期，省略时查询当前或默认学期；`plan` 查询研究生培养方案。

## 研究生选课与退课

```bash
njucli ehall available "关键词" --kind public --format json
njucli ehall select 教学班ID --kind public --format json
njucli ehall selected --format json
njucli ehall withdraw 教学班ID --format json
```

先查 `available`，方案内课程用 `--kind plan`，公选课用 `--kind public`。教学班 ID 来自结果中的 `classId`；提交选课时沿用同一类别。

退课先查 `selected`，再用对应的 `classId` 执行 `withdraw`。选退课结果不明确时，先查 `selected` 确认当前状态，再决定后续操作。

## 办事服务与假期行程

```bash
njucli ehall services "证明" --format json
njucli ehall link 应用ID --format json
njucli ehall tasks --kind todo --format json
njucli ehall applications --state active --format json
njucli ehall trip --format json
```

应用 ID 来自 `services` 的 `appId`，用 `link` 获取官网入口。

`tasks` 查看任务（`--kind` 支持 `todo/done/started`）；`applications` 查看本人发起的审批（`--state` 支持 `active/completed/cancelled`）。

假期行程先用 `trip` 查询当前假期、已有登记与必填字段。留校、离返校及多段行程的具体填报参数见[行程填报](references/trip.md)。提交结果不明时先查 `trip` 确认。

## 研究生奖学金

```bash
njucli ehall scholarship list --format json
njucli ehall scholarship applications --format json
njucli ehall scholarship save --input ./draft.json --dry-run --format json
njucli ehall scholarship save --input ./draft.json --format json
```

使用 `scholarship list`、`show` 和 `form` 查询奖种、等级及填写模板。先用 `save --dry-run` 预览，再保存本人 `SHZT=0` 的草稿并回读确认；支持申请理由、社会实践、科研创新说明、联系方式及首次附件上传。已有附件保留，替换和删除在官网办理。参数及验证范围见[奖学金填写](references/scholarship.md)。

使用 `scholarship applications` 和 `application` 核对本人申请，状态采用远端原文；“待辅导员审核”表示流程仍在进行。大厅通用 `ehall applications` 的空结果不能判断奖学金未提交。草稿保存后向用户提供返回的 `reviewUrl` 核对链接和申请编号，说明用相应账号进入“我的申请”，确认内容及附件后自行提交。

接口字段见[接口说明](references/interfaces.md)。
