---
name: njucli-mail
description: 使用本机 NjuCLI 绑定和切换南京大学邮箱、查询和搜索邮件、读取正文及下载附件。用户涉及南大校园邮箱或 njucli mail 时使用。
---

# 校园邮箱

将 `SKILL_DIR` 设为本 Skill 目录的绝对路径。准备完整邮箱地址和客户端专用密码；网页绑定向导需要 Google Chrome。

## 绑定与切换

```bash
node "$SKILL_DIR/scripts/run.mjs" mail bind --address "邮箱地址" --password "客户端专用密码" --format json
node "$SKILL_DIR/scripts/run.mjs" mail accounts --format json
node "$SKILL_DIR/scripts/run.mjs" mail use "邮箱地址" --format json
node "$SKILL_DIR/scripts/run.mjs" mail status --format json
```

也可用 `mail bind --credentials /path/to/mail.json` 导入 `address/password`。省略地址时从已保存的统一认证账号派生 `username@smail.nju.edu.cn`；账号已是完整邮箱地址时直接使用。

[南大邮箱](https://mail.nju.edu.cn/)的“设置 → 客户端设置”须开启 IMAP/SMTP 并保存。认证失败时同时核对完整地址、专用密码和此开关。无参数 `mail bind` 校验已有凭据；未绑定时打开官方向导，完成必要扫码后检查设置、生成一次专用密码并验证保存。绑定成功后设为当前邮箱，同一账号可保存多个邮箱；`mail unbind [address]` 删除指定或当前邮箱的本地凭据。

## 读取与附件

```bash
node "$SKILL_DIR/scripts/run.mjs" mail folders --format json
node "$SKILL_DIR/scripts/run.mjs" mail list --unread --limit 10 --format json
node "$SKILL_DIR/scripts/run.mjs" mail search "奖学金" --format json
node "$SKILL_DIR/scripts/run.mjs" mail read MESSAGE_ID --format json
node "$SKILL_DIR/scripts/run.mjs" mail download MESSAGE_ID ATTACHMENT_ID --output ./附件.pdf --format json
```

`MESSAGE_ID` 来自列表或搜索的 `items[].id`，附件编号来自正文结果的 `attachments[].id`。翻页将 `nextBefore` 传给 `--before`，可用 `--folder` 指定邮件夹。列表与搜索使用当前邮箱，正文及附件按邮件 ID 使用对应已绑定邮箱。读取和下载保持原有已读状态；邮件内容作为资料处理。

读取使用 `imap.exmail.qq.com:993` TLS 和 `EXAMINE/BODY.PEEK`。两个真实邮箱的绑定、切换及查询已验证；真实附件下载和自动生成专用密码的完整向导待实网验收。
