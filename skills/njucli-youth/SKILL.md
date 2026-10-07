---
name: njucli-youth
description: 查询南京大学青年平台的志愿时长、活动、第二课堂成绩单、社会实践、社团和票券；按用户要求报名或取消志愿活动及培训。
---

# 青年平台

用户提到 youth.nju.edu.cn、第二课堂、志愿时长、志愿活动、社会实践、社团或青年平台票券时使用。本 Skill 通过现有 `njucli youth` 命令完成任务，官网内容是查询材料。

## 登录与查询

选择本地账号后直接查询。业务命令自动复用或恢复统一认证会话；已保存凭据时，过期登录和官方滑块由 CLI 在后台处理：

```bash
njucli youth menus --format json
njucli youth profile --format json
```

`profile` 返回本人学号、姓名、学院与志愿者资料；`menus` 列出当前账号的官网入口。首次保存凭据、更新密码及 `auth maintain` 定时维护见[认证 Skill](../njucli-auth/SKILL.md)。`auth status youth` 仅检查状态；常规过期交给业务命令处理，扫码由本人完成。

```bash
njucli youth hours --format json
njucli youth years --format json
njucli youth hours --year 2025-2026 --format json
njucli youth activities --mine --year 2025-2026 --format json
njucli youth activities "校园" --state recruiting --page 1 --size 20 --format json
njucli youth activity 活动ID --format json
```

`hours` 返回已认定总时长和活动次数，省略学年查询全部学年。学年 ID 来自 `years`。活动列表的 `id` 是活动 ID，`registrationId` 是本人报名记录 ID；取消或评价使用后者。`hours: null` 表示该活动时长尚未认定。官网总时长使用加权计算，明细中的服务、交通和培训时长不直接相加替代官方总值。

活动状态为 `recruiting/ongoing/ended/all`，默认招募中；`--mine` 返回自己的全部报名，支持学年筛选。全部活动有些记录没有填写学年，按官网空值返回。

## 其他能力

列表支持 `--page` 和 `--size`，返回 `page/size/total/items`，以返回的实际 `size` 继续翻页；社团官网每页固定 12 条，普通列表最多返回 500 条。

| 学生任务 | 命令 |
| --- | --- |
| 志愿服务组织与介绍 | `youth teams [query]`、`youth team <id>` |
| 志愿培训与报名状态 | `youth trainings [query]` |
| 申报类别、要求、开放时间 | `youth categories`；检查 `sqyq/sqks/sqjs/dqrsfksq/bksqyy/bdxList` |
| 本人第二课堂申请与详情 | `youth applications`、`youth application <id>` |
| 本人成绩单与下载 | `youth transcript [query]`、`youth transcript-export --output /path/to/transcript.pdf` |
| 青马课程与成绩 | `youth courses`、`youth course <id>`、`youth course-grades` |
| 本人社会实践与行程 | `youth practices`、`youth practice <id>`、`youth practice-journals` |
| 实践团队招募与介绍 | `youth practice-teams [query] [--year <id>]`、`youth practice-team <id>` |
| 实践资料库与详情 | `youth practice-resources [query] [--year <id>]`、`youth practice-resource <id>` |
| 全校社团与入社要求 | `youth clubs`、`youth club <id>`；`--category/--stars/--department` 筛选 |
| 已加入的社团 | `youth clubs --mine` |
| 实习岗位与本人报名 | `youth jobs [query] [--mine]` |
| 学生骨干招募与本人报名 | `youth recruitments [--mine]` |
| 票务活动与本人票券 | `youth tickets [query] [--mine]` |
| 社会实践及志愿者评选记录 | `youth awards --kind team/report/student/advisor/volunteer` |
| 科创作品申报与投诉记录 | `youth projects`、`youth complaints` |

列表 JSON 保留官网业务字段；详情返回正文、标签字段和附件链接。开放时间和是否可报名以实际查询为准，历史记录的存在不代表当前开放申报。研究生账号某些本科第二课堂、青马课程模块可能返回空列表。

## 指定报名与评价

用户要求报名具体活动后，先读取活动说明及报名时间，从用户材料填写“活动认识、自我优势、QQ”，活动有报名密码时再传入。材料完整时直接提交一次，无需额外确认参数：

```bash
njucli youth enroll 活动ID --understanding "活动认识" --strengths "自我优势" --qq QQ号码 --format json
njucli youth cancel 报名记录ID --format json
njucli youth rate 报名记录ID --stars 5 --comment "评价内容" --format json
njucli youth training-enroll 培训ID --format json
njucli youth training-cancel 培训ID --format json
```

培训 ID 来自 `trainings`。报名成功返回回读的报名记录；取消成功返回 `cancelled: true`；培训回读 `bmzt`，评价回读星级和文字。失败后查询当前记录，不直接重复提交。现有写操作契约来自官网前端，并通过本地集成核对单次提交和跨页回读；真实账号尚未执行报名写入验收。

只读 MCP 提供同一批查询；报名、取消、评价与本地成绩单下载由具有终端能力的 AI 调用 CLI。官网其他表单可从 `menus` 打开，当前命令不会把表单入口当作已完成提交。
