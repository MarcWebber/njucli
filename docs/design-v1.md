# NjuCLI V1 设计与实现

状态：首版已实现
更新日期：2026-09-04

## 结论

V1 已经从设计进入可运行实现。当前交付聚焦六类直接有用的能力：账号与认证、校园公开信息、个人课表、图书馆、体育场馆，以及供人和 AI 共用的聚合读取。没有真实远端契约的域暂不注册空壳命令。

实现坚持三条边界：

- 每个 leaf command 在注册时绑定一个 use case；没有巨型 `if/else` 动作入口，也不根据失败结果猜测备用接口。
- 登录统一由一个 `AuthCoordinator` 管理。EHall、课表、体育、WebVPN 与 OPAC 是 SSO 根会话的能力节点，不是多套账号 Provider。
- 写动作不伪造成功。没有完整远端契约和 readback 的写能力不注册命令；自动验证码、抢占资源和未经验证的远端提交不进入 V1。

## 已实现命令

二进制名和 npm 包名均为 `njucli`。命令结构固定为 `njucli <domain> <command> [target] [options]`；顶层 `today`、`doctor` 和 `mcp` 是三个明确的独立入口。

```text
njucli
├── account
│   ├── current
│   ├── list
│   ├── add <name>
│   ├── use <name>
│   └── remove <name> --yes
├── auth
│   ├── status [capability]
│   ├── login [capability]
│   ├── refresh [capability]
│   └── logout [capability]
├── campus
│   ├── sources
│   ├── articles --source <source> --section <section> [--page <n>]
│   └── article <article-id> --source <source> --section <section>
├── course
│   ├── terms
│   ├── current-term
│   ├── schedule [--term <term-id>]
│   ├── today [date] [--term <term-id>]
│   ├── week [date] [--term <term-id>]
│   ├── next [--term <term-id>]
│   └── export <path> [--term <term-id>]
├── library
│   ├── search <query> [--field <field>] [--page <n>] [--page-size <n>]
│   ├── book <book-id>
│   ├── holdings <book-id>
│   └── loans [--page <n>] [--page-size <n>]
├── sports
│   ├── venues [--sport-id <id>]
│   ├── venue <venue-site-id>
│   ├── slots --venue-site <venue-site-id> --date <date>
│   ├── bookings [--page <n>] [--size <n>]
│   └── booking <booking-id>
├── today [date]
├── doctor
└── mcp
```

每个普通 leaf command 支持 `--format text|json`；也可以用进程级 `NJUCLI_FORMAT=json`。`njucli mcp` 启动 stdio server，标准输出属于 MCP 协议，因此不提供 `--format`。根级只保留 Commander 的帮助和版本；没有 `--json`、`--profile`、`--account` 或用 flag 选择动作的入口。

日期接受 `YYYY-MM-DD`、`today` 和 `tomorrow`，统一按 `Asia/Shanghai` 解释。查询词与稳定 ID 使用位置参数；`--source`、`--section`、`--term`、`--date`、分页和输出格式只做筛选或修饰。

## 执行模型

```text
CLI / MCP
  -> leaf 参数校验
  -> NjuServices use case
  -> 认证与安全门禁
  -> 唯一远端 client
  -> Zod/HTML contract parser
  -> 稳定领域 DTO
  -> text / JSON / MCP renderer
```

`src/app/services.ts` 是 CLI 与 MCP 的共同边界，`src/app/production.ts` 完成生产依赖装配。课程、图书馆和体育分别只有一个远端 client：`EHallTimetableClient`、`NjuOpacClient` 和 `SportsClient`。公共网站也只通过静态 `source + section` 表选择一个 parser；不存在运行时 adapter 轮询。

错误不会触发跨站 fallback。远端字段不符合固定契约时返回 `REMOTE_SCHEMA_CHANGED`；认证、VPN、速率限制和交互需求分别使用稳定错误码，不用空数组掩盖失败。

## 账号与认证

### 账号隔离

首次使用时按需创建 `default` account。多账号只通过 `account add/use/current/list/remove` 管理；业务命令始终使用当前账号。`NJUCLI_ACCOUNT=<name>` 可以在进程启动时固定账号，名称不存在时立即失败，不回退到当前账号。

每个 account 有独立的配置、会话元数据和 Playwright persistent browser context。NjuCLI 不读取 Chrome 或 Safari 中现有的 Cookie，也不接收 `--password <value>`。

### 会话图

当前生产装配注册六个 capability：

