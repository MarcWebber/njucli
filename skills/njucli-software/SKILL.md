---
name: njucli-software
description: 使用 NjuCLI 查找南京大学正版软件、选择对应系统的官方安装包并下载到本地。适用于 Adobe、WPS、MathType、Origin 等校园软件下载需求。
---

# 正版软件

软件与安装包 ID 从查询结果取得，按目标系统下载到用户指定路径。安装和激活按用户另行指定的操作办理。

## 运行

将 `SKILL_DIR` 设为本 Skill 所在目录的绝对路径：

```bash
node "$SKILL_DIR/scripts/run.mjs" software --help
```

## 资料

- 操作前读取[使用流程与参数](references/usage.md)。
- 核对接口字段或验证范围时读取[接口说明](references/interfaces.md)。
