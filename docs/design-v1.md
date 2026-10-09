# NjuCLI 设计与实现

NjuCLI 为南京大学学生和 AI 助手提供校园服务。每个 Skill 携带业务脚本和资料，CLI 与 MCP 调用同一份实现；认证集中管理。

## 代码组织

| 路径 | 职责 |
| --- | --- |
| `skills/njucli-*/scripts/` | 本业务的 client、命令、展示、业务方法、MCP 定义和独立入口 |
| `skills/njucli-*/SKILL.md`、`references/` | 入口说明及按需拆分的长流程、接口资料 |
| `src/auth/` | 凭据、站点登录、会话探测与恢复 |
| `src/account/` | 账号选择、配置目录和身份隔离 |
| `src/core/` | 文件、日期、输入、输出与脱敏等共用函数 |
| `src/app/` | 共用运行环境和统一业务装配 |
| `src/commands/`、`src/mcp/` | 统一入口和协议处理 |
| `scripts/` | 构建、安装与 Skill 注册 |

```text
CLI / Skill / MCP
  → 参数校验
  → Skill 业务方法
  → 共享认证与当前会话
  → 本业务 client
  → 文本 / JSON / MCP 输出
```

一个远端契约由一个 client 实现。CLI 与 MCP 校验输入，业务方法组合请求，client 处理远端字段，输出层负责展示和脱敏。写入提交一次，并回读指定目标；普通请求失败直接返回。

Skill 的 `run.ts` 在构建时生成 `run.mjs`，共享模块打入入口，第三方依赖写入本 Skill 的 `package.json`。构建后的 Skill 目录可单独复制使用。目录选择、构建和安装步骤见 [Skill 组织说明](skill-layout.md)。

## 已实现能力

命令采用 `njucli <domain> <command> [target] [options]`，具体参数以 `njucli <domain> --help` 和各 Skill 为准。

| 入口 | 能力 | 说明 |
| --- | --- | --- |
| `auth`、`account` | 登录、会话维护、状态、退出和多账号管理 | [认证 Skill](../skills/njucli-auth/SKILL.md) |
| `youth` | 青年平台活动、志愿时长、第二课堂与报名 | [青年平台 Skill](../skills/njucli-youth/SKILL.md) |
| `table` | 协同表格、模板、记录、公式与视图 | [协同表格 Skill](../skills/njucli-table/SKILL.md) |
| `box` | 资料库、扫描搜索、上传下载、分享与上传链接、复制移动、收藏锁定、历史恢复和协作权限 | [云盘 Skill](../skills/njucli-box/SKILL.md) |
| `campus` | 食堂、新闻、通知、文章正文与今日汇总 | [校园信息 Skill](../skills/njucli-campus/SKILL.md) |
| `software` | 官方软件目录、安装包查询与下载 | [软件 Skill](../skills/njucli-software/SKILL.md) |
| `ehall` | 课表、选退课、成绩、考试、培养方案、待办、办件与行程登记 | [办事大厅 Skill](../skills/njucli-ehall/SKILL.md) |
| `library` | 书目搜索、详情、馆藏与借阅 | [图书馆 Skill](../skills/njucli-library/SKILL.md) |
| `sports` | 场馆、时段、预约记录及官方办理入口 | [体育 Skill](../skills/njucli-sports/SKILL.md) |
| `se` | 课程、名单、作业、附件、成绩及自助选课 | [SE Skill](../skills/njucli-se/SKILL.md) |
| `tex` | 项目、模板、正文编辑、文件上传、编译、PDF 与源码下载 | [TeX Skill](../skills/njucli-tex/SKILL.md) |
| `mail` | 多邮箱绑定、邮件夹、列表、搜索、正文和附件 | [邮箱 Skill](../skills/njucli-mail/SKILL.md) |

`ehall schedule` 提供可按日期查询和导出 ICS 的课表；`ehall graduate-schedule` 读取研究生课表。两个接口分别由对应 client 处理。`campus today` 汇总当天课表、借阅与体育预约。

`mcp` 提供 91 个只读 stdio 工具；支持 MCP 的独立 Skill 也可单独启动本业务工具。文件下载和远端写入由具备终端能力的宿主调用 CLI。配置见 [AI 接入](ai-plugin.md)。

## 账号与认证

`src/auth/create.ts` 装配站点登录逻辑，`AuthCoordinator.ensureSession` 在业务前检查和恢复会话。认证与业务共用当前账号的浏览器 context，各 Skill 复用同一份认证源码。

```text
sso
├── ehall → timetable
├── se
├── tex
├── sports
├── youth
├── table
└── vpn → opac

selection、box：独立站点会话
```

`account use` 设置默认账号，`NJUCLI_ACCOUNT` 指定当前进程的账号。配置默认位于 `~/.config/njucli/accounts/<account>/`，可通过 `XDG_CONFIG_HOME` 修改根目录。

| 文件 | 内容 |
| --- | --- |
| `auth.json` | 统一认证账号与密码 |
| `mail.json` | 已绑定邮箱及当前邮箱 |
| `ehall.json` | 按本人身份保存的联系方式与住宿资料 |
| `session-cookies.json` | 会话型与持久 Cookie |