```text
SSO 根会话
├── ehall
│   └── timetable
├── sports
└── vpn
    └── opac
```

认证类型只包含图中六个已装配节点，不为尚未实现的课程独立登录或邮箱预留空 capability。业务域 `course` 固定复用 `timetable` 会话。

`auth login` 省略 capability 时只建立 SSO 根会话。指定 `timetable`、`sports` 或 `opac` 时，协调器按静态依赖图先建立或刷新父会话，再执行唯一的派生 driver。清除父会话时会同时清除依赖它的已配置子会话。

SSO 与 WebVPN 登录使用学校真实页面和隔离浏览器上下文，用户可以选择页面当前提供的密码、扫码、短信或 FIDO 方式。CLI 只观察落地结果，不读取输入字段。体育的一次性 `oauth_token` 用于交换业务 access token；access token 只在当前命令执行期间使用，不持久化。

### 在线探测与刷新

会话元数据只记录 capability、状态和 `refreshAfter`。当前保守刷新窗口为 15 分钟：

- `auth status [capability]` 做在线探测，而不是只检查本地文件。
- 读命令发现会话过旧时，由该 capability 的唯一 driver 机会式刷新；缺少或已过期时返回带恢复命令的认证错误，不自行弹出登录窗口。
- `auth refresh` 省略 capability 时刷新 SSO 及已使用的 SSO 后代；指定 capability 时只处理该节点及必要依赖。
- `auth logout` 省略 capability 时清除当前 account 的全部已配置会话。

## 校园公开信息

`campus` 已实现八个固定信息源：

```text
nju
academic-affairs
graduate-school
graduate-admission
itsc
youth-league
research
asset-management
```

`campus sources` 返回 source、可用 section 和基地址；`articles` 与 `article` 必须显式给出 source 和 section。每个组合只绑定一个 allowlisted host 和一套确定性 selector。列表中的跨站文章链接会被跳过，不会由当前 source parser 跟随抓取。

八个列表 parser 已通过公开页面 smoke 获得非空结果；其中团委来源在当前网络被识别为 `VPN_REQUIRED`。默认 CI 使用本地 HTML fixtures，不依赖生产网站稳定性。

## 个人课表

课程模块当前只实现 EHall 本科 `jwapp` 契约 `nju-ehall-wdkb-v1`，没有注册研究生 `gsapp` parser，也不会先试本科再试研究生。固定请求序列包括 EHall 应用落地、角色切换、学期列表、当前学期、学期开始日期和结构化个人课表。

远端的 `KSJC`、`JSJC`、`SKXQ`、`SKZC` 被映射为节次、星期和具体教学周，再结合学期开始日期展开为自然日 occurrence。当前 1–13 节钟点映射已固化并有单元测试；仍需用当前学期官方作息实网复核。缺少学期开始日期、节次越界或响应结构改变都会明确失败。

已实现：

- `terms`、`current-term` 和整学期 `schedule`。
- 指定日期的 `today`、所在自然周的 `week`、当前时间之后的 `next`。
- 从同一稳定 DTO 导出包含 `Asia/Shanghai` 时间的 ICS。

## 图书馆

图书馆模块实现一个现代汇文 `meta-local` client，契约名为 `nju-huiwen-meta-local-v1`：

- 按全字段、题名、作者、ISBN 或索书号检索。
- 查询书目详情与复本馆藏，保留馆藏地、索书号、架位标记、状态和是否可借。
- 查询当前读者借阅，保留题名、应还日和逾期状态。

这份字段契约已由同产品族公开部署的真实响应和本仓库脱敏 fixtures 验证；由于 `opac.nju.edu.cn` 在当前网络返回“请使用南大 VPN 访问”，南大部署本身尚未完成校园网/WebVPN 实网 smoke。生产装配通过 `vpn -> opac` 会话链访问 WebVPN 包装后的 OPAC；契约不匹配时不会改用第三方书目数据。

续借和预约馆藏的 endpoint、资格校验与 readback 尚未验证，因此 MVP 不注册 `renew` 或 `reserve` 命令。

## 体育场馆

体育模块实现单一 `SportsClient`，覆盖：

- 场馆与具体 venue site 列表和详情。
- 按 venue site 与日期读取各场地、各时间片状态；文本输出按 space 状态即时统计余量。
- 我的预约分页列表与单条预约详情。
- CAS 落地 `oauth_token` 到业务 access token 的交换、角色选择与已验证签名规则。

预约、支付和取消场地仍缺少完整的验证码与 readback 契约，因此 MVP 不注册 `sports book` 或 `sports cancel` 命令。

