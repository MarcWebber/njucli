---
name: njucli-auth
description: 使用本机 NjuCLI 登录南京大学统一认证、保存凭据，并通过截图和拖动完成官方滑块验证。用户需要南大 SSO 登录或处理 njucli 滑块时使用。
---

# NjuCLI 统一认证

需要 Node.js 20+、本机 Google Chrome，以及完整 NjuCLI 包。`curl -fsSL https://raw.githubusercontent.com/MarcWebber/njucli/main/scripts/install.sh | bash` 安装 CLI 和全局 Skill，`njucli upgrade` 同步更新。全局 Skill 链接到包内目录，脚本通过真实路径复用包内 `dist`。

先通过 `njucli auth login --credentials ./auth-credentials.json` 保存用户提供的 `username/password`。现有凭据在 `~/.config/njucli/accounts/<account>/auth.json`，脚本直接复用；账号通过 `account use` 或 `NJUCLI_ACCOUNT` 选择。

## 滑块

用户授权处理官方滑块时，在交互式终端运行本 Skill 的脚本。将下方路径替换为当前 `SKILL.md` 所在目录的绝对路径：

```bash
node /path/to/njucli-auth/scripts/login.mjs
```

脚本打开 CLI 专用浏览器，复用现有认证流程填写账号并提交。向同一个进程输入 `shot`，读取输出路径的截图；图片中找到滑块按钮中心 `(x,y)`、左侧拼图与目标缺口的横向距离 `dx`，输入 `drag x y dx`。坐标和距离使用截图的 CSS 像素。拖动后再次输入 `shot` 核对，失败时根据新图重新定位。

不要复用上一张验证码的坐标。脚本仅执行输入的拖动，不识别图像或生成答案。扫码由用户使用自己的设备完成。

官方回跳成功后，脚本输出 `{"capability":"sso","status":"valid"}`，保存会话并退出。再以新进程验证：

```bash
njucli auth status sso --format json
```

成功条件为新进程返回 `valid`。截图权限 0600，保存在系统临时目录 `njucli-slider.png`；完成后删除截图。密码、会话 Cookie 和截图不写入仓库或交付记录。

2026-09-26 已验证截图、拖动、官方回跳及新进程恢复会话。详见[接口证据](https://github.com/MarcWebber/njucli/blob/main/docs/interface-evidence.md)。
