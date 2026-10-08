---
name: njucli-auth
description: 使用本机 NjuCLI 登录南京大学统一认证、保存凭据、自动处理官方滑块，检查、恢复和维护登录会话。
---

# 统一认证

将 `SKILL_DIR` 设为本 Skill 目录的绝对路径。网页登录需要本机 Google Chrome；扫码由本人完成。

## 登录与状态

首次登录可导入含 `username/password` 的 JSON：

```bash
node "$SKILL_DIR/scripts/run.mjs" auth login --credentials /private/path/auth.json
node "$SKILL_DIR/scripts/run.mjs" auth status sso --format json
node "$SKILL_DIR/scripts/run.mjs" auth login box
node "$SKILL_DIR/scripts/run.mjs" account use ACCOUNT
```

省略登录目标时使用 `sso`。支持 `ehall/timetable/selection/se/tex/sports/youth/table/vpn/opac/box` 等站点，具体选项见 `auth --help`。`account use` 或 `NJUCLI_ACCOUNT` 选择本地账号。凭据保存于账号目录的 `auth.json`；已有凭据时自动填写账号并处理官方滑块。业务命令会按需恢复会话，登录后以 `auth status` 的 `valid` 为准。

## 维护会话

```bash
NJUCLI_ACCOUNT=default node "$SKILL_DIR/scripts/run.mjs" auth maintain --format json
```

有效会话返回 `kept-alive`，重新登录成功返回 `restored`；结果保存于账号目录的 `auth-maintenance.json`。用户要求持续维护时，将命令交给宿主定时任务每两小时执行并固定账号。电脑休眠期间由后续业务调用按需恢复；`kept-alive` 表示本次访问成功。

| 结果 | 处理 |
| --- | --- |
| `AUTH_REJECTED` | 按学校返回原因核对账号或更新凭据 |
| `AUTH_CHALLENGE_FAILED` | 已尝试三张滑块图，重新执行并查看当前页面 |
| `AUTH_RESTORE_FAILED` | 检查网络、凭据和官方验证 |
| `USER_ACTION_REQUIRED` | 在官方页面完成扫码或其他交互 |

## 滑块协助

在交互式终端运行：

```bash
node "$SKILL_DIR/scripts/login.mjs"
```

向同一进程输入 `shot` 读取当前截图，再根据图片确定按钮中心和横向距离，输入 `drag x y dx`。坐标使用截图 CSS 像素，每张图重新定位。成功返回 `sso/valid` 并保存会话，再用 `auth status sso` 核对；完成后删除系统临时目录中的 `njucli-slider.png`。

登录入口为[南大统一身份认证](https://authserver.nju.edu.cn/authserver/login)，各站点沿用官方登录页面。已有 SSO、TeX、软件学院和青年平台会话及 `maintain` 已实网核对；自然失效后的后台恢复与跨期限持续性待验证。
