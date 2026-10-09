---
name: njucli-auth
description: 登录南京大学统一身份认证、保存本地凭据、查询与维护会话状态、协助处理登录滑块验证。在涉及校园登录或会话失效时使用。
---

# 统一身份认证

以下命令在本 Skill 目录运行。网页登录需要 Google Chrome；扫码由本人完成。

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

## 会话维护

```bash
node scripts/run.mjs auth maintain --format json
```

该命令每次执行维护一次：访问 CAS 统一认证，为 EHall 登录入口取得新的服务票据，完成跳转后以用户接口的 `hasLogin` 核对结果，并保存更新的 Cookie。会话有效时返回 `kept-alive`，用已存凭据恢复成功后返回 `restored`。

用户要求定时维护时，按实际闲置期限设置执行间隔，并用 `NJUCLI_ACCOUNT` 固定要维护的账号。学校决定会话的闲置期限和最长有效期；最长有效期到达后，已存凭据用于重新建立会话。`CASTGC` 标识 CAS 根会话，EHall 的 `MOD_AUTH_CAS` 保存本站会话，URL 中的 `ticket=ST-...` 用于本次登录交换。维护成功表示本次认证链路与回读成功，持续有效时间通过周期执行和后续状态核对。

## 后台保活

macOS 支持启动常驻的 CLI 后台进程，持续维护当前账号。先保存统一认证凭据，再启动进程：

```bash
node scripts/run.mjs auth daemon start
node scripts/run.mjs auth daemon status --format json
node scripts/run.mjs auth daemon stop
```

默认启动后立即维护一次，之后在同一 CLI 进程内每 600 秒维护一次。使用 `start --interval 300` 可设为每五分钟；间隔支持 1–2147483 秒的整数。调整已启用进程的间隔时，先 `stop` 再 `start`。通过构建后的 CLI 或本 Skill 的 `scripts/run.mjs` 启动。

进程固定启动时的账号与配置目录，每轮复用同一账号的 Cookie 和进程锁。launchd 管理进程的启动、停止、崩溃恢复和登录后自动启动。退出终端后继续运行；电脑运行期间按间隔维护，休眠期间暂停网络访问，唤醒后恢复执行。普通网络失败会输出脱敏错误，下个周期再执行维护。学校拒绝凭据、凭据缺失或要求本人操作时，进程结束；处理对应原因后，先 `stop` 再 `start`。停止时完成正在进行的维护并保存 Cookie，然后结束进程。

`status` 的 `running/pid` 显示 CLI 进程状态，`enabled` 表示已注册登录后自动启动，`lastSuccess` 是最近成功的维护记录，`lastResult` 是后台最近输出。进程记录 `auth-daemon.json` 和日志 `auth-daemon.log` 位于账号目录，权限 0600；启动配置位于 `~/Library/LaunchAgents/cn.edu.nju.njucli.auth.<账号>.plist`。`stop` 结束进程并移除启动配置，保留账号、Cookie 与日志。需要保持退出状态时，先停止后台进程，再执行 `auth logout`。

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
