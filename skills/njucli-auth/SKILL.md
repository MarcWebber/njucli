---
name: njucli-auth
description: 登录南京大学统一身份认证、保存本地凭据、查询与维护会话状态、协助处理登录滑块验证。在涉及校园登录或会话失效时使用。
---

# 统一身份认证

以下命令在本 Skill 目录运行；扫码由本人完成。

## 运行前提

已保存会话的查询通过 HTTP 执行，网页登录及页面操作按需启动本机浏览器。当前浏览器入口使用 Playwright 的 `chrome` 通道，后台进程的启动与停止使用本机 `launchd`。

## 登录与状态

通过 JSON 文件导入统一认证账号与密码（内容包含 `username` 和 `password`）：

```bash
node scripts/run.mjs auth login --credentials /path/to/auth.json
node scripts/run.mjs auth status sso --format json
node scripts/run.mjs auth login box
node scripts/run.mjs account use ACCOUNT
```

省略登录目标时默认使用 `sso`。也支持单独登录 `box`、`selection`、`ehall`、`timetable`、`se`、`tex`、`sports`、`youth`、`table`、`vpn`、`opac` 等站点。

`account use` 或环境变量 `NJUCLI_ACCOUNT` 用于选择本地账号。业务命令会按需恢复登录，`auth status` 返回 `valid` 表示会话可用。CLI 使用专用浏览器与账号目录，普通浏览器中的登录由该浏览器独立保存。

凭据和 Cookie 保存在 `~/.config/njucli/accounts/<账号>/`，可通过 `XDG_CONFIG_HOME` 设置配置根目录，文件权限为 0600。浏览器资料目录由 `XDG_DATA_HOME` 设置数据根目录。同一账号的调用通过进程锁串行读写 Cookie。

## 会话维护

```bash
node scripts/run.mjs auth maintain --format json
```

该命令检查统一认证与 EHall 会话，并保存更新的 Cookie。会话有效时返回 `kept-alive`，用已存凭据恢复成功后返回 `restored`。

学校决定会话的闲置期限和最长有效期；到期后使用已存凭据重新登录。用户要求持续维护时，启动下方后台进程，并按实际闲置期限设置间隔。

## 后台保活

先保存统一认证凭据，再启动常驻 CLI 进程，持续维护当前账号：

```bash
node scripts/run.mjs auth daemon start
node scripts/run.mjs auth daemon status --format json
node scripts/run.mjs auth daemon stop
```

启动后立即维护一次，之后每轮结束后等待 600 秒。使用 `start --interval 300` 可设为五分钟；间隔支持 1–2147483 秒的整数。调整间隔时先 `stop` 再 `start`。通过构建后的 CLI 或本 Skill 的 `scripts/run.mjs` 启动。

进程固定启动时的账号与配置目录，每轮复用账号 Cookie 和进程锁，退出终端后继续运行。launchd 负责登录后启动与崩溃恢复。普通网络失败后在下个周期再维护；学校拒绝凭据、凭据缺失或要求本人操作时结束进程，处理原因后重新启动。

`status` 返回 `running/pid`（进程状态）、`enabled`（启动注册情况）、`lastSuccess`（最近成功维护）和 `lastResult`（最近输出）。账号目录中的 `auth-daemon.json` 与 `auth-daemon.log` 保存进程记录和脱敏日志，权限为 0600。`stop` 结束进程并移除启动配置；退出账号前先停止后台进程，再执行 `auth logout`。

遇到登录错误时：

- `AUTH_REJECTED`：按学校返回的原因检查账号状态和凭据。
- `AUTH_CHALLENGE_FAILED`：滑块验证尝试超限，请重新运行或使用下方滑块脚本。
- `USER_ACTION_REQUIRED`：需要手机扫码或其他人工操作，请在官方页面完成。
- `AUTH_RESTORE_FAILED`：自动恢复会话失败，请检查网络或重新登录。

## 滑块验证辅助

统一认证已内置滑块识别。若多次验证失败，可在交互式终端运行辅助脚本：

```bash
node scripts/login.mjs
```

输入 `shot` 获取截图，再输入 `drag x y dx` 拖动滑块。`x/y` 是滑块按钮中心，`dx` 是向右移动的距离，均按当前截图的 CSS 像素计算。验证成功后保存会话；完成后删除临时截图 `njucli-slider.png`。
