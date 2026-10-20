# 自助服务

在当前目录运行以下命令（统一 CLI 将 `njucli` 换成 `njucli`）。CLI 会自动恢复会话。[官方入口](https://zzfwx.nju.edu.cn/wec-self-print-app-console/mobile.html#/mobile/itemList)。

## 发现可用服务

```bash
njucli self-service profile --format json
njucli self-service items --format json
njucli self-service items 成绩单 --format json
njucli self-service items --parent CATEGORY_ID --format json
njucli self-service show ITEM_ID --format json
```

服务项目随账号权限动态变化。必须从实时目录取 `ITEM_ID`；若 `hasChildren=true` 则用 `--parent` 展开子类。`pickupType` 标识类型（1 纸质、2 电子、3 两者）。`orderDetail?id` 为项目编号，`ORDER_ID` 为创建后返回的申请号。所有 ID、账号和申请号均取自当前响应，勿复用分享链接的微信 appId 与临时 ticket。

## 申请并领取电子文件

```bash
njucli self-service quote ITEM_ID --format json
njucli self-service create ITEM_ID --format json
# 领取邮件相关命令（通过 njucli-mail 或统一 CLI）
njucli mail search 成绩单 --format json
njucli mail read MESSAGE_ID --format json
njucli mail download MESSAGE_ID ATTACHMENT_ID --output /path/to/transcript.pdf --format json
```

每次申请 1 份电子文件。默认发至自助服务绑定邮箱；若为空且平台允许，使用同一本地账号的 njucli 当前绑定邮箱；用户指定收件人时使用 `--email ADDRESS`，仍需符合平台邮箱规则。遇付费、超额或需额外表单时，使用 `show` 返回的官方页面继续办理。

申请后向用户报告申请号与邮箱，`emailSent=true` 表示平台确认发送，实际送达需通过邮箱核对。发放后询问用户是否需要下载（已获明确授权则直接执行）。本 Skill 通过邮件领取文件；`profile.downloadEnabled` 反映平台直下渠道状态。使用邮箱命令核对收件邮箱、来信时间与附件，并保存原 PDF。

## 纸质证明与申请管理

```bash
njucli self-service quote ITEM_ID --delivery paper --copies 1 --format json
njucli self-service create ITEM_ID --delivery paper --copies 1 --format json
njucli self-service terminals --format json
njucli self-service orders --state pending --format json
njucli self-service orders --state completed --format json
njucli self-service order ORDER_ID --format json
njucli self-service send ORDER_ID --format json
njucli self-service cancel ORDER_ID --format json
```

纸质申请返回取件码与有效期，凭码至终端机领取（终端机联网不代表耗材充足）。`send` 用于重发电子申请邮件；用户要求撤销时，`cancel` 撤销本人的未完成免费申请，命令会回读列表验证。

若创建结果不明确先查 `orders`；已返回 `ORDER_ID` 则直接复用。创建（create）、发送（send）和撤销（cancel）均为写操作，网络失败时不自动重试。

## 云打印

```bash
njucli self-service cloud --format json
```

查询平台当前收费/免费份数配置、文件页数上限及待打印文件。`initFreeCopies` 是平台规则，非个人剩余额度。云打印支持 PDF、Word 和图片：文件上限 5 MB，图片宽高不超过 14400 像素，文档页数上限取 `config.filePageLimit`。

CLI 仅提供规则与列表查询。上传、删除和现场打印未封装，需通过打印机当次二维码进入官方页面操作。请勿将二维码链接保存为通用入口。

## MCP 接口说明

MCP 仅提供只读查询（profile / items / show / quote / orders / order / terminals / cloud）。申请、邮件发送及撤销等写操作必须使用 CLI。

接口与实网验证范围见[接口记录](references/interfaces.md)。
