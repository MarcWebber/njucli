# 借阅与图书请求接口

以下接口来自当前 [OPAC](https://opac.nju.edu.cn/) 官方前端。请求携带 `groupCode: 200027` 与当前读者 `jwtOpacAuth`，成功条件为 `success: true`。

| 动作 | 请求 | 契约 |
| --- | --- | --- |
| 本人借阅和会话探测 | POST `/find/loanInfo/loanList` | `page/rows/searchType/searchContent/sortType/startDate/endDate`；借阅编号 `loanId` |
| 续借一本 | POST `/find/lendbook/reNew` | `loanIds: [loanId]`；回读本人应还日期 |
| 可申请馆藏和资格 | POST `/find/physical/getRequestAndEnreustList` | `recordId/page/rows/entrance:null`；返回 `list/user` |
| 取书地点和分卷 | GET `/find/request/getVol` | `recordId/callNo`；`orderTakeBookLocs/entrustTakeBookLocs/vols/title` |
| 本人请求 | POST `/find/subtenancy/requestManager` | `requestType:null, physicaRequestType:null, page, rows, sortType:""`；返回 `total/list` |
| 请求详情 | GET `/find/subtenancy/requestDetl` | 本人 `requestId` |
| 预约或委托 | POST `/find/subtenancy/subscribeAndEntrust` | `type:1` 预约、`type:0` 委托；馆藏、取书地点、联系资料、本人 `userId`；`noticeType:"2",forceApply:0,hardApply:0` |
| 取消请求 | GET `/find/subtenancy/requestCancel` | 本人 `requestId`；虽然 HTTP 方法为 GET，此操作标注为写入 |
| 联系验证状态 | POST `/find/userInfo/getContactMess` | 空 JSON；`phoneFlag/emailFlag=1` 表示已验证 |
| 发送手机号验证码 | GET `/find/userInfo/sendPhonenumber` | `groupCode/userId/number`；`number` 来自调用者提供的 `profile.phone` |
| 提交手机号验证码 | GET `/find/userInfo/checkPhonenumber` | `userId/number/code`；验证码由用户输入，完成后回读验证标志 |
| 发送邮箱验证链接 | GET `/find/userInfo/checkMail` | `userId/mail`；官网表单只有邮箱字段，后续验证通过邮件中的链接完成 |

OPAC 校外传输复用当前官方 WebVPN 会话。CAS 的正式回跳 hash 含 `loginExternal` 令牌；登录完成后保存到对应官方代理主机的 `jwt` Cookie，以受保护的本人借阅接口确认会话。`/oga/userinfo` 当前会跳往第三方登录站点，不再用于本站会话探测。

真实 CLI 已通过检索、空借阅、申请馆藏、取书地点和本人空请求列表；MCP 已通过本人请求及取书地点查询。手机号验证已使用 profile 已有号码、用户输入的官方短信码通过正式 CLI 完成，并回读为已验证。继续申请被“请验证邮箱”拒绝，回读总数仍为 0；邮箱验证链接的发送已获学校接受，但本人邮箱尚未收到邮件，不能视为已验证。没有成功创建或取消图书请求。当前无在借图书，续借尚未取得成功延期结果。

