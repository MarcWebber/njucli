# 自助服务接口与验证

## 入口与认证

官方移动端入口为 `https://zzfwx.nju.edu.cn/wec-self-print-app-console/mobile.html#/mobile/itemList`。根域名显示服务器默认页。以下路径均相对此应用目录，按 2026-10-14 官方移动端脚本与认证实网请求核对。

请求头为 `X-Requested-With: XMLHttpRequest`、`appId: 80019`、`LoginMode: MOBILE`。这里的 appId 是官方移动端客户端常量，与微信链接的 appId 参数不同。项目、申请、学校和用户 ID 从本次响应取得。业务请求使用 HTTPS；学校 CAS 回跳可能返回 HTTP 页面，其 Cookie 由共享 BrowserSession 接收保存。

`GET /mobile/isLogin` 返回 `success` 与本人资料。会话过期时，统一认证恢复后访问 `GET /app/login/IDS?type=2&returnUrl=%2Fmobile%2FitemList`，随后回读 `isLogin`。认证 driver 在 `src/auth/drivers/self-service.ts`，依赖 `sso`；登录、探测与业务复用同一调用的 BrowserSession。微信链接中的临时票据无需保存或复用。

## 请求契约

除注明原始响应的接口外，业务响应使用 `{code,msg,data}`，成功码为字符串 `0000`。表单请求为 `application/x-www-form-urlencoded`。所有 ID 使用字符串。

| 请求 | 参数与结果 |
| --- | --- |
| `GET /sys/sp-user/{userId}` | 原始用户对象；只读取 email，其他私密字段不向外输出 |
| `GET /mobile/getDict/PRINT_RELATED_CONFIGURATION/ELECTRONIC_FILE_CONFIG` | data 是 JSON 字符串；DOWN_LOAD_TYPE 两位分别表示直接下载、邮件渠道；MODIFY_MAIL 控制邮箱更改；MAIL_PATTERN 为邮箱正则字符串，使用 RegExp 解析 |
| `POST /item/sp-print-item/list/terminal` | name/state=1/rows=5000/page=1，沿用移动端目录查询；data.records/total；保留 parentId/hasChildren，当前 CLI 不展开分类目录 |
| `GET /item/sp-print-item/checkItemRight/{id}` | data=true 表示允许申请 |
| `GET /item/sp-print-item/terminal/{id}` | 原始项目对象；pickupType=1 纸质、2 电子、3 两者，formState/afterFormState 表示表单，schoolCode/takeCodeLength 用于创建 |
| `POST /item/sp-print-item/downloadChargeFee` | 电子申请报价，itemId/userId/copies=1 |
| `POST /item/sp-print-item/chargeFee` | 纸质报价，itemId/userId/copies；报价包含 totalFee/canFreeNumber/curFreeNumber/curChargeNumber/printLimitNumber/isOutOfLimitNumber/errorMsg |
| `POST /order/create` | itemId/copies/schoolCode/orderType=5/apiType=2/reportFormValue/takeType/takeCodeLength；当前只提交无需表单的项目，reportFormValue 为空，takeType=1 纸质、2 电子；返回 data.orderId |
| `GET /order/get` | orderId/schoolCode；data.order，回读 userId/schoolCode/orderId/itemId/copies/takeType，并保留文件页数、取件码与有效期 |
| `GET /order/list` | schoolCode/userId/type/itemName；type=0 待完成、1 已完成；data.orders；逐条校验当前用户归属 |
| `GET /order/downloadCheck/{orderId}` | 检查电子文件生成就绪；data 为后端下载地址，发邮件流程不访问该地址 |
| `GET /message/sendElectronicItemEmail` | orderId/email；此 GET 会发送邮件，属于写操作，成功码仅表示平台确认发送 |
| `GET /warn/sp-terminal-status/getTerminalState` | `{success,msg,data}`；仅输出 terminalCode/address/schoolDistrict/longitude/latitude/networkState/state，设备 IP、MAC 与内部监控字段不输出 |

## 申请与领取

电子申请每次一份，默认选择自助服务绑定邮箱；其为空且 MODIFY_MAIL=1 时，使用同一本地账号的 njucli 当前邮箱绑定。`--email` 也受平台渠道开关、更改权限及邮箱格式规则约束。先核对地址、领取类型、表单要求及费用，再创建。当前实现支持费用为零且未超额的申请，其他申请返回官方入口。

创建后回读申请，再检查文件生成状态并发送邮件。创建响应或后续步骤失败均不自动重试写请求；已取得申请号时将其附在错误 details 中。发送使用已有申请，无需再次申请。申请与发送仅在 CLI 暴露，MCP 保持只读。

发放后询问是否下载，有明确下载授权后使用邮箱 Skill 搜索本次邮件、读取附件编号并下载原 PDF。平台的下载开关通过 profile 返回；当前账号实测 DOWN_LOAD_TYPE=01，采用邮件附件领取。

## 验证范围

2026-10-14，使用研究生账号认证实网核对：

- SSO 交换、自助服务会话与用户邮箱配置；统一 CLI 的 profile/items/show/quote/orders/order/terminals。
- 当前账号四个项目：志愿服务时长证明、研究生在校证明、研究生成绩单、在校研究生电子成绩单。名称、权限及额度因账号和时间变化。
- 电子成绩单免费申请、生成后回读、发送到本人已绑定校园邮箱；收件箱确认本次来信，原 PDF 下载成功，600,390 字节、两页，文件含签名字段并可正常渲染。签名的证书链及法律效力未在 CLI 中验证。
- 在校证明纸质报价与 23 条设备位置记录；这些数量仅记录当日实测，代码不依赖这些数量。

真实申请使用探索脚本完成；封装后的创建与发送由本地 HTTP 集成核对，未为验证再次消耗真实额度。纸质申请提交、设备取件、其他身份的项目及额外表单未实网验证。分类项目保留元数据，使用官方页面继续办理。

本地集成覆盖真实 client、命令、认证协调器和存储的组合：同次会话恢复、动态项目和账号、默认与指定邮箱、申请回读、归属拒绝、表单和付费停止、未知响应不重复写入、后续失败保留申请号、纸质领取；独立目录的 CLI 与只读 MCP 注册由隔离安装测试核对。
