---
name: njucli-table
description: 使用 NjuCLI 查询南京大学协同表格、查找和复制官方模板、创建带公式与视图的登分表，读取数据并按行 ID 填写或修改记录。用户提到 table.nju.edu.cn、SeaTable、协同表格或登分表时使用。
---

# 协同表格

表格 UUID、工作表名称和行 ID 从查询结果取得。按用户材料创建或填写，写入成功包含回读；完成后交付表格链接和结果。

## 运行

需要 Node.js 20+。将 `SKILL_DIR` 设置为本文件所在目录的绝对路径。使用安装包中的本 Skill，或在完整源码仓库先执行 `pnpm build` 生成运行入口。单独复制构建后的目录时，在该目录安装声明的运行依赖：

```bash
npm install --omit=dev --ignore-scripts --prefix "$SKILL_DIR"
node "$SKILL_DIR/scripts/run.mjs" table --help
```

网页登录需要 Google Chrome。本入口同时提供 `account` 与 `auth` 命令；账号通过 `NJUCLI_ACCOUNT` 或 `account use` 选择，配置和会话与完整 CLI 共用。同一账号的浏览器任务串行执行。

## 操作资料

- 使用步骤、输入结构和示例见[使用说明](references/usage.md)。
- 字段、接口与验证范围见[接口说明](references/interfaces.md)。
- 内置登分表定义见[gradebook.json](templates/gradebook.json)。

只读 MCP 入口为 `node "$SKILL_DIR/scripts/run.mjs" mcp`，提供6个查询工具。创建、修改和模板导出使用命令入口；完整安装时也可通过 `njucli table` 执行。
