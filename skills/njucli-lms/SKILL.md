---
name: njucli-lms
description: 查询南京大学智汇南雍（lms.nju.edu.cn）的课程、课件、作业、测试和待办，使用教师或助教权限创建作业。用户提到智慧南雍、智汇南雍、LMS 或 njucli lms 时使用。
---

# 智汇南雍

以下命令在本 Skill 目录运行。首次使用先运行 `node scripts/run.mjs auth login lms`；业务命令也会按需恢复校园登录。

## 课程与学习任务

```bash
node scripts/run.mjs lms courses --format json
node scripts/run.mjs lms courses "课程名称" --page 1 --format json
node scripts/run.mjs lms course COURSE_ID --format json
node scripts/run.mjs lms activities COURSE_ID --format json
node scripts/run.mjs lms assignments COURSE_ID --page 1 --format json
node scripts/run.mjs lms assignment ACTIVITY_ID --format json
node scripts/run.mjs lms exams COURSE_ID --format json
node scripts/run.mjs lms todos --format json
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
node scripts/run.mjs lms create-assignment COURSE_ID --input assignment.json --format json

# 创建并发布；加 --notify 发送平台邮件及待办通知
node scripts/run.mjs lms create-assignment COURSE_ID --input assignment.json --publish --format json
```

创建采用个人作业、教师评分、无限提交次数、最高得分、成绩比例 0、允许撤回、评分后公布成绩。默认保存草稿，通知默认关闭；`--notify` 与 `--publish` 配合使用。发布操作需要用户明确要求发布该作业。

成功结果来自创建后的详情回读，包含作业编号与链接。若创建已完成而回读出错，使用错误中的编号运行 `assignment` 核对，再决定下一步。每次 `create-assignment` 都会创建新作业。

后续编辑、发布已有草稿、附件上传及批改通过官方活动页面完成。MCP 提供上述查询工具，写入通过 CLI 执行。

接口与实网验证范围见[接口说明](references/interfaces.md)。
