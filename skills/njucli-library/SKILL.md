---
name: njucli-library
description: 查询南京大学图书馆馆藏、本人借阅和请求，续借图书、提交预约或跨校区委托、取消本人请求。
---

# 图书馆

连接校园网或已登录的官方 VPN 后使用本 Skill；校外 OPAC 访问限制下使用官方 WebVPN 地址。本人借阅和请求复用统一认证派生的图书馆会话，需要时自动恢复。手动登录使用 `njucli auth login opac`。

出现 `UNABLE_TO_VERIFY_LEAF_SIGNATURE` 或 `unable to verify the first certificate` 时，按[HTTPS 证书配置](references/network.md)补齐官网缺少的中间证书。

## 书目检索与馆藏分布

```bash
njucli library search "关键词" --format json
njucli library search "书名" --field title --page 1 --page-size 20 --format json
njucli library book BOOK_ID --format json
njucli library holdings BOOK_ID --format json
```

`--field` 可选 `all`（默认）、`title`、`author`、`isbn`、`callno`（索书号）。

`BOOK_ID` 来自 `search` 返回的 `bookId`。先查书目，再通过 `holdings` 查询馆藏位置、索书号及可借状态，将这些信息连同题名提供给用户。

## 本人借阅查询

```bash
njucli library loans --format json
```

返回当前在借图书的 `loanId`、题名、应还日期及逾期状态；支持 `--page` 和 `--page-size`，页码从 1 开始。逾期按南京当地日期与应还日期比较。

## 借阅与图书请求

```bash
njucli library renew LOAN_ID --format json
njucli library request-options BOOK_ID --format json
njucli library pickup-locations BOOK_ID CALL_NO --format json
njucli library reserve --input request.json --format json
njucli library entrust --input request.json --format json
njucli library requests --page 1 --page-size 20 --format json
njucli library request REQUEST_ID --format json
njucli library cancel-request REQUEST_ID --format json
njucli library contacts --format json
njucli library phone-code --phone PHONE --format json
njucli library phone-verify --phone PHONE --code USER_CODE --format json
njucli library email-verification --email EMAIL --format json
```

`reserve` 创建预约，`entrust` 创建跨校区委托。`request.json` 包含 `recordId`、`callNo`、`campusId`、`locationId`、`libCode`、`takeCampusId`、`takeLocationId`、`takeLibCode`、`phone`、`email`，可附 `vol`。馆藏参数来自 `request-options`，取书地点和分卷来自 `pickup-locations`；手机号和邮箱填写本人真实资料。读者编号使用当前认证身份。

学校要求先在 OPAC 个人信息中验证联系方式；未验证时命令返回 `USER_ACTION_REQUIRED` 和学校具体提示。写入结果不明确时查询本人请求核对。续借只接受本人当前借阅的 `loanId`，取消只接受本人请求 ID。

手机号、邮箱优先使用宿主当前上下文已有的 `profile.phone`、`profile.email`，由 AI 填入上述参数。NJUWeb/Runner 已按账号保存并注入这些资料，已有值时直接使用；只有缺失时询问用户。学校仍要求验证码时，由用户提供本次验证码后回填官方验证请求；号码已填写不代表已完成官方验证。

`contacts` 返回图书馆当前的 `phoneVerified/emailVerified`。`phone-code` 只发送一次官方短信，`phone-verify` 接收用户提供的本次短信码并回读状态。`email-verification` 发送图书馆验证链接，由用户点击；只有用户明确要求读取邮件时才用已有邮箱读取本次验证邮件，并保持原有已读状态。发送请求被学校接受不代表邮件已经投递或邮箱已经验证。

MCP 提供对应的 `library_` 原子工具。接口和成功验证范围见[接口说明](references/requests.md)。
