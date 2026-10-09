---
name: njucli-se
description: 查询南京大学软件学院教学平台 (selearning.nju.edu.cn) 的课程、作业、附件与成绩，获取作业提交链接，办理自助选课。用户涉及软院平台或 njucli se 时使用。
---

# 软件学院教学平台

以下命令在本 Skill 目录运行。首次使用需登录：`node scripts/run.mjs auth login se`。

## 课程与人员

```bash
node scripts/run.mjs se catalog --format json
node scripts/run.mjs se courses --format json
node scripts/run.mjs se course COURSE_ID --format json
node scripts/run.mjs se participants COURSE_ID --page 1 --format json
```

`catalog` 返回全部可见课程，`courses` 返回我的已选课程。
`COURSE_ID` 取自这些列表或官方课程链接。`course` 查看章节与活动。
`participants` 查看课程名单，用返回的 `nextPage` 作为下一次的 `--page`。

## 作业与附件

```bash
node scripts/run.mjs se assignments --pending --format json
node scripts/run.mjs se assignment ACTIVITY_ID --format json
node scripts/run.mjs se download ACTIVITY_ID FILE_NAME --output ./附件.pdf
node scripts/run.mjs se submission-link ACTIVITY_ID --format json
```

`assignments --pending` 筛选待完成作业；`assignment` 查看作业要求及附件。
`ACTIVITY_ID` 取自作业列表或课程活动，`FILE_NAME` 取自作业详情中的附件名。
`download` 保存附件到指定路径，同名文件直接覆盖。

作业提交在 `submission-link` 返回的官方页面完成，将这个链接交给用户。

## 成绩与选课

```bash
node scripts/run.mjs se grades COURSE_ID --format json
node scripts/run.mjs se enroll COURSE_ID --format json
```

`grades` 查询课程提供的成绩项。

`enroll` 进行自助选课；若该课程需要选课密钥，通过环境变量 `NJUCLI_SE_ENROLMENT_KEY` 提供。提交后调用 `se course COURSE_ID` 确认已加入课程。
