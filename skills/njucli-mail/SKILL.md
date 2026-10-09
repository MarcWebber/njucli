---
name: njucli-mail
description: 查询南京大学校园邮箱、搜索和读取邮件、下载附件，绑定或切换邮箱。
---

# 校园邮箱

以下命令在本 Skill 目录运行。

## 首次使用

首次使用需要本机安装 Google Chrome，然后运行：

```bash
node scripts/run.mjs mail bind
```

未绑定邮箱时会打开浏览器。按页面提示完成登录和扫码，向导会检查 IMAP/SMTP 设置、生成并保存客户端专用密码。已有绑定时，这条命令检查现有配置能否使用。

已有客户端专用密码时，也可以直接绑定或导入文件：

```bash
node scripts/run.mjs mail bind --address "学号@smail.nju.edu.cn" --password "客户端专用密码" --format json
node scripts/run.mjs mail bind --credentials /path/to/mail.json --format json
```

凭据文件使用 `address` 和 `password` 字段。省略地址时，使用已保存的统一认证账号：完整邮箱地址直接使用，其余补上 `@smail.nju.edu.cn`。

## 查信与附件

```bash
node scripts/run.mjs mail folders --format json
node scripts/run.mjs mail list --unread --limit 10 --format json
node scripts/run.mjs mail search "关键词" --format json
node scripts/run.mjs mail read MESSAGE_ID --format json
node scripts/run.mjs mail download MESSAGE_ID ATTACHMENT_ID --output ./附件.pdf --format json
```

`MESSAGE_ID` 来自列表或搜索结果的 `items[].id`。先读取邮件，再用结果中的 `attachments[].id` 下载附件。读取和下载保持邮件原有的已读状态；下载会覆盖指定的本地文件。

用 `--folder` 指定邮件夹，路径来自 `folders`。`nextBefore` 有值时，将它传给 `--before` 查询下一页，并保留原来的关键词和筛选条件；值为 `null` 表示已到末页。

## 切换与管理邮箱

同一个本地账号支持绑定多个邮箱地址。列表与搜索针对当前邮箱；读取正文与下载附件会根据 `MESSAGE_ID` 自动识别归属邮箱。

```bash
node scripts/run.mjs mail accounts --format json
node scripts/run.mjs mail use "another@nju.edu.cn" --format json
node scripts/run.mjs mail status --format json
node scripts/run.mjs mail unbind "another@nju.edu.cn" --format json
```

`accounts` 列出邮箱，`use` 切换邮箱，`status` 查看本地绑定状态。`unbind` 删除指定邮箱的本地凭据，省略地址时解绑当前邮箱。
