# 学习、体育与云打印原子能力验证

使用用户当次授权的本人账号和实际校园系统。新增材料明确标注 NJUCLI 接口验证；不向课程发送通知。仅转译 TypeScript 供实际 CLI/MCP 执行，没有运行类型检查、测试套件或模拟接口。

## LMS

指定账号真实返回 24 门课程，其中 1 门具有教学权限，23 门为学生身份。23 门学生课程的作业列表均为空。验证作业只在本人具有教学权限的课程中新建，结束后删除。

| 实际入口 | 实际结果与回读 |
| --- | --- |
| `lms file <本次文件>` | 文件名称、大小及 `ready` 状态可读 |
| `lms download <本次文件> --output ...` | 下载最初的 35 字节标注验证文件 |
| `lms upload <本人教学课程> <标注文本>` | 上传 68 字节 UTF-8 文件；文件元数据名称、大小及 `ready` 全部匹配 |
| `lms update-assignment <本次作业> --input ...` | 标题、HTML 正文和附件列表更新成功，逐项回读匹配；保留原有评分与完成条件 |
| `lms publish-assignment <本次作业>` | 发布成功；回读 `published=true` |
| `lms unpublish-assignment <本次作业>` | 取消发布成功；回读 `published=false` |
| `lms submissions <本次作业>` | 本人提交列表读取成功，返回空列表 |
| `lms submit-assignment <本次作业> --input ...` | 教学身份向本次作业提交，学校真实返回 HTTP 403；CLI 保留 `PERMISSION_DENIED`，未建立提交记录 |
| MCP `lms_file` | 真实元数据查询成功 |
| MCP `lms_download` | 下载 68 字节；与上传原文件逐字节相同，SHA-256 为 `455811fdc722db512175eb7a9ddcc0e4c245bfc6bda0e58805e37c3868b57498` |
| MCP `lms_update_assignment` | 修改本次作业标题并回读成功 |
| `lms delete-assignment <本次作业>` | 删除成功，随后读取目标返回 HTTP 404/410 |
| `lms delete-file <本次两个文件>` | 两个文件均删除，回读确认已删除 |

执行摘要见 [CLI/MCP 日志](assets/2026-10-22-learning-atomic/lms-cli-mcp.json)。摘要保留真实退出码、业务错误和清理结果，不包含课程名单、个人身份或会话字段。

### 契约排查结果

- 文件预创建响应的实际存储为 `MEDIA`，当次 `upload_url` 指向学校文件服务。multipart PUT 上传后直接回读 `ready`，不需要模拟回调。
- 更新作业时，详情中的 `completion_criterion` 是说明文字；写入须使用真实条件列表返回的编号及原有值。
- 评分比例保存在 `data.homework_score_percentage`，编辑表单据此构造 `review_by_*` 开关和对应比例。未展开这些字段的请求被学校 HTTP 400 拒绝，未造成作业修改。
- 发布接口的 `published` 是布尔值。学校曾对字符串参数返回成功计数，但目标状态未变，因此实现以布尔值提交并回读确认。

### 尚未取得成功结果的动作

学生提交与撤回的请求契约来自本次实际加载的官方作业页面。当前学生课程均无作业，教学身份提交被学校拒绝，没有生成可撤回的本人提交。因此仅将该结果记为真实权限拒绝；不声称学生提交、草稿保存或撤回已经成功验收。

随后使用官方“预览课程”功能（`PUT /api/courses/{id}/preview`），回读 `isSimulatingStudent=true`、`isInstructorView=false`，对本次临时作业提交仍 HTTP 403。`finally` 以 DELETE 同一路径退出预览并删除临时作业。没有更改本人或其他学生的课程角色。

已有作业编辑又通过实际 CLI 覆盖设置 `startTime`、清除 `startTime:null`、空开放时间下仅改标题的回读。学校对清空 `endTime:null` 返回 HTTP 400「必填」，最终输入继续要求截止时间为有效时间字符串；对旧作业实际空值保留 null 比较语义。该轮曾发生一次发布请求后即刻回读仍为未发布；另一次同会话官方请求发布/取消发布分别回读 true/false。该异常保留在记录中，不将每次请求都视为稳定成功。新增作业最终均删除。

