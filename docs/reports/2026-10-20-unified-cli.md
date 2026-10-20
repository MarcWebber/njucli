# 统一 CLI 安装验证

**实际安装后的 `njucli` 已通过 18 个业务入口、Skill 注册、随包资料、模板和 136 个只读 MCP 工具检查，并通过公开镜像服务的真实请求。** 本轮验证对应统一安装、构建和文档入口的整理。

## 环境与证据

在 macOS、Node.js 26.10.0、pnpm 10.27.0、npm 11.19.1 下，将源码构建为实际 tarball，再用 `npm install --global --prefix` 安装到临时目录。将该目录的 `bin` 加入 PATH，在仓库外执行 `njucli`。配置和 Skill 注册目录使用临时路径，验证完成后清理。

- [命令记录](assets/2026-10-20-unified-cli/commands.json)：实际命令、UTC 时间、退出码及输出；本地仓库路径脱敏为 `<repo>`。
- [自动检查日志](assets/2026-10-20-unified-cli/checks.txt)：真实进程文件锁与安装检查，2 项通过。
- [MCP 记录](assets/2026-10-20-unified-cli/mcp.json)：由 `njucli mcp` 启动的服务、工具数量与分布、真实镜像查询响应。
- [安装包摘要](assets/2026-10-20-unified-cli/package-summary.json)：本次安装验证时的包清单与环境信息。

## 验证结果

| 范围 | 实际操作 | 结果 |
| --- | --- | --- |
| 依赖与构建 | `pnpm install --frozen-lockfile`、`pnpm lint`、`pnpm test` | 通过 |
| 安装脚本 | `bash -n scripts/install.sh`、帮助与参数检查 | 语法和帮助正常，参数校验按预期返回 |
| 全局安装 | 实际 tarball 安装到临时 prefix，执行 `njucli --help` | 成功，全部命令由同一个安装包提供 |
| 业务入口与说明 | 逐一运行 18 个业务的 `--help`，检查 Skill 注册路径及内容 | 全部通过 |
| 包内资料 | `njucli institution list --format json` | 成功读取随包机构目录，结果非空 |
| 内置模板 | `njucli table preset gradebook --output … --format json` | 成功导出，回读与随包模板一致 |
| MCP | 启动 `njucli mcp`、发现工具、调用 `institution_list` | 136 个工具均声明只读；查询与 CLI 结果一致 |
| 公开实网 CLI | `njucli campus mirrors ubuntu --format json` | 真实返回 8 条匹配镜像 |
| 公开实网 CLI | `njucli campus mirrors pypi --format json` | 真实返回 3 条匹配镜像 |
| 公开实网 MCP | `campus_mirrors({"query":"ubuntu"})` | 真实返回 8 条匹配镜像 |
| IT 侠入口 | `njucli itxia cancel --help` | 正确展示订单编号、`--yes` 与输出格式参数 |
| 打包与链接 | 检查包清单、所有 Skill 文档的本地链接、`git diff --check` | 根包统一维护依赖，说明、参考资料和模板完整，检查通过 |

**远端请求范围为公开镜像查询；校园写操作的验证沿用对应业务报告。** 安装脚本固定从 GitHub `main` 拉取源码，本轮候选代码通过实际 tarball 安装验证；合入后的一键安装与 `njucli upgrade` 留待目标渠道核对。认证登录流程沿用现有实现。
