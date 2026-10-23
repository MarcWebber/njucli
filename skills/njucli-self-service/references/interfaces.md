# 自助服务接口与验证

## 入口与认证

入口为 `https://zzfwx.nju.edu.cn/wec-self-print-app-console/mobile.html#/mobile/itemList`。以下请求路径均相对于该应用目录，依据 2026-10-14 当前官方移动端脚本及认证实网响应核对。

官方请求头为 `X-Requested-With: XMLHttpRequest`、`appId: 80019`、`LoginMode: MOBILE`。80019 是该部署的移动客户端常量；微信入口中的 `appId=wx…` 与临时 `ticket` 不参与 CLI 登录。项目、用户、学校和申请编号来自当前响应。省略 appId 的会话与目录查询也成功；写接口继续使用官方客户端请求头。

`GET /mobile/isLogin` 返回 `success` 与本人资料。认证 driver 依赖 SSO，访问 `GET /app/login/IDS?type=2&returnUrl=%2Fmobile%2FitemList` 后回读登录状态。认证和业务复用同一次调用的 BrowserSession；CAS 回跳可能为 HTTP，其 Cookie 由该会话保存。

已用仅含现有 SSO Cookie 的隔离 HTTP 会话验证：自助服务未登录 → IDS 交换 → 实时目录、四项详情与本人申请列表。入口可重新进入，不依赖分享链接。其他真实账号的签发未实测；不同用户应各自登录，由目录决定可用项目。

`orderDetail?id=ITEM_ID` 是公共项目详情路由，ITEM_ID 与个人申请号不同；`orderListUnCompleted`、`orderListCompleted` 是本人申请页面。CLI 不引用带版本号的前端 JS 文件名。学校未公开接口版本兼容承诺，路由或字段变化时按新的官方请求更新本 client。

## 功能探索结果

以下为本次研究生身份及平台配置的快照，不作为代码中的固定项目目录或额度。

| 功能 | 本次核对结果 | 当前接入 |
| --- | --- | --- |
| 青年志愿者服务时长证明 | 纸质；报价 0 元、可免费 1 份 | 动态查询、报价、免费申请 |
| 研究生在校证明 | 纸质；报价 0 元、可免费 8 份 | 动态查询、报价、免费申请 |
| 研究生成绩单 | 纸质；报价 0 元、可免费 8 份 | 动态查询、报价、免费申请 |
| 在校研究生电子成绩单 | 电子；本次已完成申请及邮件领取 | 动态查询、报价、申请、邮件再次发放 |
| 云打印 | CLOUD_PRINT 已启用；配置与本人待打印列表可读 | `cloud` 查询、`cloud-upload` 上传、`cloud-delete` 删除；现场打印在设备操作 |
| 申请管理 | 未完成和已完成列表、申请详情；前端支持撤销未完成申请 | `orders`、`order`、`cancel`；撤销限本人免费未完成申请 |
| 打印机位置 | 实网返回 23 台设备的位置与网络状态 | `terminals`；不代表耗材状态或指定项目可在全部设备领取 |
| 项目分类与部门 | 前端有父子目录、部门标签；当前四项均为叶子项目，部门标签共 9 类 | `items --parent` 展开分类；项目名称查询 |
| 远程控制、关机、重启、纸张维护 | 属于管理员功能；当前 judgeManage=false | 学生功能不接入 |
| 自助缴费、报到、改密码、火车票等模块 | 当前平台许可配置为关闭 | 不作为可用学生服务 |

