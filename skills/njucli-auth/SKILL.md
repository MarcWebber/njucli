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

`account use` 或环境变量 `NJUCLI_ACCOUNT` 用于选择本地账号。业务命令会按需恢复登录，`auth status` 返回 `valid` 表示会话可用。

## 会话维护

```bash
node scripts/run.mjs auth maintain --format json
```

会话有效时返回 `kept-alive`，用已存凭据恢复成功后返回 `restored`。用户要求定时维护时，可每两小时执行一次，并用 `NJUCLI_ACCOUNT` 固定要维护的账号。

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
