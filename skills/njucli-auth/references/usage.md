# 统一认证

账号通过 `account use` 或 `NJUCLI_ACCOUNT` 选择。首次登录可导入含 `username/password` 的 JSON：

```bash
node "$SKILL_DIR/scripts/run.mjs" auth login --credentials /private/path/auth.json
node "$SKILL_DIR/scripts/run.mjs" auth status sso --format json
node "$SKILL_DIR/scripts/run.mjs" auth login box
```

凭据保存在 `~/.config/njucli/accounts/<account>/auth.json`。业务命令自动检查并恢复会话；已有凭据时，统一认证在后台 Chrome 完成账号登录和官方滑块。扫码由本人完成。登录后用新进程 `auth status <capability>` 核对 `valid`。

## 维护会话

```bash
NJUCLI_ACCOUNT=default node "$SKILL_DIR/scripts/run.mjs" auth maintain --format json
```

会话有效时返回 `action: kept-alive`；失效时使用已存凭据恢复，返回 `action: restored`。最近一次维护结果保存在账号目录的 `auth-maintenance.json`。缺少凭据时，先执行首次登录。

用户要求持续维护时，将该命令交给定时任务每两小时运行并固定账号。维护与业务调用共用账号锁；电脑休眠期间未执行的维护由下一次业务调用按需恢复。`kept-alive` 表示本次 CAS 访问成功，接口未提供新的到期时间。

## 登录错误

| 结果 | 处理 |
| --- | --- |
| `AUTH_REJECTED` | 按学校返回的原因检查账号或更新凭据 |
| `AUTH_CHALLENGE_FAILED` | 已尝试三张官方滑块图，重新执行并查看当前验证页面 |
| `AUTH_RESTORE_FAILED` | 检查网络、已存凭据和官方验证 |
| `USER_ACTION_REQUIRED` | 在官方页面完成扫码或其他交互 |

## 滑块协助

在交互式终端运行：

```bash
node "$SKILL_DIR/scripts/login.mjs"
```

脚本打开可见 Chrome 并复用同一认证流程。运行期间向同一进程输入 `shot`，读取输出截图；根据当前图片确定按钮中心 `(x,y)` 和横向距离 `dx`，输入 `drag x y dx`。坐标单位为截图的 CSS 像素，每张验证图重新定位。

成功后输出 `{"capability":"sso","status":"valid"}` 并保存会话。再运行 `auth status sso --format json` 核对。截图位于系统临时目录 `njucli-slider.png`，完成后删除。
