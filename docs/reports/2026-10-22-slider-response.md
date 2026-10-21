# 登录跳转时的滑块响应读取

## 修改范围

`dragLoginSlider` 原先在浏览器收到滑块验证响应后调用 `response.json()`，成功登录立即跳转时，Chromium 可能已清除响应体并报 `Network.getResponseBody: No resource with given identifier found`。

现在仅拦截官方 `verifySliderCaptcha.htl` 请求，通过 `route.fetch()` 获取真实响应，在交还页面前读取 JSON，再原样 `route.fulfill({ response })`。滑块位置计算、拖动及原有尝试次数保持不变，不伪造学校结果，不改 CLI 的其他登录入口。

## 构建与实际认证

Web 与 Runner Docker 构建均完成 CLI 的 `pnpm build`。在部署后的 Web 容器中，经实际 `runNjucli` 入口、原用户隔离目录执行：

```text
node /opt/njucli/dist/cli.js auth login sso --format json
node /opt/njucli/dist/cli.js auth status sso --format json
```

从真实命令结果提取并脱敏后的日志：

```json
{"login":"valid","status":"valid"}
```

部署后再次读取 SSO 状态仍为 `valid`。这确认实际校园认证入口与会话探测可运行；原会话可能被复用，没有记录到新的滑块挑战，因此不声称现场复现并覆盖了截图中的跳转时序。

未新增测试、mock 或替身服务，未记录账号、密码和 Cookie。原显式浏览器代理的检查记录见 [主线同步报告](2026-10-21-browser-proxy-main-sync.md)。
