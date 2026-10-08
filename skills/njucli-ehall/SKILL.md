---
name: njucli-ehall
description: 使用 NjuCLI 查询并填报南京大学 e-Hall 研究生节假日离返校登记。用户要求填报假期行程、留校或离返校安排时使用，一次收齐必要信息并完成登记。
---

# 网上办事与行程填报

先读取当前假期、已有登记和缺失字段，一次收齐用户本次行程。材料完整且用户要求填报时提交一次；成功以本人、假期、编号与字段回读为准。失败后先查询当前登记。

## 运行

将 `SKILL_DIR` 设为本 Skill 所在目录的绝对路径：

```bash
node "$SKILL_DIR/scripts/run.mjs" ehall --help
```

登录提示中的 `auth ...` 也通过上述脚本执行。

## 资料

- 操作前读取[使用流程与参数](references/usage.md)。
- 核对接口字段或验证范围时读取[接口说明](references/interfaces.md)。
