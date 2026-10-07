---
name: njucli-auth
description: 使用本机 NjuCLI 登录南京大学统一认证、保存凭据，处理官方滑块、自动恢复与定时维护登录会话。
---

# NjuCLI 统一认证

需要 Node.js 20+、本机 Google Chrome，以及完整 NjuCLI 包。`curl -fsSL https://raw.githubusercontent.com/MarcWebber/njucli/main/scripts/install.sh | bash` 安装 CLI 和全局 Skill，`njucli upgrade` 同步更新。全局 Skill 链接到包内目录，脚本通过真实路径复用包内 `dist`。

首次登录通过 `njucli auth login --credentials ./auth-credentials.json` 保存用户提供的 `username/password`。现有凭据在 `~/.config/njucli/accounts/<account>/auth.json`，脚本直接复用；账号通过 `account use` 或 `NJUCLI_ACCOUNT` 选择。

业务命令先通过 HTTP 检查和恢复已有 Cookie，过期时自动使用已存密码登录。统一认证的拼图识别与官方鼠标拖动已接入 CLI；以官方回跳和后续实际查询为成功依据。浏览器仅在需要登录页面、扫码或 TeX 编辑时启动，认证与业务复用当次会话，结束时保存全部 Cookie。

已存凭据的统一认证使用后台 Chrome。同一账号的 CLI/MCP 会话读写自动排队，后续调用在取得锁后读取最新 Cookie；持有进程退出后会清理残留锁。TeX 编辑仍打开可见页面，并带入当次认证 Cookie。已有根认证时，SoftSE 使用 HTTP CAS，TeX 使用 HTTP OAuth 授权恢复。

主动登录使用 `njucli auth login [capability]`，在线检查使用 `njucli auth status [capability] --format json`。状态检查不读取或提交密码、不执行 OAuth 授权；TeX 登录会提交官方 `user_profile` 基本信息授权，再检查 `/api/user/info`。登录完成后，应由新进程返回目标能力的 valid 状态。

## 自动维护会话

日常直接执行业务命令，CLI 在业务之前处理会话失效。持续维护统一认证使用：

```bash
NJUCLI_ACCOUNT=default njucli auth maintain --format json
```

该命令访问 CAS 根入口并换取 EHall 访问票据；会话有效时返回 `action: kept-alive`，失效时直接使用已存凭据在后台恢复，返回 `action: restored`。完成后保存当前 Cookie，账号目录的 `auth-maintenance.json` 记录最近执行时间与动作。同一账号与业务命令共用锁，避免覆盖会话；TeX、SoftSE、青年平台在业务调用时派生各自的会话。

用户要求自动保活或避免反复手动登录时，将此命令交给定时任务每两小时运行，固定本地账号。`auth status` 的 expired 交给 `auth maintain` 处理。任务失败时根据实际错误检查网络、凭据或官方验证；不把常规会话过期交给用户手动操作。电脑休眠或调度未运行期间，下一次业务调用仍会按需恢复。

`kept-alive` 表示本次 CAS 访问成功，`restored` 表示已重新建立会话；接口没有返回新的过期时间，这两个结果均不表示取得 OAuth refresh_token。定时维护复用学校已有会话并处理失效，长期持续性以实际定时记录为准。

## 滑块

先运行普通业务命令或 `njucli auth login`，CLI 会读取当前原图识别缺口并执行官方拖动。以官方验证响应判断结果，被拒绝时等待官方换图后继续，最多尝试三张。学校账号错误直接返回 `AUTH_REJECTED`，滑块均被拒绝返回 `AUTH_CHALLENGE_FAILED`，自动恢复超时返回 `AUTH_RESTORE_FAILED`；调用 Agent 根据具体原因处理，不把业务请求重复执行。需要按截图协助时，在交互式终端运行本 Skill 的脚本。已有用户授权时直接完成该流程，不重复要求用户手工操作。将下方路径替换为当前 `SKILL.md` 所在目录的绝对路径：

```bash
node /path/to/njucli-auth/scripts/login.mjs
```

脚本打开 CLI 专用浏览器，复用现有自动登录。自动拖动未通过时，向同一个进程输入 `shot`，读取输出路径的截图；图片中找到滑块按钮中心 `(x,y)`、左侧拼图与目标缺口的横向距离 `dx`，输入 `drag x y dx`。坐标和距离使用截图的 CSS 像素。以官方回跳判断是否成功；未回跳时再次截图，根据新图重新定位。登录完成后不再向进程输入指令。

不要复用上一张验证码的坐标。脚本的手动指令仅执行输入的坐标拖动。扫码由用户使用自己的设备完成。

官方回跳成功后，脚本输出 `{"capability":"sso","status":"valid"}`，保存会话并退出。再以新进程验证：

```bash
njucli auth status sso --format json
```

成功条件为新进程返回 `valid`。截图权限 0600，保存在系统临时目录 `njucli-slider.png`；完成后删除截图。密码、会话 Cookie 和截图不写入仓库或交付记录。

2026-09-26 已验证截图、拖动、官方回跳及新进程恢复会话。详见[接口证据](https://github.com/MarcWebber/njucli/blob/main/docs/interface-evidence.md)。
