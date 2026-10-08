---
name: njucli-youth
description: 查询南京大学青年平台的志愿时长、活动、第二课堂成绩单、社会实践、社团和票券；按用户要求报名或取消志愿活动及培训。
---

# 青年平台

将 `SKILL_DIR` 设为本 Skill 目录的绝对路径。首次登录可运行 `node "$SKILL_DIR/scripts/run.mjs" auth login youth`；`youth menus` 返回当前账号的官网入口，`youth profile` 查询本人资料。

## 志愿时长与活动

```bash
node "$SKILL_DIR/scripts/run.mjs" youth years --format json
node "$SKILL_DIR/scripts/run.mjs" youth hours --format json
node "$SKILL_DIR/scripts/run.mjs" youth hours --year YEAR_ID --format json
node "$SKILL_DIR/scripts/run.mjs" youth activities --mine --year YEAR_ID --format json
node "$SKILL_DIR/scripts/run.mjs" youth activities "校园" --state recruiting --page 1 --size 20 --format json
node "$SKILL_DIR/scripts/run.mjs" youth activity ACTIVITY_ID --format json
```

学年 ID 来自 `years`；省略学年查询全部。总时长采用官方加权结果；活动 `hours: null` 表示尚未认定。活动的 `id` 用于查详情及报名，`registrationId` 用于取消和评价。活动状态为 `recruiting/ongoing/ended/all`，默认招募中；`--mine` 查询本人全部报名。

## 其他查询

下表命令均接在 `node "$SKILL_DIR/scripts/run.mjs"` 后，可加 `--format json`。列表支持 `--page/--size`，按返回的实际 `page/size/total` 翻页；社团固定每页 12 条，其他列表最多每页 500 条。

| 任务 | 命令 |
| --- | --- |
| 志愿组织与培训 | `youth teams [query]`、`youth team ID`、`youth trainings [query]` |
| 申报类别与本人申请 | `youth categories`、`youth applications`、`youth application ID` |
| 第二课堂成绩单 | `youth transcript [query]`、`youth transcript-export --output ./transcript.pdf` |
| 青马课程与成绩 | `youth courses`、`youth course ID`、`youth course-grades` |
| 本人社会实践与行程 | `youth practices`、`youth practice ID`、`youth practice-journals` |
| 实践团队招募 | `youth practice-teams [query] [--year ID]`、`youth practice-team ID` |
| 实践资料库 | `youth practice-resources [query] [--year ID]`、`youth practice-resource ID` |
| 社团 | `youth clubs [--mine]`、`youth club ID`；支持 `--category/--stars/--department` 筛选 |
| 实习岗位与骨干招募 | `youth jobs [query] [--mine]`、`youth recruitments [--mine]` |
| 票务活动与本人票券 | `youth tickets [query] [--mine]` |
| 评选记录 | `youth awards --kind team/report/student/advisor/volunteer` |
| 科创申报与投诉 | `youth projects`、`youth complaints` |

列表保留官网字段，详情含正文和附件链接。申报要求及开放状态查看 `categories` 的 `sqyq/sqks/sqjs/dqrsfksq/bksqyy/bdxList`；部分模块对研究生账号返回空列表。

## 报名、取消与评价

先读活动详情及开放时间，使用用户提供的活动认识、自我优势和 QQ；需要报名密码时加 `--password`。

```bash
node "$SKILL_DIR/scripts/run.mjs" youth enroll ACTIVITY_ID --understanding "活动认识" --strengths "自我优势" --qq QQ号码 --format json
node "$SKILL_DIR/scripts/run.mjs" youth cancel REGISTRATION_ID --format json
node "$SKILL_DIR/scripts/run.mjs" youth rate REGISTRATION_ID --stars 5 --comment "评价内容" --format json
node "$SKILL_DIR/scripts/run.mjs" youth training-enroll TRAINING_ID --format json
node "$SKILL_DIR/scripts/run.mjs" youth training-cancel TRAINING_ID --format json
```

培训 ID 来自 `trainings`。材料完整后提交一次；成功返回回读的报名、取消状态或评价。失败后先查询当前记录。查询及成绩单下载已实网验证；报名、取消和评价已通过本地集成，实网写入待验证。核对字段时读取[接口说明](references/interfaces.md)。
