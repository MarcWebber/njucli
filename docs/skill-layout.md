# Skill 组织与独立运行

2026-10-08：采用按 Skill 携带业务脚本与资料的组织方式，认证集中在 `src/auth/`。统一 CLI 和各 Skill 调用同一份业务实现；独立入口由源码构建，运行依赖随 Skill 声明。

## 项目比较

Star 数为本次读取 GitHub 页面显示的近似值，用于选择参考样本。目录归属、依赖和实际运行方式决定适用性。

| 项目 | 页面 Star | 已核对的组织方式 | 对 NjuCLI 的启发 |
| --- | ---: | --- | --- |
| [anthropics/skills](https://github.com/anthropics/skills) | 180.1k | [PDF Skill](https://github.com/anthropics/skills/tree/main/skills/pdf) 同目录提供 `SKILL.md`、`scripts/`、`reference.md`、`forms.md` | 业务脚本和资料随 Skill 分发，入口说明按任务引导读取 |
| [obra/superpowers](https://github.com/obra/superpowers) | 297k | [调试 Skill](https://github.com/obra/superpowers/tree/main/skills/systematic-debugging) 以流程说明为主，同目录放排查资料和辅助脚本 | 适合流程类能力；拥有 Skill 目录本身并不等于已经具备独立执行入口 |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | 32.1k | [项目说明](https://github.com/vercel-labs/agent-skills#skill-structure) 定义脚本和资料目录，并提供逐 Skill 构建产物 | 共享构建工具可以留在仓库外层，交付按 Skill 组织 |
| [openai/skills](https://github.com/openai/skills) | 27.9k | 页面声明目录已弃用，并指向新的插件仓库；保留按目录安装 Skill 的历史说明 | 参考目录粒度，当前接入方式另行核对 |

[Agent Skills 规范](https://agentskills.io/specification#optional-directories)将可执行代码放在 `scripts/`，将按需阅读的文档放在 `references/`。Anthropic 的具体 Skill 也会把参考 Markdown 直接放在 Skill 根目录；目录名服务于实际用途。

原 NjuCLI 采用统一 CLI 为中心的分层：业务在 `src/domains/`，命令在 `src/commands/`，绑定在 `src/app/production.ts`，Skill 主要提供调用说明。这便于统一发布和共享认证，但一个业务修改需要跨多个目录，复制单个 Skill 仍依赖外层安装包。当前需求强调 Skill 独立使用，因此将业务按 Skill 收拢，同时保留统一命令入口。

## 归属

```text
skills/njucli-box/
├── SKILL.md
├── scripts/
│   ├── client.ts       远端契约与解析
│   ├── services.ts     业务方法及会话调用
│   ├── commands.ts     参数处理与输出
│   ├── mcp.ts          本业务只读工具
│   ├── run.ts          独立入口源码
│   └── run.mjs         构建生成的运行入口
├── references/
│   ├── usage.md        操作步骤、标识与完成条件
│   └── interfaces.md   接口证据与验证范围
└── package.json        构建生成的运行依赖

src/auth/               统一认证、站点 driver、凭据与会话恢复
src/account/            账号选择及隔离存储
src/core/               文件、日期、参数、错误、输出及脱敏
src/app/                共用运行环境及统一装配
src/mcp/                共用协议处理与工具装配
src/commands/           统一 CLI 装配与全包升级
scripts/                构建、安装工具
```

已有能力对应 14 个 Skill：认证、校园信息、教务、课表选课、e-Hall、图书馆、体育、SoftSE、TeX、邮箱、软件、云盘、今日汇总、服务检查。今日汇总复用课程、借阅与预约业务；服务检查复用图书馆探针。这些组合依赖由构建打入对应入口。

业务资料保存在所属 Skill 的 `references/`。[接口索引](interface-evidence.md)指向各 Skill 的协议说明。命令帮助来自实际注册代码，CLI 和 Skill 保持相同参数。

业务类型从 client 或生产装配推导，参数枚举由 CLI 和 MCP 共用。公开查询直接使用 client；需要认证的业务在 `services.ts` 中复用共享会话。

## 统一认证

`src/auth/create.ts` 装配全部站点 driver，`AuthCoordinator` 负责依赖关系、状态探测与登录恢复，`BrowserSession` 负责同一次调用的浏览器上下文。凭据保存和 `auth` 命令也集中在该目录。业务 client 提供站点读取和错误识别，登录决策由认证层执行。

每个入口使用相同的账号目录、Cookie 保存方式和认证源码。构建产物包含这份共享实现，修改认证后重新构建全部 Skill；已独立复制的 Skill 通过替换新版构建目录更新。构建生成的代码只作为产物维护。

## 独立使用

源码开发先执行：

```bash
pnpm install --frozen-lockfile
pnpm build
```

安装包已带有构建入口。从安装包或构建后的源码中复制一个完整 Skill 目录到目标位置，安装它声明的第三方依赖：

```bash
SKILL_DIR=/absolute/path/njucli-box
npm install --omit=dev --ignore-scripts --prefix "$SKILL_DIR"
node "$SKILL_DIR/scripts/run.mjs" box --help
node "$SKILL_DIR/scripts/run.mjs" account current --format json
node "$SKILL_DIR/scripts/run.mjs" auth login box --credentials /private/path/auth.json
node "$SKILL_DIR/scripts/run.mjs" box repos --format json
```

每个 Skill 都带有公共 `account`、`auth` 命令；具备 MCP 工具的 Skill 使用 `node "$SKILL_DIR/scripts/run.mjs" mcp` 启动本业务的只读服务。统一安装仍使用 `njucli <domain> <command>` 和 `njucli mcp`。

运行需要 Node.js 20+ 与已声明的依赖，网页登录需要本机 Chrome。从 Git 仓库取得的是 TypeScript 源码，需要先在完整仓库构建；可复制运行的单位是构建后的 Skill 目录。

## 验证

2026-10-08 本地验收结果：

| 层级 | 结果 |
| --- | --- |
| 类型与构建 | `pnpm lint`、TypeScript 编译及 14 个独立入口构建通过 |
| 业务集成 | 19 项本机 HTTP、文件和认证组合用例通过 |
| 独立运行 | 跨进程集成：14 个 Skill 分别复制到隔离目录，仅提供清单声明的第三方依赖；全部入口可启动，校园信息结果与统一 CLI 一致 |
| 统一认证与账号 | 云盘和邮箱独立进程读取相同测试账号；云盘退出状态按统一格式落盘；认证辅助脚本可从复制目录加载 |
| MCP | 12 个业务 Skill 独立 stdio 服务的工具定义合计 54 个，与统一 MCP 完整一致，全部为只读 |
| 安装产物 | 单独复制的云盘 Skill 安装依赖后显示全部 37 个命令；实际 tarball 临时安装成功，统一 CLI 及 14 个 Skill 注册通过 |
| Skill 文档 | 14 个 frontmatter 校验通过，局部文件链接检查通过 |

学校接口的实网范围见各 Skill 的接口记录。
