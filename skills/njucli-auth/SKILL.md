---
name: njucli-auth
description: 登录南京大学统一身份认证、保存本地凭据、查询与维护会话状态、协助处理登录滑块验证。在涉及校园登录或会话失效时使用。
---

# 统一身份认证

扫码由本人完成。

## 运行前提

已保存会话的查询通过 HTTP 执行，网页登录及页面操作按需启动本机浏览器。默认使用 Playwright 的 `chrome` 通道；容器部署可通过 `NJUCLI_BROWSER_EXECUTABLE` 指定 Chromium 可执行文件，例如 `/usr/bin/chromium`。后台保活由 Node.js 启动独立 CLI 进程，在 Unix 系统上使用相同的命令和 XDG 目录规则。Windows 的后台进程行为待验证。

## 登录与状态

通过 JSON 文件导入统一认证账号与密码（内容包含 `username` 和 `password`）：

```bash
njucli auth login --credentials /path/to/auth.json
njucli auth status sso --format json
njucli account use ACCOUNT
```

`auth login` 默认使用 `sso`，登录南京大学统一身份认证。各业务所需的登录方式和访问前提见所属 Skill。

应用需要核验本次密码及学校身份时，使用非交互入口：

```bash
njucli auth authenticate --credentials - --format json < /path/to/auth.json
```

`authenticate` 在当前账号目录内清空 Cookie，以本次凭据完成 SSO，再通过青年平台读取本人学号，JSON 的 `data.studentId` 来自学校响应。该入口依赖统一认证与青年平台可用；身份回读失败时返回错误。成功后保存凭据和新会话，失败时清理本次 Cookie 并恢复原凭据。`auth login --credentials -` 同样支持从标准输入读取凭据。

`account use` 或环境变量 `NJUCLI_ACCOUNT` 用于选择本地账号。业务命令会按需恢复登录，`auth status` 返回 `valid` 表示会话可用。CLI 使用专用浏览器与账号目录，普通浏览器中的登录由该浏览器独立保存。

凭据和 Cookie 保存在 `~/.config/njucli/accounts/<账号>/`，可通过 `XDG_CONFIG_HOME` 设置配置根目录，文件权限为 0600。浏览器资料目录由 `XDG_DATA_HOME` 设置数据根目录。同一账号的调用通过进程锁串行读写 Cookie。

## 会话维护

```bash
njucli auth maintain --format json
```

该命令检查统一认证会话，并保存更新的 Cookie。会话有效时返回 `kept-alive`，用已存凭据恢复成功后返回 `restored`。

学校决定会话的闲置期限和最长有效期；到期后使用已存凭据重新登录。用户要求持续维护时，启动下方后台进程，并按实际闲置期限设置间隔。

## 后台保活

先保存统一认证凭据，再启动常驻 CLI 进程，持续维护当前账号：

```bash
njucli auth daemon start
njucli auth daemon status --format json
njucli auth daemon stop
```

启动后立即维护一次，之后每轮结束后等待 600 秒。使用 `start --interval 300` 可设为五分钟；间隔支持 1–2147483 秒的整数。调整间隔时先 `stop` 再 `start`。

进程固定启动时的账号与配置目录，每轮复用账号 Cookie 和进程锁，退出终端后继续运行。系统重启后可通过下方 `auto start` 配置自动恢复。普通网络失败后在下个周期再维护；学校拒绝凭据、凭据缺失或要求本人操作时结束进程，处理原因后重新启动。后台保活停止时，业务命令仍会按需检查和恢复会话。

`status` 返回 `running/pid`（进程状态）、`intervalSeconds`（维护间隔）、`lastSuccess`（最近成功维护）和 `lastResult`（最近输出）。账号目录下的 `auth-daemon/process.json` 与 `auth-daemon/output.log` 保存进程记录和脱敏日志，权限为 0600。默认路径为 `~/.config/njucli/accounts/<账号>/auth-daemon/`；设置 `XDG_CONFIG_HOME` 后位于该根目录的 `njucli/accounts/<账号>/auth-daemon/`。

`stop` 等待当前维护结束后清理进程记录。退出账号、删除账号或升级 CLI 前先停止后台进程；升级后重新启动，使用新的 CLI 入口。

### 登录后自启动

```bash
njucli auto start
njucli auto status --format json
njucli auto stop
```

`auto start` 为当前账号保存系统自启动配置，立即启动保活，并在重启后登录系统时自动启动；默认每 600 秒维护一次，支持 `--interval`。已有后台进程会先完成当前维护再切换。用 `account use` 选择账号后分别启用；也可通过环境变量 `NJUCLI_ACCOUNT` 指定账号。状态返回 `enabled`（已启用）、`loaded`（系统已加载或注册）及配置路径；实际进程与维护结果用 `auth daemon status` 查询。

| 系统 | 自启动方式与前提 | 配置位置 |
| --- | --- | --- |
| macOS | 当前用户的 LaunchAgent，登录桌面后启动 | `~/Library/LaunchAgents/cn.nju.njucli.auth.<账号>.plist` |
| Linux | systemd 用户服务，需要可用的 `systemctl --user`；用户登录后启动，退出后的运行时间遵循系统用户服务设置 | `$XDG_CONFIG_HOME/systemd/user/njucli-auth-<账号>.service`，默认 `~/.config/systemd/user/` |
| Windows | 当前 Windows 用户的登录触发任务，使用系统 PowerShell 与 ScheduledTasks 模块，以交互用户身份运行 | 任务计划程序中的 `NjuCLI-<Windows用户名>-<账号>`；启动脚本位于账号目录 `auth-daemon/autostart.mjs` |

`auto stop` 删除当前账号的自启动配置并停止保活。`auth daemon stop` 只停止本次进程，下次登录仍按自启动配置启动。配置只记录运行路径、账号名和目录；密码与 Cookie 继续使用账号目录中的文件。启用后保留 Node 和 CLI 的安装路径；移动安装位置或切换 Node 后重新运行 `auto start`。升级、退出或删除账号前先执行 `auto stop`，升级完成后再启用。

重启不会删除已保存的 Cookie 和凭据；会话仍有效时复用，过期时自动登录。后台维护统一认证，eHall 等业务站点在实际调用时建立或恢复自己的会话。学校要求本人验证时，通过官方页面完成。

macOS 与 Linux 的配置加载和维护结果已实机核对；Windows 的实际系统运行待核对。

遇到登录错误时：

- `AUTH_REJECTED`：按学校返回的原因检查账号状态和凭据。
- `AUTH_CHALLENGE_FAILED`：内置滑块识别尝试超限，请重新运行 `njucli auth login`。
- `USER_ACTION_REQUIRED`：需要手机扫码或其他人工操作，请在官方页面完成。
- `AUTH_RESTORE_FAILED`：自动恢复会话失败，请检查网络或重新登录。
