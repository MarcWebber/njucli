# 智汇南雍接口

来源为 [智汇南雍](https://lms.nju.edu.cn/user/index#/)，以下路径相对 `https://lms.nju.edu.cn`。2026-10-15 通过已登录官网的请求、静态前端代码和实际 HTTP 响应核对。

## 登录

`GET /user/index` 经 `lms-identity.nju.edu.cn/auth/realms/nju/protocol/cas/login` 与学校统一认证交换会话。认证 driver 依赖 SSO，复用 `BrowserSession` 当次 Cookie、账号锁与会话存储。登录成功以最终回到本站 `/user/index` 且 HTML 中 `globalData.user.id` 存在为准。

LMS 的 CAS 回调会返回 `http://lms.nju.edu.cn/user/index`。客户端逐跳处理认证重定向，将本站回调升级为 HTTPS，保持票据参数与同一 Cookie 会话；不会发送 HTTP 票据请求。跳转及页面校验由 LMS client 负责。

业务请求直接使用共享 HTTP 会话。HTTP 错误由统一输出层报告；一次写入只提交一次，请求失败后的处理交给调用方。

## 查询

| 请求 | 参数与结果 |
| --- | --- |
| `POST /api/my-courses` | 只读查询。JSON 包含 `page/page_size/fields/conditions`；`keyword` 筛选课程名或课程号，`classify_type=recently_started` 排序；返回 `courses/page/page_size/pages/total` |
| `GET /api/courses/{id}?fields=...` | 课程信息、学年、学期、教师、`start_date/end_date` |
| `GET /api/courses/{id}/activities` | `activities`：课件等活动。作业与测试使用各自列表 |
| `GET /api/courses/{id}/homework-activities?page=&page_size=` | `homework_activities` 和分页信息；列表条目的课程编号由本次目标确定 |
| `GET /api/activities/{id}` | 活动详情，正文为 `data.description`，附件为 `uploads`；`type=homework` 表示作业 |
| `GET /api/courses/{id}/exams` | `exams`：测试类型活动，包含标题、创建时间、起止时间及发布状态 |
| `GET /api/todos` | `todo_list`：首页待办 |

列表页码从 1 开始，每页 20 项；空列表可以返回 `page=0/pages=0`。CLI 与 MCP 根据 `page/pages` 返回 `nextPage`。`is_instructor=true` 涵盖教师及助教，具体助教成员来自 `instructor_assistants`。

活动 URL 为 `/course/{course_id}/learning-activity#/{id}`。`start_time/end_time/created_at/updated_at` 使用带时区时间；课程起止日期使用日期字符串，结束日期可为 `null`。

## 创建作业

`POST /api/courses/{course_id}/activities`，类型为 `homework`。请求契约来自官网“新增作业”表单，实际必填截止字段为 `end_time`。远端接受 UTC `Z` 时间；CLI 在输入边界将带时区的时间转换为 UTC，保留秒精度。主要字段：

| 字段 | 语义 |
| --- | --- |
| `title/description/start_time/end_time` | 标题、HTML 正文、开放时间和截止时间 |
| `published` | `false` 保存草稿，`true` 发布 |
| `notify_by_email/notify_by_todo` | 邮件和待办通知；CLI 默认均为 `false` |
| `submit_by_group/non_submit_times/submit_times` | 个人作业、无限提交次数 |
| `review_by_instructor/instructor_score_percentage` | 教师评分及 100% 评分占比 |
| `score_percentage/score_rule/score_type` | 课程成绩比例 0、最高得分、百分制 |
| `announce_score_type/allow_retract` | 评分后公布成绩、允许撤回 |
| `uploads/other_resources/prerequisites` | 本命令创建时为空 |

成功返回 HTTP 201 和活动 `id`。随后 `GET /api/activities/{id}` 核对课程、类型、标题、正文、时间和发布状态。回读出错时保留创建编号，供调用方继续核对。

## 验证范围

CLI 与 MCP 共用同一业务实现；MCP 只注册查询。

认证实网已核对课程列表与筛选、课程详情、课件列表、测试列表、作业列表、助教草稿创建和详情回读。该账号的学生课程作业列表及首页待办均为空；学生作业非空列表和待办非空结果仍待实网核对。发布和发送通知待使用者提供正式作业材料与目标后核对。

接入验证使用已授权的历史课程；测试草稿以未发布状态创建，关闭邮件和待办通知，核对后清理。课程本身的结束日期为空，历史内容日期仅用于确认本次验证背景。
