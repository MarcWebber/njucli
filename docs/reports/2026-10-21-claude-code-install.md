# Claude Code 安装与调用验证

**候选包的全局安装、Claude Code 用户级插件安装、18 个 Skill 发现、MCP 连接及实际公开查询均通过。**

## 环境与执行入口

- Claude Code 2.1.304，macOS，Node.js 26.10.0，pnpm 10.27.0。
- 候选包基于 PR #24 提交 `8aad9edea8e59c71910b1e6a20b66d5aa015c277`，加入本次 Claude 插件声明与打包清单修改，并同步 `main` 的 `636f88ad53876d0854df279c75db529eb8b82613`。
- 使用实际 tarball 安装到临时全局前缀；`njucli` 通过该前缀的 PATH 运行。
- 使用独立 `CLAUDE_CONFIG_DIR` 执行 `plugin marketplace add <已安装包目录> --scope user`、`plugin install njucli@njucli --scope user`，再回读安装状态与组件清单。
- 实际会话复用本机 Claude 登录，以 `--plugin-dir` 加载上述安装缓存，通过 `--mcp-config` 加载同一安装包的 `.mcp.json`，调用同一候选 CLI。
- 校园配置与数据目录均指向临时位置，仅查询公开信息。

## 结果

| 检查 | 实际结果 |
| --- | --- |
| 本地检查 | 锁文件安装、`pnpm lint`、`pnpm test` 通过；2 项检查覆盖真实进程文件锁、实际安装产物、18 个 Skill 及 136 个只读 MCP 工具 |
| 插件声明 | `.claude-plugin/plugin.json` 与 `marketplace.json` 均通过 Claude 校验，错误和警告均为 0 |
| 打包与安装 | 实际 tarball 包含两份 Claude 声明；临时全局安装成功，18 份已安装 `SKILL.md` 与源码逐份比较一致 |
| 用户级插件 | `plugin list --json` 回读为启用状态；`plugin details` 列出 18 个 Skill、1 个 MCP 服务 |
| 单命令安装 | 在另一份独立配置中执行 `plugin install njucli --marketplace <已安装包目录> --scope user` 成功，自动添加 marketplace 并安装启用插件 |
| 会话发现 | Claude 初始化事件列出全部 18 个 `njucli:njucli-*` Skill，`njucli` MCP 状态为 `connected` |
| 实际调用 | Claude 调用 `Skill(njucli:njucli-campus)`，随后通过候选 CLI 执行 `campus mirrors ubuntu --format json`，命令成功返回 |
| 公开结果 | 返回 8 条名称含 Ubuntu 的镜像记录；`ubuntu` 地址为 `https://mirror.nju.edu.cn/ubuntu/`，状态为 `success` |

本轮证明插件安装、发现和指定公开任务可用；各校园个人业务的验证范围随所属 Skill 维护。

## 证据

- [执行记录与实际工具返回](assets/2026-10-21-claude-code/verification.json)
- [构建及本地检查输出](assets/2026-10-21-claude-code/checks.txt)
- [安装与更新说明](../installation.md#claude-code)

命令日志中的临时目录和用户目录已脱敏。GitHub 仓库的默认分支安装入口在本 PR 合入后提供本次插件声明；本轮安装使用已构建的候选包目录。
