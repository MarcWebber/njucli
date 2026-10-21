# PR #23 自启动修复验证

**自定义配置目录下的 Linux 自启动已通过真实系统服务与统一认证请求验证，认证 Skill 的示例已统一使用 `njucli`。**

## 修复与复现

原提交 `95169a3` 把 unit 写到调用进程的自定义 `XDG_CONFIG_HOME`，随后按服务名启用。systemd 用户管理器沿用登录时的搜索目录，无法找到该文件。修复后按 unit 的绝对路径启用，由 systemd 注册到用户服务搜索路径，符合 [systemctl enable 的路径语义](https://www.freedesktop.org/software/systemd/man/latest/systemctl.html)。

本轮分别从原提交和候选源码构建、打包，在同一个 Linux 临时全局 prefix 中先后安装，通过 PATH 中的 `njucli` 执行。`XDG_CONFIG_HOME` 使用带空格的自定义目录，账号名为本轮专用名称。凭据与会话复制自本人现有账号，存入临时私有目录；服务、配置与临时凭据在验证结束后清理。

## 实际结果

环境为 Colima Linux aarch64、systemd 255、Node.js 22.23.3，使用真实 systemd 用户管理器。

| 入口 | 实际结果 |
| --- | --- |
| 原提交的 `njucli auto start --interval 600 --format json` | 退出码 1，systemd 返回 `Unit file … does not exist`，复现评审问题 |
| 候选包的同一命令 | `enabled=true`、`loaded=true`；systemd 返回 `LoadState=loaded`、`UnitFileState=enabled`、`ActiveState=active` |
| `njucli auto status --format json` | 正确回读当前账号、自定义配置路径及启用状态 |
| `njucli auth daemon status --format json` | `running=true`、间隔 600 秒；真实统一认证维护返回 `kept-alive`、`status=valid`，成功时间为 `2026-10-21T03:17:21.581Z` |
| `njucli auto stop --format json` | `enabled=false`、`loaded=false`，服务文件删除 |
| 再次查询 auto 与 daemon 状态 | 自启动关闭，`running=false`，进程记录已清理 |
| 认证 Skill 示例 | `njucli auto start`、`njucli auto status --format json`、`njucli auto stop` 均通过安装后的真实入口执行 |
| `pnpm lint`、`pnpm test` | 类型检查、构建、真实文件锁、实际安装产物与 136 个只读 MCP 工具检查通过 |

## 证据与范围

- [Linux 真实运行日志](assets/2026-10-21-autostart-fixes/linux.txt)：原提交失败、候选安装、服务状态、认证保活、停止及清理结果。
- [本地检查日志](assets/2026-10-21-autostart-fixes/checks.txt)：类型检查、构建与两项真实本地检查。

本轮修复代码仅调整 Linux 的 unit 启用参数；macOS 与 Windows 实现沿用原提交。Windows 的实际系统运行仍待核对。
