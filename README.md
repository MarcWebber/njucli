# NjuCLI

NjuCLI 把南京大学分散在统一身份认证、网上办事大厅、个人课表、图书馆、体育场馆和学校公开网站中的高频能力，整理成一套适合人和 AI 调用的命令行接口。

当前仓库实现了可运行的 MVP：账号隔离、SSO-first 登录与刷新、校园公告、个人课表、图书检索与馆藏、体育场馆与余量、日常聚合、诊断命令和只读 MCP。受保护能力仍需校园网和真人账号验收，具体边界见 [V1 设计与实现](docs/design-v1.md) 与 [校园服务接口证据](docs/interface-evidence.md)。

## 安装与运行

需要 Node.js 20 或更高版本、pnpm，以及本机已安装的 Chromium/Chrome。NjuCLI 不下载私有浏览器，也不保存统一身份认证密码。

```bash
pnpm install
pnpm build
node dist/cli.js --help
```

开发时可直接运行：

```bash
pnpm dev course today
```

## 常用命令

命令结构固定为 `njucli <domain> <command> [target] [options]`。业务动作是子命令，option 只做筛选或输出修饰。

```bash
# 登录与账号
njucli auth login
njucli auth login timetable
njucli auth status
njucli account add second
njucli account use second

# 校园公开信息
njucli campus sources
njucli campus articles --source nju --section news

# 课表
njucli course terms
njucli course today
njucli course week 2026-09-07
njucli course next
njucli course export timetable.ics

# 图书馆
njucli library search "操作系统" --field title
njucli library book 8765
njucli library holdings 8765
njucli library loans

# 体育场馆
njucli sports venues
njucli sports slots --venue-site 12 --date tomorrow
njucli sports bookings

# 聚合、诊断与 AI
njucli today
njucli doctor
njucli mcp
```

默认输出面向人。需要稳定机器输出时，在具体 leaf command 后添加 `--format json`：

```bash
njucli course next --format json
njucli sports slots --venue-site 12 --date 2026-09-07 --format json
```

没有根级 `--json`、`--profile`、通用 action flag 或动态命令分派。账号只通过 `njucli account` 管理；批处理可以在进程启动前设置 `NJUCLI_ACCOUNT=<name>`。

## 当前边界

- 课表目前实现并固定到 EHall 本科 `jwapp` 契约；研究生 `gsapp` 不会被自动猜测或作为 fallback。
- 图书检索、书目、馆藏和借阅采用现代汇文 `meta-local` 契约。契约已经由同产品族公开实例和脱敏 fixtures 验证，但南大 OPAC 仍需在校园网或 WebVPN 环境做实网 smoke。
- 体育场馆的场馆、场地、日期余量、我的预约和预约详情已实现固定接口与签名；真实账号、角色和 token 生命周期仍需真人登录验证。
- 续借、预约馆藏、预约和取消场地尚未捕获完整写契约，因此 MVP 不注册这些空壳命令。
- MCP 只暴露读取能力，复用 CLI 相同的 use case 和 DTO；写操作不会通过 MCP 开放。

## 验证

```bash
pnpm lint
pnpm test
pnpm build
```

默认测试使用脱敏 fixtures 和 fake session，不访问生产站点，不包含真实姓名、学号、Cookie、JWT 或验证码。生产实网验收需要校园网/WebVPN 和用户在学校原始页面完成认证。

安全原则：不从现有浏览器静默提取 Cookie，不把 Cookie、JWT、验证码或密码写入日志、命令参数和测试夹具；写操作不因认证、超时或服务错误自动重放。
