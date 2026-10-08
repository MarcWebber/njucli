# SoftSE 课程与作业接口

## 软件学院教学支持系统

[软件学院教学支持系统](https://selearning.nju.edu.cn/)使用 Moodle。以下路径相对本站。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/my/` | 我的课程 |
| GET | `/course/index.php`、`?categoryid={categoryId}` | 分类目录 |
| GET | `/course/search.php?search=...&perpage=20&page=...` | 课程搜索 |
| GET | `/user/index.php?id={courseId}&page={page-1}&perpage=20` | 课程成员 |
| GET | `/course/view.php?id={courseId}` | 章节与活动 |
| GET | `/mod/assign/view.php?id={activityId}` | 作业要求和提交状态 |
| GET | `/grade/report/index.php?id={courseId}` | 成绩 |

课程章节取 `li.section[data-sectionid]`，活动取 `li.activity[id^=module-]`。作业标题取 `#region-main h2`，课程取面包屑，正文及附件取 `#intro`，状态取 `.submissionstatustable`，正式已交标记为 `td.submissionstatussubmitted`。截止时间转换为 `+08:00` 的 ISO 时间；`assignments --pending` 按截止时间排序。成绩取 `table.user-grade` 的 `column-*` 列。

附件下载使用作业返回的同源 `/pluginfile.php/...`，附加 `forcedownload=1`，要求响应为二进制且含 `Content-Disposition: attachment`。

## 课程目录与名单

`catalog` 跟随 `.course_category_tree` 中的分类及分页链接，从 `.coursebox .coursename a` 提取课程，按 `courseId` 去重。空分类通过 `body#page-course-index-category` 和当前 `categoryid` 确认。

`participants` 读取 `#participants tbody tr`，跳过 `.emptyrow`；`th.c0` 的资料链接提供 `userId/name/url`，`td.c1/c2` 提供 `roles/groups`。结果包含 `page/nextPage/items`，末页 `nextPage: null`。`userId` 为 Moodle 用户标识，显示名不作为学号。

## 自助选课

`/enrol/index.php?id={courseId}` 的表单包含 `id/instance/sesskey`、动态 `_qf__...`、可选 `enrolpassword` 和 `submitbutton`。提交保留原隐藏字段；选课密钥来自 `NJUCLI_SOFTSE_ENROLMENT_KEY`。成功后重新访问选课页，须跳转到目标课程且可读取章节。跳转规则见 [Moodle 选课实现](https://github.com/moodle/moodle/blob/v3.10.8/enrol/index.php)。

作业通过 `submission-link` 打开官方提交页。

## 验证范围

课程、作业和成绩页面已完成登录后读取；CLI 已查询 438 门唯一课程，并核对名单分页、末页和权限错误。课程目录及成员解析有本地集成覆盖。真实附件下载和自助选课提交待验收。