配置以 0600 权限原子保存。同一账号在读取 Cookie 前取得进程锁，保存后释放。查询使用 HTTP 会话，页面操作按需打开专用 Chrome 并继承当前 Cookie。SSO 登录与 `auth maintain` 通过 CAS 为 EHall `/login?service=...` 取得服务票据，跳转至官方门户后回读用户接口的 `hasLogin`；过期时用已存凭据恢复。维护每次执行一次，周期执行间隔依据实际闲置期限设置，最长有效期由学校决定。登录凭据可通过 `--credentials` 导入，网站要求的交互在官方页面完成；详细步骤见 [认证说明](../skills/njucli-auth/SKILL.md)。

`auth daemon start/status/stop` 管理常驻的 CLI 后台进程。启动时固定本地账号、配置根目录、Node 和当前 CLI/Skill 的绝对入口，macOS launchd 以 `RunAtLoad` 启动 `auth daemon run`，并按 `KeepAlive.Crashed` 恢复崩溃进程。CLI 在同一进程内串行调用维护业务，默认每轮结束后等待 600 秒，每轮维护结束后释放账号锁。普通网络失败交给下个周期处理；学校拒绝凭据、缺少凭据或要求本人操作时结束进程，由用户处理后重启。进程记录、配置和日志权限为 0600，日志使用统一脱敏输出。状态展示进程 PID、启动注册情况与最近维护结果；停止信号结束等待或等待当前维护完成，再清理进程记录并退出，launchd 同时卸载启动配置。

## 输出与文件

普通命令支持 `--format text|json`，也可设置 `NJUCLI_FORMAT=json`。JSON 结果为 `{ "ok": true, "data": ... }`，失败为 `{ "ok": false, "error": ... }`。凭据和认证参数在统一输出边界脱敏。MCP 的标准输出专用于协议。

日期使用 `Asia/Shanghai`，接受 `YYYY-MM-DD`、`today` 和 `tomorrow`。下载与导出统一调用 `saveFile` 覆盖指定输出文件；新文件权限为 0600，已有文件保留权限。邮件通过 IMAP `EXAMINE` 和 `BODY.PEEK` 读取，保持已读状态。

## 全局安装与升级

安装脚本从仓库 `main` 构建并安装 CLI，同时注册 12 个 Skill。`njucli upgrade` 使用同一流程，保留当前全局安装前缀。

| 配置 | 用途 |
| --- | --- |
| `NJUCLI_INSTALL_PREFIX` | CLI 安装前缀，其 `bin` 需在 PATH 中 |
| `CODEX_HOME` | Codex 配置根目录，Skill 默认安装到其中的 `skills/` |
| `NJUCLI_SKILLS_DIR` | 指定 Skill 安装目录，优先于 `CODEX_HOME` |

源码开发安装只安装依赖。安装步骤见 [README](../README.md#安装)。

## 验证与验收

```bash
pnpm lint
pnpm test
node dist/cli.js --help
node dist/cli.js campus sources --format json
npm pack --dry-run
```

`pnpm test` 先构建，再运行本地集成。用例使用本机 HTTP、临时文件和模拟 IMAP；独立 Skill 用例检查复制后的运行、账号共享和 MCP 工具一致性。安装产物另在临时目录核对，检查范围见 [Skill 组织说明](skill-layout.md#验证)。

## 验收里程碑

### 验收记录

下表汇总已完成的实网核对。具体接口保存在[各 Skill 的接口说明](interface-evidence.md)。

| 能力 | 已验证 | 待验证或待实现 |
| --- | --- | --- |
| 认证 | SSO、TeX、SE、青年平台已有会话通过 HTTP 跨进程读取；`auth maintain` 返回 `kept-alive/valid` | 自然失效后的后台恢复与跨期限持续性 |
| 校园信息与软件 | 新闻列表与正文、食堂、软件目录及安装包下载 | 其余来源逐项核对 |
| 教务与选课 | 研究生成绩、可选课程、已选课程读取 | 本科日期课表与 ICS；研究生考试、课表与培养方案；真实选退课 |
| 行程登记 | 查询与一次单站离返校登记提交、回读 | 全程留校、多次离返校与多站行程写入 |
| SE | 课程目录、课程名单和已加入课程读取 | 作业附件落地、自助选课；作业上传待实现 |
| TeX | 项目创建、模板复制、改名、正文编辑、新文件上传、源码下载、编译、PDF 和日志；编译失败时阻止旧 PDF 下载 | 同名上传替换 |
| 邮箱 | 两个邮箱独立绑定、切换、邮件夹、分页、搜索和正文读取，已读状态保持 | 真实附件下载 |
| 云盘 | 资料库、扫描、已有分享、文件下载和内部链接；其他查询接口可读取 | 上传、创建分享、复制移动及其他管理写入 |
| 青年平台 | 志愿时长、活动及各模块列表与详情；成绩单 PDF 下载 | 报名、取消、评价及培训写入 |
| 协同表格 | 模板查询与复制、建表、工作表与字段、视图、行新增和修改 | 群组工作区写入、其他复杂字段及模板内应用复制 |
| 图书馆 | 本地接口集成 | 南大校园网或 WebVPN 下的馆藏与借阅；续借、预约待实现 |
| 体育 | 本地接口集成 | 登录后场馆、时段与预约读取；预约、取消提交待实现 |

实网写入验收使用用户指定的目标和材料。查询结果、个人文件和凭据保存在本地指定位置。
