---
name: njucli-doctor
description: 检查南京大学 CLI 当前账号、认证能力及校园服务连通性。
---

# 校园服务检查

检查返回当前 account、authCapabilities 与每项 checks 的状态。该命令验证所列探针的连通性；各业务的办理结果由相应业务命令核对。

## 运行

将 `SKILL_DIR` 设为本 Skill 所在目录的绝对路径：

```bash
node "$SKILL_DIR/scripts/run.mjs" doctor --help
```

## 资料

- 操作前读取[使用流程与参数](references/usage.md)。
