# 显式浏览器代理与统一 CLI 主线同步

## 范围

将 `origin/main` 的 `0528b7c` 正常合入 `fix/browser-proxy`，保留 `586cb6a` 引入的显式 `NJUCLI_PROXY_URL`。公共认证源码仍在 `src/auth/browser-session.ts`，四处 HTTP/浏览器上下文创建继续使用同一代理配置。

统一入口为 `njucli`，开发构建入口为 `node dist/cli.js`。构建使用 `scripts/build.mjs`，不恢复独立 Skill 的 `scripts/run.mjs` 或认证 `runtime.mjs`。Docker CLI 阶段应复制新的构建脚本，最终镜像整体保留 `dist/`、根 `node_modules/` 和业务 `skills/` 说明与模板；`NJUCLI_SKILLS_DIR` 仍可指向 `/opt/njucli/skills`。`auth authenticate --credentials - --format json` 与 `data.studentId` 契约保持。

按主线规则移除旧代理测试中的模拟目标与浏览器替身。显式验证脚本 [scripts/verify-proxy.mjs](../../scripts/verify-proxy.mjs) 使用新临时账号目录、真实 HTTP 代理、真实 Chromium 和公开 JSON；结束后清理临时目录，不读取已有账号的凭据或会话。

## 本地运行检查

- Windows Node.js 22.22.0、pnpm 10.27.0：锁文件安装、`pnpm lint`、`pnpm build` 通过。
- `node dist/cli.js --help` 与 `node dist/cli.js campus sources --format json` 通过。
- 隔离 Linux Node.js 24.22.0 容器中执行全部两个 `node:test` 用例通过，无跳过。使用新构建产物和实际 tarball 安装，验证真实进程文件锁、18 个业务 Skill、136 个只读 MCP 工具及统一 CLI；容器限制 2 GiB / 1 CPU。

## 匿名实网验证

在已有镜像内用新构建模块执行：

```bash
NJUCLI_PROXY_URL=http://host.docker.internal:7892 \
NJUCLI_PROXY_VERIFY_URL=https://api.github.com/ \
xvfb-run -a node scripts/verify-proxy.mjs
```

HTTP 请求、清空 Cookie 后 HTTP、无界面 Chromium、有界面 Chromium、浏览器清空 Cookie 后的 HTTP 请求均获得 HTTP 200 和有效 JSON。验证包含浏览器模式切换时创建的上下文，TLS 保持默认校验。实际输出见 [checks.txt](assets/2026-10-21-browser-proxy-main-sync/checks.txt)。

系统代理访问 NJU Mirror 时 TLS 连接断开，因此使用公开 GitHub JSON 核对代理机制。校园专用代理恢复后另行验证默认的 `https://mirror.nju.edu.cn/configs/tunasync.json`：首个实际带认证代理请求 HTTP 200，清空 Cookie 后请求 HTTP 502；脚本停止并报告错误，未隐式重试。可通过 `NJUCLI_PROXY_VERIFY_URL` 指定公开 JSON。

本轮未使用校园账号、未执行认证业务。带认证代理获得了实际远端响应，但因上游 502 未完成全部五阶段；完整五阶段通过的目标为 GitHub 公开 JSON。该结果仅证明实际代理和浏览器上下文切换可运行，不代替校园认证与业务验收。

## 容器保活契约

`auth authenticate`、`auth login` 和业务 `ensureSession` 不启动后台进程。仅显式 `auth daemon start` 或顶层 `auto start` 启用保活；不存在额外的自动启动禁用环境变量，默认不启动。Linux `auto start` 依赖 systemd 用户服务，不作为 Web 或任务沙箱的容器进程管理方式。既有账号和目录隔离契约保持。
