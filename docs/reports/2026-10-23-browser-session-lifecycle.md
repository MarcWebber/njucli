# 浏览器目录占用导致校园调用阻塞的修复验证

## 故障与修改

部署容器重建后，账号的持久浏览器目录仍保存着旧容器的 Chromium `SingletonLock`。Box 登录打开浏览器时停在目录占用提示，同时持有公共账号会话锁，后续 EHALL 等调用等待同一把锁，最终表现为多个平台一起超时。

公共浏览器改为每次启动使用临时目录。账号 Cookie 继续通过原有 `session-cookies.json` 读取和保存，业务接口及账号会话互斥逻辑保持原样。Playwright 的 `launchPersistentContext("")` 会创建临时用户目录，契约见[官方说明](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context)。

Web 同时修正 CLI 子进程的生命周期：Linux 调用使用独立进程组，退出时回收同组进程，避免会话锁辅助进程继续占用锁。Runner 镜像同步使用这份 CLI。

## 实际执行

2026-10-23 在重新构建的 Web / Runner 部署中验证，入口为 [NJUWEB](https://njuweb.xikki.org/)。沿用本次故障账号在部署卷中的会话，通过 Web 的 `runNjucli` 调用实际 CLI；没有新增测试、模拟响应或替身服务，也没有执行校园业务写操作。

实际 CLI 命令如下，账号目录由 Web 的 `userOptions` 设置：

```sh
node /opt/njucli/dist/cli.js auth status sso --format json
node /opt/njucli/dist/cli.js auth status ehall --format json
node /opt/njucli/dist/cli.js auth status lms --format json
node /opt/njucli/dist/cli.js box repos --format json
node /opt/njucli/dist/cli.js auth status box --format json
```

另一次通过 `runNjucli({ ...local, timeout: 500 }, ['box', 'repos'])` 执行真实 Box 请求，检查超时后账号锁是否释放，随后立即执行 `auth status box`。

## 结果与范围

| 检查 | 实际结果 |
| --- | --- |
| Box 资料库列表 | 成功返回 4 个资料库；首次恢复约 2.4 秒，后续回读 737 ms |
| SSO 登录态 | `valid`，1089 ms |
| EHALL 登录态 | `valid`，640 ms |
| LMS 登录态 | `valid`，1064 ms |
| Box 登录态 | `valid`，621 ms |
| 500 ms 限时的真实 Box 调用 | 507 ms 收到 `SIGKILL`，随后 Box 登录态读取成功，账号锁辅助进程残留数为 0 |
| 此前被账号锁阻塞的任务 | 清除旧目录占用后，两项任务均完成 |
| 构建 | CLI TypeScript 构建、Web TypeScript 检查及 Web / Runner 镜像构建通过 |

脱敏命令输出见 [checks.txt](assets/2026-10-23-browser-session-lifecycle/checks.txt)。只记录认证状态、耗时与资料库数量，不包含账号、凭据、Cookie 或资料库名称。最初三条记录只输出了耗时，文件末尾补有对应会话状态的实际输出。

本次完成 Box 真实业务读取以及 SSO、EHALL、LMS 登录态检查，没有逐项验证所有校园业务功能。
