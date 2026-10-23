---
name: njucli-lms
description: 查询南京大学智汇南雍（lms.nju.edu.cn）的课程、作业、测试和待办，上传下载文件，提交或撤回本人作业，使用教师或助教权限管理作业。用户提到智慧南雍、智汇南雍、LMS 或 njucli lms 时使用。
---

# 智汇南雍

直接执行业务命令，NJUCLI 会使用统一认证会话连接平台。仅在命令返回需要本人登录或验证时运行 `njucli auth login lms`。

## 课程与学习任务

```bash
njucli lms courses --format json
njucli lms courses "课程名称" --page 1 --format json
njucli lms course COURSE_ID --format json
njucli lms activities COURSE_ID --format json
njucli lms assignments COURSE_ID --page 1 --format json
njucli lms assignment ACTIVITY_ID --format json
njucli lms exams COURSE_ID --format json
njucli lms todos --format json
```

课程与作业列表每页 20 项，使用返回的 `nextPage` 翻页。课程的 `is_instructor` 表示教学侧权限，包含教师与助教；`instructor_assistants` 列出课程助教。课程详情提供学年、学期和课程起止日期。

`activities` 返回课件等学习活动及附件信息。作业详情提供正文、发布状态、截止时间及官方活动链接。附件和课程内容可在返回的官方链接中打开。

平台将“作业”和“测试”分别存储。教师可能使用“测试”布置书面作业，因此查找课程作业时同时读取 `assignments` 和 `exams`。`todos` 对应平台首页待办。

## 助教布置作业

先读取目标课程，核对课程名称、学期和教学权限。创建个人作业需要教师或助教权限，目标课程和作业材料以用户要求为准。

准备 `assignment.json`：

```json
{
  "title": "第一周练习",
  "description": "<p>请完成第一章练习，并上传 PDF。</p>",
  "endTime": "2026-10-22T23:59:00+08:00"
}
```

标题、正文和截止时间必填。正文使用 HTML；时间须包含秒和时区。可选 `startTime` 指定开放时间，且早于截止时间。

```bash
# 保存未发布草稿
njucli lms create-assignment COURSE_ID --input assignment.json --format json

# 创建并发布；加 --notify 发送平台邮件及待办通知
njucli lms create-assignment COURSE_ID --input assignment.json --publish --format json
```

创建采用个人作业、教师评分、无限提交次数、最高得分、成绩比例 0、允许撤回、评分后公布成绩。默认保存草稿，通知默认关闭；`--notify` 与 `--publish` 配合使用。发布操作需要用户明确要求发布该作业。

成功结果来自创建后的详情回读，包含作业编号与链接。若创建已完成而回读出错，使用错误中的编号运行 `assignment` 核对，再决定下一步。每次 `create-assignment` 都会创建新作业。

## 单个文件

```bash
njucli lms file UPLOAD_ID --format json
njucli lms download UPLOAD_ID --output ./附件.pdf --format json
njucli lms upload COURSE_ID ./文件.pdf --format json
njucli lms delete-file UPLOAD_ID --format json
```

文件编号取自活动的 `uploads[].id` 或上传结果。下载按当前账号的远端权限执行，同名本地文件会被覆盖。上传返回文件编号、大小与就绪状态；当前学校的 MEDIA 存储支持直接上传。文件记录已建立而上传未完成时，错误保留 `uploadId`，可用 `file` 查询。

## 修改、发布和删除已有作业

```bash
njucli lms update-assignment ACTIVITY_ID --input ./修改.json --format json
njucli lms publish-assignment ACTIVITY_ID --format json
njucli lms unpublish-assignment ACTIVITY_ID --format json
njucli lms delete-assignment ACTIVITY_ID --format json
```

修改 JSON 可含 `title`、HTML `description`、`startTime`、`endTime`、`uploadIds`，至少一项。时间格式沿用创建作业，`startTime: null` 清除开放时间。`uploadIds` 替换作业附件列表，空数组清空附件；省略时保留。原有评分和完成条件从学校回读保留。发布及取消发布使用目标已有作业，不创建新作业，关闭通知。删除作业后回读其已不存在。

## 本人作业提交

```bash
njucli lms submissions ACTIVITY_ID --format json
njucli lms submit-assignment ACTIVITY_ID --input ./提交.json --format json
njucli lms retract-submission ACTIVITY_ID SUBMISSION_ID --format json
```

提交 JSON 使用 `comment`（HTML 或文字）和 `uploadIds`，至少提供一项；`draft: true` 保存提交草稿。多选题型作业可加 `multipleChoiceTitle`。每次提交会建立新记录；提交结果不明确时，通过 `submissions` 核对本人记录，避免重复提交。

`SUBMISSION_ID` 来自本人的目标作业记录。撤回受作业允许撤回、截止时间及当前记录状态限制，由学校接口决定；撤回后记录可能成为草稿。教学身份不等于学生提交权限，学校拒绝时保留 `PERMISSION_DENIED`。

MCP 提供对应的文件、作业管理与本人提交原子工具。批改仍使用官方活动页面。

接口与实网验证范围见[接口说明](references/interfaces.md)。
