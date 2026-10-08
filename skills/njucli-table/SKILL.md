---
name: njucli-table
description: 使用 NjuCLI 查询南京大学协同表格、查找和复制官方模板、创建带公式与视图的登分表，读取数据并按行 ID 填写或修改记录。用户提到 table.nju.edu.cn、SeaTable、协同表格或登分表时使用。
---

# 协同表格

表格 UUID、工作表名称和行 ID 从查询结果取得。按用户材料创建或填写，写入成功包含回读；完成后交付表格链接和结果。

## 运行

将 `SKILL_DIR` 设为本 Skill 所在目录的绝对路径：

```bash
node "$SKILL_DIR/scripts/run.mjs" table --help
```

登录提示中的 `auth ...` 也通过上述脚本执行。

## 资料

- 操作前读取[使用流程与参数](references/usage.md)。
- 核对接口字段或验证范围时读取[接口说明](references/interfaces.md)。
- 登分表结构见[gradebook.json](templates/gradebook.json)。