平台许可还启用了自助查询、终端国际化、批量导出等模块；许可开关不等于当前学生具有对应操作权限。学校的[服务介绍](https://oi.nju.edu.cn/zzfw_37059/list.htm)、[2020 年项目目录](https://itsc.nju.edu.cn/72/fb/c37057a488187/page.htm)覆盖多种身份；个人可办理的证明以本次登录后的实时目录为准。

## 请求契约

除注明原始响应的接口外，响应为 `{code,msg,data}`，成功码 `0000`。POST 表单为 `application/x-www-form-urlencoded`，编号使用字符串。仅输出业务需要的字段，用户密码、证件、内部报表地址及设备网络配置不对外输出。

| 请求 | 参数与结果 |
| --- | --- |
| `GET /sys/sp-user/{userId}` | 原始对象；只读取 email |
| `GET /mobile/getDict/PRINT_RELATED_CONFIGURATION/ELECTRONIC_FILE_CONFIG` | data 为 JSON 字符串；DOWN_LOAD_TYPE 两位依次为直接下载、邮件开关；MODIFY_MAIL 控制更换邮箱；MAIL_PATTERN 为邮箱正则字符串 |
| `POST /item/sp-print-item/list/terminal` | name/state=1/rows=5000/page=1；分类展开增加 parentId；data.records/total，保留 parentId/hasChildren |
| `GET /item/sp-print-item/checkItemRight/{id}` | data=true 表示允许申请 |
| `GET /item/sp-print-item/terminal/{id}` | 原始项目对象；pickupType=1 纸质、2 电子、3 两者；formState/afterFormState 表示表单，schoolCode/takeCodeLength 用于创建 |
| `POST /item/sp-print-item/downloadChargeFee` | 电子报价：itemId/userId/copies=1 |
| `POST /item/sp-print-item/chargeFee` | 纸质报价：itemId/userId/copies；两种报价都返回总费用、免费份数、收费份数与限制 |
| `POST /order/create` | itemId/copies/schoolCode/orderType=5/apiType=2/reportFormValue/takeType/takeCodeLength；无需表单时 reportFormValue 为空；takeType=1 纸质、2 电子；返回 data.orderId |
| `GET /order/get` | orderId/schoolCode；data.order；校验本人归属及请求编号，创建后核对项目、份数、费用、领取方式 |
| `GET /order/list` | schoolCode/userId/type/itemName；type=0 未完成、1 已完成；data.orders，逐条校验归属 |
| `POST /order/cancelOrders` | orderIds/schoolCode；前端将编号数组转为逗号分隔字符串，CLI 每次撤销一项；提交后回读本人未完成列表 |
| `GET /order/downloadCheck/{orderId}` | 检查电子文件生成状态；data 为后端下载地址，邮件流程不访问该地址 |
| `GET /message/sendElectronicItemEmail` | orderId/email；发送邮件的写操作，成功码表示平台确认发送 |
| `GET /warn/sp-terminal-status/getTerminalState` | `{success,msg,data}`；输出 terminalCode/address/schoolDistrict/longitude/latitude/networkState/state |
| `GET /order/cloud-print/config` | 云打印配置；price 为字符串、initFreeCopies/singlePrintPages 为数字、filePageLimit 为字符串；initFreeCopies 是平台配置，不是本人剩余额度 |
| `GET /order/cloud-print-list` | rows=10000/page=1/type=0；data.records/total；移动端展示 orderId/title/fileType |

云打印官方二维码页面可经 `/mobile/loginByCloudPrint` 路由调用 `POST /app/login/CLOUD_PRINT`，然后到 `/mobile/cloud-print`。当前学校部署同时接受本人已有 SSO 自助服务会话：使用 `terminals` 返回的真实终端编号，已通过实际 CLI/MCP 完成上传、列表回读、删除及队列恢复，不需要构造设备认证票据。

上传为 `POST /order/cloud-print-order/create` multipart，字段 `file/fileType/terminalCode`；`fileType` 是文件扩展名。文件不超过 5 MB，支持 pdf/doc/docx/png/jpg/jpeg/gif/bmp，图片宽高不超过 14400 像素，PDF/Word 页数按 `filePageLimit`。成功 `data` 返回 `orderId/takeCode/expireTime/fee`，上传后在本人待打印列表中按订单编号、文件名与类型回读。

删除使用 `GET /order/cloud-print-order-byGet/{orderId}/{terminalCode}`，是写操作；先确认订单在本人的待打印列表，提交一次后回读目标已移除。上传和删除不启动现场打印。

## 领取与错误处理

电子申请默认使用平台绑定邮箱；为空且允许修改时，使用同一本地账号的 njucli 当前绑定邮箱。指定邮箱仍受平台规则约束。先核对领取方式、表单与费用；CLI 创建限免费、未超额、无额外表单项目，其他情况返回官方入口。

创建后回读申请，再检查文件生成状态和发送邮件。写入不自动重试；取得申请号后失败会在错误 details 中保留该号。实际邮件送达由邮箱 Skill 核对。发放后询问是否下载，已有明确下载授权则继续保存原 PDF。

撤销先检查本人未完成列表与零费用，提交后确认目标已从未完成列表移除。CLI 与 MCP 共同提供申请、邮件发送和撤销，复用本人归属、费用检查和结果回读。

## 验证范围

- 认证实网：SSO 交换、profile/items/show/quote/orders/order/terminals/cloud；根分类及叶子分类查询；四项证明详情与报价，云打印配置与空队列。
- 真实业务：电子成绩单免费签发、申请回读、邮件发送、收件确认和原 PDF 下载；文件两页，可正常渲染并含签名字段，未验证证书链。
- 认证实网原子写入：云打印 CLI 和 MCP 分别上传一页标注 PDF、回读并交叉删除；两次上传费用均为 0，最终本人待打印队列恢复原状。现场打印未执行。
- 未实网提交：纸质申请、证明撤销、现场打印、额外表单、其他身份签发。封装后的创建与发送待实际业务核对。
