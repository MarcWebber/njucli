# NjuCLI 开发指南

## 目标与架构

NjuCLI 服务南京大学学生及其 AI 助手，围绕写作、邮件、上课、作业、选课、借书和运动完成具体任务。功能定义以学生使用场景和真实远端契约为依据。

运行环境为 Node.js 20+，依赖使用 `package.json` 锁定的 pnpm 版本。源码采用 TypeScript strict，并开启 `noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noUnusedLocals` 和 `noUnusedParameters`。

| 路径 | 职责 |
| --- | --- |
| `src/cli.ts` | 进程入口 |
| `src/commands/` | 统一 CLI 装配与全包升级 |
| `src/app/production.ts` | 统一 CLI 装配及推导业务类型；各 Skill 有独立入口 |
| `src/account/` | 本地账号及隔离目录 |
| `src/auth/` | 统一认证命令、凭据、全部站点 driver、浏览器交接及会话恢复 |
| `skills/<任务>/scripts/` | 所属业务的 client、命令、展示、服务、MCP 定义及独立入口 |
| `src/core/` | 文件、输入、日期、输出与脱敏函数 |
| `src/mcp/` | 只读 MCP，调用相同业务方法 |
| `tests/` | 业务组合与独立 Skill 的少量本地集成测试 |
| `skills/<任务>/SKILL.md`、`references/` | 使用说明；较长流程和接口资料按需拆入 references |
| `.codex-plugin/`、`.mcp.json` | 插件清单与本地 MCP 配置 |
| `docs/` | AI 接入与接口契约、验证范围 |

现有 14 个 Skill：auth、campus、ehall、library、sports、se、tex、mail、software、box、youth、table、itxia、institution。教务、课表、选课和办事大厅统一归 `njucli-ehall`；`campus today` 组合课表、借阅和预约。IT 侠使用访客预约接口，按预约单编号或姓名、手机号查询。机构知识使用公开来源，教师为 `institution` 子命令；本地快照、实时读取和 Markdown 导出共用来源与采集时间。

调用关系为：统一 CLI 或独立 Skill 入口 → Skill 的业务方法 → 同目录 client；受保护操作复用同一次调用的认证会话。参数处理归入口，远端请求归 client，展示归 CLI/MCP 输出边界。

## 实现约定

- 功能性优先，采用完成当前任务的最简单实现。业务代码和资料按 Skill 归属；外层只保留统一认证、实际共用工具、安装构建和入口装配。解析和小型返回结构就近定义。
- 每个动作绑定一个明确业务方法，每份远端契约对应一个 client 和一条请求路径。
- 直接复用已有函数与 client 方法类型。共享工具以实际重复调用、相同语义为依据；单实现存储直接使用具体类。删除无调用代码、冗余字段、透传包装和重复注册表。
- Adapter、Provider 及等价中间层的引入以维护者明确要求为前提。
- 命令保持 `njucli <domain> <command> [target] [options]`。JSON 使用具体动作的 `--format json` 或 `NJUCLI_FORMAT=json`；账号通过 `account use` 或 `NJUCLI_ACCOUNT` 选择。
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

站点认证成功条件和登录恢复集中在 `src/auth/`；业务签名、字段与响应解析归所属 Skill。业务前通过共享运行环境调用同一 `AuthCoordinator`。

## 开发流程

1. 确认工作目录、Git 状态与现有命令，保留用户已有修改；明确学生任务、输出和授权范围。
2. 新能力先用临时最小脚本验证入口、认证、请求和响应，默认只读，记录脱敏证据。纯重构直接依据现有契约开展。
3. 将确认的请求路径收敛至所属 Skill 的 client，接入本 Skill 的命令、MCP 和统一生产装配。验证完成后移除临时请求代码；长期复用的辅助脚本随对应 Skill 保存。
4. 调整受影响的集成用例，执行本地检查，清理重复实现与失效结构。
5. 将确认的任务流程整理到所属 `SKILL.md`。简短能力直接写在入口文档；仅将较长流程、参数表和接口资料拆入 `references/`。检查 frontmatter、链接和脚本。
6. 同步 README 和所属 Skill 的操作说明、接口契约与验证范围。构建与独立运行说明见 [贡献指南](CONTRIBUTING.md#实现约定)。
7. 检查安装产物，按维护者授权提交、推送或发布。

## 测试流程

当前没有测试账号。开发验证使用合成数据和本地模拟服务；个人账号仅用于用户当次明确要求的实际业务操作，禁止用于测试、回归或试填。

自动测试限定为少量本地集成用例，使用 Node 内置 `node:test`。覆盖真实模块组合，测试数据就地构造，HTTP 指向本机模拟服务，文件放入临时目录并自动清理。真实浏览器与 IMAP 随用户授权的实际业务操作核对。

```bash
pnpm lint
pnpm test
node dist/cli.js --help
node dist/cli.js campus sources --format json
npm pack --dry-run
```

`pnpm test` 先构建，再验证认证与文件存储、校园信息命令与解析、软件目录与流式下载、TeX 命令与 HTTP client、邮箱绑定命令与页面交接。邮箱用例隔离浏览器和 IMAP，覆盖本地凭据、多邮箱切换、默认地址派生、MIME 正文与附件。新增用例沿用这种轻量集成方式。

独立 Skill 用例将各目录复制到临时位置，仅提供其声明的第三方依赖，核对命令、公共账号配置及业务入口的 MCP 工具。运行产物以 `scripts/run.mjs` 为入口；源码中的共享模块由构建打入，认证源码保持一份。

源码/构建、本地集成、公开实网、认证实网分别记录。实网里程碑以对应 CLI 的真实结果与后置条件为依据；实网核对按当轮任务和授权范围进行。

## 上线步骤

1. 同步版本、README、Skill 与接口说明，核对命令接线和实际功能。
2. 在 Node.js 20+ 下运行 `pnpm install --frozen-lockfile`、`pnpm lint`、`pnpm test`。构建先清理 `dist`，再编译源码并生成各 Skill 的 `scripts/run.mjs` 和依赖清单；认证辅助脚本使用同 Skill 的 `runtime.mjs`。
3. 核对编译产物的帮助与 `campus sources --format json`，按证据填写版本说明。
4. 用 `npm pack --dry-run` 检查清单，再把实际 tarball 安装到临时目录核对 `njucli --help`。
5. 公开推送前检查源码、文档及历史中的个人信息与凭据。远程仓库、npm、Git tag 和 release 按各自明确授权执行。
6. 发布后从目标渠道重新安装，核对版本、入口和对应任务结果。

## Code Review Rules

- 认证与业务必须复用同一次调用的会话；普通请求失败不得触发隐式的业务重试，尤其不能重复提交选课、上传或正文写入。
- 写操作的成功须包含指定目标的实际提交与必要回读；TeX 编译结果须关联本次 requestId 和日志，避免把旧 PDF 或旧成功状态当作本次结果。
- 核对个人数据边界：凭据和会话不进入源码、日志、PR 或打包产物；邮件读取保持已读状态，账号及邮箱切换不能混用其他身份的数据。
