---
name: njucli-se
description: 查询南京大学软件学院教学平台 selearning.nju.edu.cn 的课程、名单、作业和成绩，下载附件，按用户要求自助选课。
---

# 软件学院课程与作业

将 `SKILL_DIR` 设为本 Skill 所在目录的绝对路径。首次使用可运行 `node "$SKILL_DIR/scripts/run.mjs" auth login se` 登录。

```bash
node "$SKILL_DIR/scripts/run.mjs" se catalog --format json
node "$SKILL_DIR/scripts/run.mjs" se courses --format json
node "$SKILL_DIR/scripts/run.mjs" se participants COURSE_ID --page 1 --format json
node "$SKILL_DIR/scripts/run.mjs" se course COURSE_ID --format json
node "$SKILL_DIR/scripts/run.mjs" se assignments --pending --format json
node "$SKILL_DIR/scripts/run.mjs" se assignment ACTIVITY_ID --format json
node "$SKILL_DIR/scripts/run.mjs" se download ACTIVITY_ID FILE_NAME --output /absolute/path/file
node "$SKILL_DIR/scripts/run.mjs" se grades COURSE_ID --format json
node "$SKILL_DIR/scripts/run.mjs" se submission-link ACTIVITY_ID --format json
```

`catalog` 返回全部可见课程，`courses` 返回我的课程。课程 ID 从这些结果或官方课程链接取得；作业 ID 来自课程活动或作业列表，附件名来自作业详情。名单按返回的 `nextPage` 翻页，`userId` 是 Moodle 用户 ID。

自助选课使用 `se enroll COURSE_ID`，选课密钥通过 `NJUCLI_SE_ENROLMENT_KEY` 提供。提交后读取目标课程确认加入成功。作业提交通过 `submission-link` 返回的官方页面完成。

## 接口与验证

[软件学院教学支持系统](https://selearning.nju.edu.cn/)使用 Moodle，以下路径相对本站。

| 路径 | 用途 |
| --- | --- |
| `/my/`、`/course/index.php`、`/course/search.php` | 我的课程、分类目录与搜索 |
| `/course/view.php?id=COURSE_ID` | 课程章节与活动 |
| `/user/index.php?id=COURSE_ID&page=N&perpage=20` | 课程名单，接口页码从 0 开始 |
| `/mod/assign/view.php?id=ACTIVITY_ID` | 作业要求、提交状态及附件 |
| `/grade/report/index.php?id=COURSE_ID` | 课程成绩 |
| `/enrol/index.php?id=COURSE_ID` | 自助选课表单 |

附件使用详情返回的同源 `/pluginfile.php/` 链接。自助选课保留官方表单隐藏字段，按 [Moodle 选课规则](https://github.com/moodle/moodle/blob/v3.10.8/enrol/index.php)核对跳转后的课程。

已核对登录后的课程、作业和成绩页面，以及课程目录、名单分页和权限错误。附件下载与自助选课的真实提交待验收。
