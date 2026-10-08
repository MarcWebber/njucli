---
name: njucli-library
description: 查询南京大学图书馆馆藏、馆藏位置、可借状态与本人借阅。
---

# 图书馆

BOOK_ID 来自 search。检索和馆藏访问通过官方 WebVPN，本人借阅还需要读者登录。网络或登录要求按命令返回的提示完成，查询成功后交付题名、索书号、位置和借阅状态。

## 运行

将 `SKILL_DIR` 设为本 Skill 所在目录的绝对路径：

```bash
node "$SKILL_DIR/scripts/run.mjs" library --help
```

登录提示中的 `auth ...` 也通过上述脚本执行。

## 资料

- 操作前读取[使用流程与参数](references/usage.md)。
- 核对接口字段或验证范围时读取[接口说明](references/interfaces.md)。
