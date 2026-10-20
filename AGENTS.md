# NjuCLI 开发指南

## 目标与架构

NjuCLI 服务南京大学学生及其 AI 助手，围绕写作、邮件、上课、作业、选课、借书和运动完成具体任务。功能定义以学生使用场景和真实远端契约为依据。

运行环境为 Node.js 20+，依赖使用 `package.json` 锁定的 pnpm 版本。源码采用 TypeScript strict，并开启 `noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noUnusedLocals` 和 `noUnusedParameters`。

| 路径 | 职责 |
| --- | --- |
| `src/cli.ts` | 进程入口 |
| `src/commands/` | 全包升级命令 |
| `src/app/production.ts` | 集中装配业务实例、CLI 命令与 MCP 工具 |
| `src/account/` | 本地账号及隔离目录 |
| `src/auth/` | SSO 登录、凭据、公共浏览器与会话机制 |
| `skills/<任务>/scripts/` | 所属业务的 client、命令、展示、服务、MCP 定义 |
| `src/core/` | 文件、输入、日期、输出与脱敏函数 |
| `src/mcp/` | 只读 MCP 协议与输出处理 |
| `tests/` | 真实本地进程、文件锁与 CLI 安装产物检查 |
| `skills/SKILL.md`、`skills/<任务>/guide.md`、`references/` | 使用说明；较长流程和接口资料按需拆入 references |
| `.codex-plugin/`、`.mcp.json` | 插件清单与本地 MCP 配置 |
| `docs/` | AI 接入与接口契约、验证范围 |

业务能力与使用入口见 [套件入口](skills/SKILL.md)，源码与说明随所属 Skill 维护。跨业务组合通过已有服务显式传入。

调用关系为：`njucli` CLI / MCP 入口 → Skill 的业务方法 → 远端请求；受保护操作复用同一次调用的认证会话。参数处理归入口，远端请求归 client，展示归 CLI/MCP 输出边界。

## 实现约定

- 功能性优先，采用完成当前任务的最简单实现。业务代码和资料按 Skill 归属；外层只保留统一认证、实际共用工具、安装构建和入口装配。解析和小型返回结构就近定义。
- 简单业务以 `client.ts` 和 `commands.ts` 组织：client 包含请求与简短会话包装，commands 包含输入校验、CLI 和只读 MCP。文件按独立职责或实际复用拆分。
- 统一入口在 `src/app/production.ts` 的同一次 `mount` 调用中关联业务实例、CLI 和 MCP。业务复用公共 SSO 会话，站点跳转、令牌交换、CSRF 与响应校验随所属 Skill 维护。
- 每个动作绑定一个明确业务方法，每份远端契约对应一个 client 和一条请求路径。
- 直接复用已有函数与 client 方法类型。共享工具以实际重复调用、相同语义为依据；单实现存储直接使用具体类。删除无调用代码、冗余字段、透传包装和重复注册表。
- Adapter、Provider 及等价中间层的引入以维护者明确要求为前提。
- 安装、依赖和升级由根包统一维护，全局 Skills 以一个 `njucli` 套件安装，`skills/SKILL.md` 提供业务索引。命令保持 `njucli <domain> <command> [target] [options]`。JSON 使用具体动作的 `--format json` 或 `NJUCLI_FORMAT=json`；账号通过 `account use` 或 `NJUCLI_ACCOUNT` 选择。
- 分页和枚举在 CLI/MCP 入口校验一次；日期在输入或进入日历计算时校验；接口限制以远端契约为准。
- 按已验证的接口字段解析响应。字段、请求方法或路径有变更时，同步更新所属 Skill 的接口说明；索引见 `docs/interface-evidence.md`。
- 网络、HTTP 和解析错误交由统一输出层报告，后续处理由调用 Agent 决定。操作完成并通过必要回读后，再返回成功。
- 下载和导出统一使用 `core/fs.ts` 的 `saveFile`，将文本、字节或字节流覆盖写入指定文件。新文件权限设为 0600，已有文件沿用原权限；会话配置采用原子写入。
- 面向用户的文档使用中文、正向描述，聚焦已有能力、使用前提、实际步骤和结果。接口证据与实网验证状态各自明确记录。

## 通用工具