补充证据：[官方学生预览和空时间](assets/2026-10-22-learning-atomic/lms-preview.json)、[发布状态复核](assets/2026-10-22-learning-atomic/lms-publication-followup.json)。

## 体育

新增 CLI/MCP 原子入口：`reservation-info`、`reserve`、`finance`、`confirm-free`、`cancel`。时段同时返回真实时间/场地编号、费用、同伴人数和人机验证要求。写入正文已按官方前端采用 URL 编码字符串。学校短期请求参数由接口内部取得，不让调用者猜填。

官方登录身份与授权账号匹配；原始“我的订单”包含同伴订单，官方只对当前角色及用户编号匹配的创建者展示详情按钮。已按这一实际规则过滤 `bookings`，缺少登录身份时明确报错。未修改任何历史记录。

晚间实际查询 18 个候选场地，均无当前可预约时段；单人健身房和跑步场地的最低同伴人数为 0，但均要求官方验证。次日被学校业务码 250 拒绝，消息为「查看失败，最多只能查看1天后的预约」。不使用其他学生或过去时段制造预约成功。

本人过滤实查原始 14 条→本人创建 8 条，CLI 输出与官方角色及用户编号比较集合完全一致；本人订单详情和财务详情均成功读取。MCP 本人订单和时段查询成功。

确认信息使用真实时段编号做只读预检查，URL 编码正文实际发出后，学校重定向到 `/venue/404` HTML；因此未取得确认业务结果，不能算成功接入。预约创建、零元确认、取消均未执行，保留为未完成实网成功验收。[CLI/MCP 脱敏记录](assets/2026-10-22-learning-atomic/sports-cli-mcp.json)、[登录身份布尔核对](assets/2026-10-22-learning-atomic/sports-identity.json)、[确认信息响应](assets/2026-10-22-learning-atomic/sports-post-precheck.json)。

## 云打印

当前实际返回 23 个打印终端，本人的待打印列表原有 0 条。选择目录返回的一台真实在线终端，使用一页 PDF，正文为 `NJUCLI verification only - delete after upload`，文件名明确标注原子接口验证。

| 实际入口 | 实际结果与回读 |
| --- | --- |
| CLI `self-service cloud-upload <验证PDF> --terminal <真实终端>` | 学校成功建立订单，费用 0；CLI 按订单号、文件名及 PDF 类型回读匹配 |
| MCP `self_service_cloud_delete` | 删除上一项 CLI 创建的记录，回读确认已移除 |
| MCP `self_service_cloud_upload` | 再次上传同一标注 PDF，费用 0；回读匹配 |
| CLI `self-service cloud-delete <本次订单> --terminal <真实终端>` | 删除上一项 MCP 创建的记录，回读确认已移除 |
| CLI `self-service cloud` | 最终待打印列表为 0，和执行前完全一致 |

此次确认现有本人 SSO 自助服务会话和真实终端编号已足够上传／删除，无需设备二维码认证票据。未执行现场打印，未产生打印收费。[CLI/MCP 脱敏记录](assets/2026-10-22-learning-atomic/cloud-cli-mcp.json)。

## 跨日体育复查

2026-10-23 上海时间 00:00:50，再次尝试读取当天 11 个已知允许单人的场地，限定免费且未来时段。当前请求停在学校体育 `/venue-server/api/login`，30 秒超时，未进入时段查询，不能据此判断当天无可预约时段。本次未执行预约确认、创建、零元确认或取消，未修改历史订单。[脱敏记录](assets/2026-10-22-learning-atomic/sports-2026-10-23-recheck.json)。

按用户授权，于 00:03:23 使用直连及同一账号做一次有界重试。认证交接再次 30 秒超时，尚未获得登录身份响应或任何时段数据，随后停止重试，没有创建或修改订单。[重试脱敏记录](assets/2026-10-22-learning-atomic/sports-2026-10-23-retry.json)。

01:06 左右使用当前官方 WebVPN 会话，体育登录及角色登录成功，返回身份与授权账号匹配，场地目录返回 35 项。对这 35 项查询当天时段，学校均返回“当日8点以后才能查看当天的预约”。此轮已解决登录链路，无法在开放时间前取得可提交的未来时段，创建与取消仍未成功。