只读接口、解析器、签名和确认门禁都有 fixtures/单元测试；真实 NJU 账号的角色、token 生命周期、实时余量和订单状态仍需真人登录 smoke。

## 聚合与诊断

顶层 `today [date]` 依次读取当天课表、读者借阅和体育预约。三个来源分别返回 `{ ok, data }` 或 `{ ok: false, error }`，单源失败不会被改成空数组，也不会阻止其他来源返回。V1 尚未实现 EHall 待办，因此聚合结果没有伪造 `ehall` 字段。

`doctor` 当前检查正在使用的 account、可用认证 capability、南京大学官网连通性和 OPAC 直连网络门禁。它不是完整业务验收：成功只说明探测项通过，不代表课表、馆藏和体育三条授权链路均有非空数据。

## MCP

`njucli mcp` 启动 stdio MCP server。当前工具为 `course_today`、`course_week`、`course_next`、`library_search`、`library_holdings`、`sports_venues`、`sports_slots`、`campus_articles` 和 `nju_today`；结果直接使用 `NjuServices` 的领域 DTO。

MCP 不开放 mutation，也不实现另一套 HTTP client、认证或 fallback。认证缺失、VPN 门禁和 schema drift 与 CLI 返回同一类稳定错误。

## 输出与错误

JSON 使用固定 envelope：

```json
{
  "ok": true,
  "data": []
}
```

失败时 stdout 在 JSON 模式下仍是单个可解析对象；文本模式把错误和提示写到 stderr：

```json
{
  "ok": false,
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "课表会话未登录或已经失效",
    "hint": "运行 njucli auth login timetable",
    "auth_command": "njucli auth login timetable"
  }
}
```

当前核心错误包括 `INVALID_INPUT`、`NOT_FOUND`、`AUTH_REQUIRED`、`AUTH_EXPIRED`、`AUTH_REFRESH_FAILED`、`AUTH_CAPABILITY_UNKNOWN`、`VPN_REQUIRED`、`CONFIRMATION_REQUIRED`、`USER_ACTION_REQUIRED`、`REMOTE_UNAVAILABLE`、`REMOTE_SCHEMA_CHANGED` 和 `RATE_LIMITED`。日志和结构化详情在输出前经过 Cookie、JWT、ticket、密码、验证码和身份字段脱敏。

## 测试与验收

默认回归套件已经覆盖：

- account 的创建、切换、环境变量固定与隔离路径。
- capability 依赖图、登录/状态/刷新/退出、刷新窗口和 persistent browser session。
- Cookie 共享边界、敏感信息脱敏、日期、输出 envelope 与确认门禁。
- 八个校园信息源的列表/详情 fixture、空数据、schema drift、外链省略和 VPN 映射。
- 课表学期、结构化排课、周次展开、today/week/next、13 节钟点和 ICS。
- 汇文 search/book/holdings/loans contract、位置字段和 403 VPN 映射。
- 体育请求签名、场馆、场地、时间片余量、预约详情和 schema drift。
- CLI 命令路由、帮助/JSON 输出，以及 MCP 只读工具与共享 service 边界。

本地验收命令：

```bash
pnpm lint
pnpm test
pnpm build
```

mock、fixture 或编译通过不等于生产实网可用。V1 的最终授权验收仍需在合适网络和测试账号下逐项完成：

1. SSO 登录后验证 EHall、timetable、sports、WebVPN 和 OPAC 的真实派生关系及 15 分钟 refresh 行为。
2. 本科课表返回非空 occurrence，并与当前学期页面逐字段核对日期、节次、教师和地点。
3. 体育返回真实场馆、具体场地和余量，并核对角色选择、token 生命周期和预约详情。
4. OPAC 在校园网或 WebVPN 下完成 search、book、holdings 和 loans smoke，确认南大部署与已实现的汇文契约一致。
5. library/sports 写接口在契约、脱敏 fixture 和 readback 方案齐备之前不注册命令。

## 后续范围

V1 没有注册 EHall 待办/流程、成绩与培养方案、研究生课表/选课、交换项目和邮件命令。这些能力只有在获得固定远端契约、认证边界和脱敏 fixtures 后才会加入；不会提前创建空命令、第二套 adapter 或动态插件系统。

明确不做：抢课、绕过验证码/VPN/访问频率、在线支付、校园卡充值、修改密码、静默复制用户浏览器 Cookie，以及任意办事表单的自动填写和提交。