| 工具 | 用途与调用方 |
| --- | --- |
| `BrowserSession.login / completeLogin` | 打开官方登录入口、等待账号/验证码/扫码认证完成；SSO、selection、SE、WebVPN、TeX 复用 |
| `AuthCoordinator.ensureSession` | 业务前检查与恢复目标会话，供读写业务共同调用 |
| `SessionStore` | 保存 capability 和 valid/expired/logged-out 状态 |
| `core/guards.ts` 的 `requiredText` | TeX、SE、图书馆共用文本整理与空值检查 |
| `core/fs.ts` | 文件保存与会话 JSON 读写 |
| `core/command.ts`、`core/output.ts` | 参数输出格式、统一结果和退出码 |
| `core/redaction.ts` | 输出边界的凭据脱敏 |

公共 SSO 登录与共享会话机制集中在 `src/auth/`；业务站点的会话交接、校验、签名与响应解析归所属 Skill。业务前通过共享运行环境调用同一 `AuthCoordinator`。

## 开发流程

1. 确认工作目录、Git 状态与现有命令，保留用户已有修改；明确学生任务、输出和授权范围。
2. 新增或修改远端能力时，先用真实请求打通认证、业务接口和结果，再收敛实现；完成后用实际 CLI 或 MCP 执行对应业务验证。仅查看接口说明、扫描前端代码或访问登录页，不构成业务验证。纯重构依据已有真实契约，并验证受影响的调用。
3. 将确认的请求路径收敛至所属 Skill 的 client，完成命令和 MCP，在 `src/app/production.ts` 注册业务；站点会话交接在所属 Skill 中复用公共 SSO 与浏览器会话。验证完成后移除临时请求代码；长期复用的辅助脚本随对应 Skill 保存。
4. 执行受影响的本地运行检查，清理重复实现与失效结构。
5. 将确认的任务流程整理到所属 `guide.md`。简短能力直接写在入口文档；仅将较长流程、参数表和接口资料拆入 `references/`。检查套件 frontmatter、链接和脚本。
6. 同步 README 和所属 Skill 的操作说明、接口契约与验证范围。构建与安装说明见 [贡献指南](CONTRIBUTING.md#实现约定)。
7. 检查安装产物。涉及远端能力的代码通过真实请求验证后，才可提交、推送和提 PR；待验证或调用失败的能力先开展真实请求排查并修复；只有确认无法实现时才移除。新增或修改的实现完成真实业务验证后提交。每个 PR 必须链接对应验证报告，记录执行入口、参数、实际结果及必要回读，并附可取得的 Agent 命令日志或截图；证据须脱敏。

## 测试流程

禁止使用模拟数据、mock/stub、伪造的接口响应和本地替身服务。当前没有测试账号；个人账号仅用于用户当次明确授权的实际业务或实网验证。写操作须有明确的真实业务目标与材料。

自动检查使用 Node 内置 `node:test`，直接运行真实子进程、文件系统操作和构建产物。临时目录仅用于运行隔离并在结束后清理。校园业务以真实接口响应和实际业务结果验证，浏览器与 IMAP 随用户授权的实际业务操作核对。

```bash
pnpm lint
pnpm test
npm pack --dry-run
```

`pnpm test` 先构建，再检查真实子进程的文件锁互斥与释放，以及实际安装后的统一 CLI。

安装用例将实际 tarball 安装到临时全局目录，通过 PATH 中的 `njucli` 核对各业务帮助、公开目录、模板和 MCP 查询，并检查全局套件的注册路径。

源码/构建、本地运行检查、公开实网、认证实网分别记录。实网里程碑以对应 CLI 的真实结果与后置条件为依据；实网核对按当轮任务和授权范围进行。

## 上线步骤

1. 同步版本、README、Skill 与接口说明，核对命令接线和实际功能。
2. 在 Node.js 20+ 下运行 `pnpm install --frozen-lockfile`、`pnpm lint`、`pnpm test`。构建先清理 `dist`，再编译源码、复制模板并生成统一 CLI 入口。
3. 核对编译产物的帮助与 `campus sources --format json`，按证据填写版本说明。
4. 用 `npm pack --dry-run` 检查清单，再把实际 tarball 安装到临时目录核对 `njucli --help`。
5. 公开推送前检查源码、文档及历史中的个人信息与凭据。远程仓库、npm、Git tag 和 release 按各自明确授权执行。
6. 发布后从目标渠道重新安装，核对版本、入口和对应任务结果。

## Code Review Rules

每次评审（包括自评审）开始前，所有评审者须先阅读并遵循根目录的 [REVIEW_RULES.md](REVIEW_RULES.md)。该规则适用于人工评审及任何模型、工具，统一覆盖模块划分、代码简洁性、文档归属、认证会话和个人数据边界。
