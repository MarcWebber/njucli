---
name: njucli-auth
description: 使用本机 NjuCLI 登录南京大学统一认证、保存凭据、自动处理官方滑块，检查、恢复和维护登录会话。
---

# 统一认证

登录、保存凭据、检查会话或设置登录维护时使用。网页登录需要本机 Google Chrome；扫码由本人完成。

## 运行

将 `SKILL_DIR` 设为本 Skill 所在目录的绝对路径：

```bash
node "$SKILL_DIR/scripts/run.mjs" auth --help
```

## 资料

- 操作前读取[使用流程与参数](references/usage.md)。
- 核对接口字段或验证范围时读取[接口说明](references/interfaces.md)。
