---
name: njucli-mail
description: 使用南京大学校园邮箱发送邮件与附件、抄送和密送、回复邮件线程，查询和搜索邮件、读取正文与下载附件，绑定或切换邮箱。
---

# 校园邮箱

## 发送邮件

按用户指定的收件人和内容准备 `message.json`：

```json
{
  "to": ["recipient@example.org"],
  "subject": "邮件主题",
  "text": "邮件正文",
  "attachments": ["/path/to/材料.pdf"]
}
```

```bash
njucli mail send --input message.json --format json
```

发件人使用当前绑定邮箱。`cc`、`bcc` 为邮箱地址数组，`html` 提供 HTML 正文，`attachments` 使用本地文件路径。回复邮件时，用 `mail read` 返回的 `messageId` 填写 `inReplyTo`，将原有 `references` 和该 `messageId` 合并为 `references` 数组。

MCP 使用 `mail_send`，将同一份邮件 JSON 作为 `input` 传入。CLI 与 MCP 调用同一个发送方法。成功返回 SMTP 接收的 `messageId`、收件人列表和 `delivery: "smtp-accepted"`；收件箱的最终投递由邮件服务器完成。部分收件人拒收时，错误详情保留已接收和拒收地址，后续按这些结果处理。

## 首次使用

运行邮箱绑定向导：

```bash
njucli mail bind
```

未绑定邮箱时会打开本机浏览器。按页面提示完成登录和扫码，向导会检查 IMAP/SMTP 设置、生成并保存客户端专用密码。已有绑定时，这条命令检查现有配置能否使用。

已有客户端专用密码时，也可以直接绑定或导入文件：

```bash
njucli mail bind --address "学号@smail.nju.edu.cn" --password "客户端专用密码" --format json
njucli mail bind --credentials /path/to/mail.json --format json
```

凭据文件使用 `address` 和 `password` 字段。省略地址时，使用已保存的统一认证账号：完整邮箱地址直接使用，其余补上 `@smail.nju.edu.cn`。

## 查信与附件

```bash
njucli mail folders --format json
njucli mail list --unread --limit 10 --format json
njucli mail search "关键词" --format json
njucli mail read MESSAGE_ID --format json
njucli mail download MESSAGE_ID ATTACHMENT_ID --output ./附件.pdf --format json
```

`MESSAGE_ID` 来自列表或搜索结果的 `items[].id`。先读取邮件，再用结果中的 `attachments[].id` 下载附件。读取和下载保持邮件原有的已读状态；下载会覆盖指定的本地文件。

用 `--folder` 指定邮件夹，路径来自 `folders`。`nextBefore` 有值时，将它传给 `--before` 查询下一页，并保留原来的关键词和筛选条件；值为 `null` 表示已到末页。

## 切换与管理邮箱

同一个本地账号支持绑定多个邮箱地址。列表与搜索针对当前邮箱；读取正文与下载附件会根据 `MESSAGE_ID` 自动识别归属邮箱。

```bash
njucli mail accounts --format json
njucli mail use "another@nju.edu.cn" --format json
njucli mail status --format json
njucli mail unbind "another@nju.edu.cn" --format json
```

`accounts` 列出邮箱，`use` 切换邮箱，`status` 查看本地绑定状态。`unbind` 删除指定邮箱的本地凭据，省略地址时解绑当前邮箱。
