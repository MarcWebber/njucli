# 校园邮箱接口

## 邮箱读取

使用 `imap.exmail.qq.com:993` TLS。列表、搜索和邮件夹使用当前邮箱；正文及附件按邮件 ID 选择已绑定邮箱。`EXAMINE` 和 `BODY.PEEK` 保持原有已读状态。

同一本地账号可绑定多个邮箱，`mail.json` 保存 `{ current, mailboxes: [{ address, password }] }`。绑定先验证 IMAP，成功后更新凭据并设为默认。省略地址时从统一认证 username 派生 `username@smail.nju.edu.cn`；完整邮箱地址直接使用。

## 邮箱绑定向导

网页路径来自[南大邮箱](https://mail.nju.edu.cn/)；实现统一位于 `src/auth/mail-bind.ts`。

| 环节 | 页面契约 |
| --- | --- |
| 登录 | `/cgi-bin/frame_html`，`#useraddr` 为完整邮箱地址 |
| 客户端设置 | `iframe#mainFrame` 内的 `input#openimap` 为 IMAP/SMTP 开关 |
| 保存 | `a#sendbtn` 提交 `form#web_set` 至 `/cgi-bin/setting4` |
| 专用密码 | “微信绑定”页调用 `addClientPwd`，POST `/cgi-bin/wx_token`，`act=add_spwd` |
| 生成结果 | 本次响应 `errcode == "0"`，密码在 `data.passwd` |

无本地凭据时向导检查 IMAP 设置、生成一次客户端密码，再验证保存。IMAP 关闭也会返回认证失败，排查时同时核对地址、专用密码和开关。

## 验证范围

两个真实邮箱已完成直接绑定、切换、文件夹/列表/搜索/正文读取，已读状态保持；本地集成覆盖 MIME 正文和附件。真实附件下载及自动生成客户端密码的完整向导待验收。
