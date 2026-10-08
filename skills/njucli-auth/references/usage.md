# 统一认证

账号通过 `account use` 或 `NJUCLI_ACCOUNT` 选择。首次登录可导入含 `username/password` 的 JSON：

```bash
node "$SKILL_DIR/scripts/run.mjs" auth login --credentials /private/path/auth.json
node "$SKILL_DIR/scripts/run.mjs" auth status sso --format json
node "$SKILL_DIR/scripts/run.mjs" auth login box
```

业务命令自动检查并恢复会话。凭据保存在 `~/.config/njucli/accounts/<account>/auth.json`；网站要求扫码时由本人完成。登录后用新进程 `auth status <capability>` 核对 `valid`。

## 滑块

在交互式终端运行：

```bash
node "$SKILL_DIR/scripts/login.mjs"
```

脚本复用当前认证流程填写账号。向同一进程输入 `shot`，读取输出截图；确定按钮中心 `(x,y)` 和横向距离 `dx` 后输入 `drag x y dx`，坐标单位为截图的 CSS 像素。再次输入 `shot` 核对最新画面。

成功后输出 `{"capability":"sso","status":"valid"}` 并保存会话。再运行 `auth status sso --format json` 验证。截图位于系统临时目录 `njucli-slider.png`，完成后删除。
