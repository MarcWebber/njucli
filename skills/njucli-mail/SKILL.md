---
name: njucli-mail
description: 使用本机 NjuCLI 绑定和切换南京大学邮箱、查询和搜索邮件、读取正文及下载附件。用户涉及南大校园邮箱或 njucli mail 时使用。
---

# 校园邮箱

直接绑定与日常读取使用官方 IMAP/TLS，客户端专用密码按邮箱保存。正文和附件保持原有已读状态；按查询返回的邮件、附件 ID 操作。

## 运行

将 `SKILL_DIR` 设为本 Skill 所在目录的绝对路径：

```bash
node "$SKILL_DIR/scripts/run.mjs" mail --help
```

## 资料

- 操作前读取[使用流程与参数](references/usage.md)。
- 核对接口字段或验证范围时读取[接口说明](references/interfaces.md)。
