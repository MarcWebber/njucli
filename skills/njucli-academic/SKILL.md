---
name: njucli-academic
description: 查询南京大学研究生成绩、考试、课表与培养方案。
---

# 研究生教务

学期标识来自官方结果，省略 --term 时采用接口默认学期。交付真实成绩、考试安排和培养方案；数据缺失时展示学校返回的状态。

## 运行

需要 Node.js 20+。将 `SKILL_DIR` 设置为本文件所在目录的绝对路径。使用安装包中的本 Skill，或在完整源码仓库先执行 `pnpm build` 生成运行入口。单独复制构建后的目录时，在该目录安装声明的运行依赖：

```bash
npm install --omit=dev --ignore-scripts --prefix "$SKILL_DIR"
node "$SKILL_DIR/scripts/run.mjs" academic --help
```

涉及网页登录时需要本机 Google Chrome。本入口同时提供 `account` 与 `auth` 命令；账号通过 `NJUCLI_ACCOUNT` 或 `account use` 选择，配置和会话与完整 CLI 共用。首次凭据可用 `auth login --credentials /path/to/auth.json` 保存。同一账号的浏览器任务串行执行。

## 操作资料

- 办理本技能任务前，读取[使用流程与参数](references/usage.md)。
- 核对接口字段、历史实网结果和验收范围时，读取[接口与验证记录](references/interfaces.md)。

只读 MCP 入口为 `node "$SKILL_DIR/scripts/run.mjs" mcp`，提供本 Skill 对应的查询工具。写入与下载使用命令入口。
完整安装时，同一组业务也可通过 `njucli` 执行。交付以命令退出码、JSON 的 `ok/data` 和各流程要求的回读为准。
