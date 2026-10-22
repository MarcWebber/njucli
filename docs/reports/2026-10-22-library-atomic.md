# 图书借阅与研修间的真实验证

使用用户当轮指定的本人账号，复用同一官方认证会话。源码转译后实际运行 CLI 和 stdio MCP，没有运行类型检查、测试套件或模拟校园接口。

## 图书借阅管理

官方 VPN 的短信认证已经完成。按当前官方门户的 URL 编码规则访问 OPAC，CAS 回跳得到的读者令牌保存到对应官方代理域；受保护的本人借阅接口成功，读者资料中的学号与授权账号匹配。

| 实际入口 | 结果 |
| --- | --- |
| `auth login opac` | `valid` |
| `library search 计算机网络 --field title` | 返回真实书目、馆藏与可借册数 |
| `library loans` | 成功，当前在借图书 0 本 |
| `library request-options ...` | 成功，取得可申请馆藏及本人资格 |
| `library pickup-locations ...` | 成功，取得鼓楼、仙林、浦口、苏州取书地点 |
| CLI `library requests` / MCP `library_requests` | 成功，本人请求总数 0 |
| MCP `library_pickup_locations` | 成功 |
| CLI `library reserve --input ...` | 真实提交后学校拒绝：“请验证手机号”；返回 `USER_ACTION_REQUIRED` |
| CLI `library entrust --input ...` | 同上；来源与取书校区不同，参数来自真实馆藏及地点目录 |
| 最后 `library requests` | 成功，总数仍为 0，无新增申请需要清理 |

预约和委托请求使用本人真实联系方式，不伪造验证状态。随后直接使用 NJUWeb/Runner 既有 profile 的手机号，通过正式 CLI 发送一次官方短信，提交用户输入的验证码后回读 `phoneVerified=true`。继续申请时学校要求“请验证邮箱”。正式 `email-verification` 使用 profile 已有邮箱，学校接受了验证链接发送请求；经用户授权检查本人同一邮箱的收件箱与垃圾箱，暂未收到本次邮件，回读 `emailVerified=false`。没有把发送受理当作实际投递或邮箱验证成功。两项图书写入未获得成功结果，取消也没有可验证对象。账号无在借图书，续借没有成功延期证据。

正式原子入口与脱敏结果：[发送手机号验证码](assets/2026-10-22-library-atomic/phone-code.json)、[用户验证码回填及官方回读](assets/2026-10-22-library-atomic/phone-verify.json)、[发送邮箱验证链接](assets/2026-10-22-library-atomic/email-verification.json)、[联系验证状态](assets/2026-10-22-library-atomic/contact-status.json)。验证码、联系方式、邮件正文和验证链接均未写入报告。

当前 `GET /find/location/takeBookAddress` 返回业务错误 9999；实现使用官方同一预约表单实际调用、且成功返回地点的 `/find/request/getVol`，没有编造取书地点。

正式 CLI/MCP 结果：[脱敏摘要](assets/2026-10-22-library-atomic/library-cli-mcp.json)。契约见[图书请求接口](../../skills/njucli-library/references/requests.md)。

## 研修间

当前官方站点通过 WebVPN 复用统一认证。本站读者编号与当前账号一致，读取到 8 个区域共 45 间房及开放日期、用途、房间时段和本人预约。

正式 CLI `library-room book --input ...` 创建单人研修间 08:00—08:30 的标注验证预约，创建后从本人列表回读，状态 `21`。随后 stdio MCP `library_room_cancel` 取消，同一记录回读状态 `61`。

首次探查曾出现服务端已创建、客户端把文本响应按 JSON 解析而失败的情况。已按官方文本成功响应修正，并取消该首次记录。之后将新增模块改为函数实现，直接使用 profile 的手机号重新通过 CLI 创建和本人回读、MCP 取消。最终本人列表中三条本次验证记录均为 `61`，活动验证预约为 0；没有修改以前的预约。

正式创建与 MCP 取消：[业务摘要](assets/2026-10-22-library-atomic/room-live.json)，[最终状态](assets/2026-10-22-library-atomic/room-final.json)。契约见[研修间接口](../../skills/njucli-library-room/references/interfaces.md)。

函数化后复验：[profile 参数与真实创建/取消](assets/2026-10-22-library-atomic/room-profile-live.json)、[最终正式 MCP 回读](assets/2026-10-22-library-atomic/final-personal-read.json)。

## 范围

本轮按用户最后范围提供原子动作，移除了未完成认证的 CALIS 扩展，没有新增文献传递功能。图书馆的 TLS 校验保留；缺失中间证书按既有[HTTPS 配置](../../skills/njucli-library/references/network.md)补齐。
