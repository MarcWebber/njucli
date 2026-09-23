# NjuCLI V1 设计与实现

状态：实现与实网验收范围见下方里程碑
更新日期：2026-09-21

## 结论

V1 只服务学生及其 AI，优先上课、作业、选课、借书与运动。当前查询覆盖面已较广，但完整代办能力仍不足；不能用命令数量或入口链接代替实际任务完成。没有真实远端契约的能力不注册空壳命令。

实现坚持三条边界：

- 每个 leaf command 在注册时绑定一个 use case；没有巨型 `if/else` 动作入口，也不根据失败结果猜测备用接口。
- 浏览器登录由一个 `AuthCoordinator` 管理。EHall、课表、SoftSE、TeX、体育、WebVPN 与 OPAC 是 SSO 根会话的能力节点；研究生选课维护目标站点 session。邮箱直接使用官方 IMAP 和本机钥匙串，不依赖 SSO 或浏览器 Cookie。禁止引入 Adapter、Provider 或其换名中间层，除非维护者明确要求。
- 写动作不伪造成功。研究生选退课、SoftSE 自助选课和 TeX 写命令都要求显式确认、单次提交和结果回读；写验收只操作另行授权的可撤销目标。自动验证码、抢占资源和未经验证的远端提交不进入 V1。

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
│   ├── canteens [query]
│   ├── sources
│   ├── articles --source <source> --section <section> [--page <n>]
│   └── article <article-id> --source <source> --section <section>
├── course
│   ├── terms
│   ├── current-term
│   ├── available [query] [--kind plan|public] [--page <n>] [--page-size <n>]
│   ├── selected
│   ├── select <class-id> [--kind plan|public] --yes
│   ├── withdraw <class-id> --yes
│   ├── schedule [--term <term-id>]
│   ├── today [date] [--term <term-id>]
│   ├── week [date] [--term <term-id>]
│   ├── next [--term <term-id>]
│   └── export <path> [--term <term-id>]
├── academic
│   ├── grades [--term <term-id>]
│   ├── exams [--term <term-id>]
│   ├── schedule [--term <term-id>]
│   └── plan
├── ehall
│   ├── services [query]
│   ├── tasks [--kind todo|done|started] [--page <n>] [--page-size <n>]
│   ├── applications [--state active|completed|cancelled] [--page <n>] [--page-size <n>]
│   └── link <app-id>
├── library
│   ├── search <query> [--field <field>] [--page <n>] [--page-size <n>]
│   ├── book <book-id>
│   ├── holdings <book-id>
│   └── loans [--page <n>] [--page-size <n>]
├── sports
│   ├── venues [--sport-id <id>]
│   ├── venue <venue-site-id>
│   ├── slots --venue-site <venue-site-id> --date <date>
│   ├── reserve-link --venue-site <venue-site-id> --date <date>
│   ├── cancel-link <booking-id>
│   ├── bookings [--page <n>] [--size <n>]
│   └── booking <booking-id>
├── softse
│   ├── courses
│   ├── search <query> [--page <n>]
│   ├── course <course-id>
│   ├── assignments [course-id] [--pending]
│   ├── assignment <activity-id>
│   ├── download <activity-id> <file-name> --output <path> [--submitted]
│   ├── grades <course-id>
│   ├── enroll <course-id> --yes
│   └── submission-link <activity-id>
├── tex
│   ├── projects [query] [--page <n>]
│   ├── templates [--page <n>]
│   ├── create <name> --yes
│   ├── from-template <template-key> --yes
│   ├── rename <project-key> <name> --yes
│   ├── files <project-key> --version <version-no>
│   ├── read <project-key> <file-key> --version <version-no>
│   ├── write <project-key> <file-path> --version <version-no> --input <local-path> --yes
│   ├── upload <project-key> <local-file> --version <version-no> --yes
│   ├── compile <project-key> <file-path> --version <version-no> --output <path> --yes
│   ├── pdf <project-key> --version <version-no> --output <path>
│   ├── log <project-key> --version <version-no>
│   └── download <project-key> --version <version-no> --output <path>
├── mail
│   ├── bind
│   ├── status
│   ├── unbind --yes
│   ├── folders
│   ├── list [--unread] [--folder <path>] [--limit <n>] [--before <uid>]
│   ├── search <query> [--folder <path>] [--unread] [--limit <n>] [--before <uid>]
│   ├── read <id>
│   └── download <id> <attachment> --output <path>
├── today [date]
├── doctor
└── mcp
```

每个普通 leaf command 支持 `--format text|json`；也可以用进程级 `NJUCLI_FORMAT=json`。`njucli mcp` 启动 stdio server，标准输出属于 MCP 协议，因此不提供 `--format`。根级只保留 Commander 的帮助和版本；没有 `--json`、`--profile`、`--account` 或用 flag 选择动作的入口。

日期接受 `YYYY-MM-DD`、`today` 和 `tomorrow`，统一按 `Asia/Shanghai` 解释。查询词与稳定 ID 使用位置参数；`--source`、`--section`、`--term`、`--date`、分页和输出格式只做筛选或修饰。

分页与枚举只在 CLI/MCP 入口验证，不在 client 再验一次；每页条数不设没有远端证据的本地上限。日期在用户输入和学期数据进入计算时验证一次，周范围及日期展开不逐次重验。本地下载与导出共用 `saveFile`，替换指定输出文件；新文件权限为 0600，已有文件保留原权限。

## 执行模型

邮箱只有一个 `MailClient`：绑定先验证 IMAP 收件箱可读，再把邮箱地址与专用密码保存在当前本地账号对应的系统钥匙串条目中。`status` 只查看本机绑定，不代表服务端凭据当前有效；`unbind` 只清除本机条目，远端撤销仍在官方设置完成。没有配置文件中的明文密码，也不接收密码命令参数。

每次邮件查询新建一个 TLS 连接并在结束时关闭，不维护后台轮询。列表按 UID 倒序，返回 `nextBefore` 继续翻页；邮件 ID 包含邮箱地址、文件夹、UIDVALIDITY 和 UID，避免切换邮箱或邮件夹重建后读错邮件。正文与附件只按用户指定的单封邮件获取，MIME 解码使用 MailParser；当前会缓冲整封邮件，不是大型邮箱同步器。邮件内容是外部数据，不是对 Agent 的指令。只读 MCP 提供 folders/list/search/read，附件保存由 CLI 执行。

首次开启客户端服务和生成专用密码仍在学校网页完成。尚无已确认、可代替人工授权的生成密码接口；不注册自动生成或发送邮件命令。

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

`src/app/services.ts` 是 CLI 与 MCP 的共同边界，`src/app/production.ts` 完成生产依赖装配。每份远端契约只有一个 client：本科课表使用 `EHallTimetableClient`，研究生教务使用 `GraduateAcademicClient`，研究生选课使用 `GraduateCourseSelectionClient`，EHall 门户使用 `EHallPortalClient`，SoftSE 使用 `SoftSeClient`，TeX 使用 `TexClient`，图书馆使用 `NjuOpacClient`，体育使用 `SportsClient`。TeX 文本写入使用同一会话的官方编辑器辅助保存，读取和回读仍走同一 client，不另建 Provider 或协作协议实现。公共网站也只通过静态 `source + section` 表选择一个 parser；不存在运行时 adapter 轮询。

错误不会触发跨站 fallback。client 不包装普通网络、HTTP 或 JSON/Zod 解析异常，也不在失败后重试；CLI/MCP 只在最外层生成统一失败输出。认证、VPN、确认和交互需求保留明确错误码，方便调用 Agent 决定是否登录、换网络或停止。

## 账号与认证

交互登录复用 `BrowserSession.login` 和 `waitForLogin`：官方页面承载账号、验证码或扫码操作，CLI 统一等待成功落地。各站点保留自身成功条件；读写业务共同通过 `AuthCoordinator.ensureSession` 检查与恢复目标会话。

### 账号隔离

首次使用时按需创建 `default` account。多账号只通过 `account add/use/current/list/remove` 管理；业务命令始终使用当前账号。`NJUCLI_ACCOUNT=<name>` 可以在进程启动时固定账号，名称不存在时立即失败，不回退到当前账号。

每个 account 有独立的配置、会话元数据和 Playwright persistent browser context。CLI 自有会话型 Cookie 在 context 关闭前以 `0600` 权限原子写入该 account 配置目录的 `session-cookies.json`，再次启动时恢复；持久 Cookie 仍由 Chromium 浏览器目录维护，不修改服务端有效期。NjuCLI 不读取日常 Chrome 或 Safari 中现有的 Cookie，也不接收 `--password <value>`。

### 会话图

当前生产装配用静态类型表配置九个 capability，完整性由 TypeScript 检查；不做动态注册和重复注册检测。登录与探测直接返回布尔结果，只有落盘和输出时才组合为会话元数据：

```text
SSO 根会话
├── ehall
│   └── timetable
├── softse
├── tex
├── sports
└── vpn
    └── opac

selection（同一 account 浏览器目录中的选课站点会话）
```

SoftSE 通过站内 CAS 入口派生会话，因此是 `sso` 子节点；每次先读取 `/my/`，要求最终路径仍为 `/my/` 且页面含退出链接。已登录时直接使用；失效时访问唯一的 `/login/index.php?authCAS=CAS` 入口，再读取 `/my/` 验证恢复。`selection` 页面使用统一身份认证账号，但当前官方选课站没有暴露可直接复用的 CAS 跳转，而是自己的登录会话和验证码流程，因此它不声明为 SSO 子节点。两者都复用当前 account 的隔离浏览器目录，不增加账号 Provider，也不读取用户日常浏览器 Cookie。

`auth login` 省略 capability 时只建立 SSO 根会话。指定 `timetable`、`sports` 或 `opac` 时，协调器按静态依赖图先通过官方登录入口建立父会话，再执行唯一的派生 driver。退出父能力时会同时将依赖它的已配置子能力标记为 `logged-out`。

TeX 通过本站 `/oauth/login` 使用学校统一认证，依赖 `sso`。该站固定使用同一 CLI 专用可见 Chrome；每次先访问 `/console`，落在登录页时才进入 `/oauth/login`，最后通过 `/api/user/info` 确认会话。无头浏览器在当前实网返回安全校验 HTML，因此不作为运行路径，也不增加回退或复制日常浏览器 Cookie。

SSO、WebVPN 与选课登录都使用学校真实页面和隔离浏览器上下文。选课登录由用户在页面中输入统一身份认证账号并手动完成验证码；CLI 只验证选课 session 是否建立，不读取输入字段。体育的一次性 `oauth_token` 用于交换业务 access token；access token 只在当前命令执行期间使用，不持久化。

### 在线探测与刷新

会话元数据只记录 `capability` 与 `status`（`valid`、`expired`、`logged-out`），不缓存服务端有效期，也不按本地时间跳过认证：

- 每次受保护业务执行前，调用目标 capability 的唯一 `probe`，完成该站支持的恢复并记录实际结果。本地缺失或 expired 不阻止尝试，也不被父级的旧 metadata 拦截；明确认证失败先记录 expired，再返回登录提示。普通网络和解析错误直接报错。
- SSO 根探针直接访问带既定 EHall service 的 CAS 登录入口，核对最终落地，不把仅能访问 EHall 首页视为根会话有效。
- `auth status [capability]` 在线探测；主动退出的能力直接显示 `logged-out`，不恢复它。业务命令同样不会自动恢复 `logged-out`。
- `auth refresh <capability>` 显式尝试恢复该节点，包括 missing、expired 和主动退出状态；省略 capability 时只处理当前 account 已配置且未主动退出的能力。
- `auth logout` 省略 capability 时处理当前 account 的已配置能力，并始终执行 SSO 注销与 CLI 自有 Cookie 清理，即使尚无会话元数据。远端注销失败时仍执行本地清理和 `logged-out` 标记，再报告失败，不宣称远端已退出。

同一业务命令的认证与业务请求通过 `AsyncLocalStorage` 作用域共用一个 browser context，结束后统一保存并关闭；不增加连接池、后台常驻进程或定时保活。认证恢复在业务之前完成，业务请求不会因认证失败而重放。学校根会话失效或要求人工挑战时仍需官方登录，不能承诺永久免登录。

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

已有公开 smoke 记录覆盖七个可直连来源的非空列表和详情；团委来源返回 `VPN_REQUIRED`。

## 个人课表

`course schedule/today/week/next/export` 使用 EHall 本科 `jwapp` 契约 `nju-ehall-wdkb-v1`；研究生结构化课表由 `academic schedule` 提供，日期展开和 ICS 尚未接通。固定的本科请求链包括 EHall 应用落地、角色切换、学期信息与结构化课表，不跨本科和研究生接口补数。

远端的 `KSJC`、`JSJC`、`SKXQ`、`SKZC` 被映射为节次、星期和具体教学周，再结合学期开始日期展开为自然日 occurrence。当前 1–13 节钟点映射已经固化，但仍需用当前学期官方作息实网复核。缺少学期开始日期、节次越界或响应结构改变都会直接失败。

已实现：

- `terms`、`current-term` 和整学期 `schedule`。
- 指定日期的 `today`、所在自然周的 `week`、当前时间之后的 `next`。
- 从同一稳定 DTO 导出包含 `Asia/Shanghai` 时间的 ICS。

## 研究生选课

研究生选课使用 `yjsxk.nju.edu.cn` 当前页面公开的固定请求链路，不作为本科课表的 fallback。`course available` 只覆盖页面当前明确暴露的 `plan`（方案内）和 `public`（公选课/跨院系）两个范围，并固定带 `query_sfym=0` 查询未满课程。结果保留教学班 ID、课程代码、课程名、教师、院系、校区、授课语言、学分、上课时间、当前人数、容量、剩余名额和冲突标记。

已实现：

- `course available [query] --kind plan|public`：查询一个范围中当前报告仍有名额的课程；余量是 `KXRS - DQRS` 的查询时快照。
- `course selected`：读取当前已选课程。
- `course select <class-id> --kind plan|public --yes`：取得当前 CSRF token，提交一次 `choiceCourse`，读取官方异步结果，再以教学班 ID 回查已选课程。
- `course withdraw <class-id> --yes`：先确认目标在已选课程中，取得 CSRF 后只提交一次 `cancelCourse`，再确认目标不在已选课程中。回读失败不重试提交。

提交失败或连接中断后不会自动重放，因为无法确定首个请求是否已经生效；用户需要运行 `course selected` 复核。CLI 不做验证码识别或绕过，不轮询课程余量抢课，也不支持重修课和资格校验等尚未完整接线的分支。当前实网已经验证方案内、公选课、已选课程能够返回非空结构；真实选退课 mutation 尚未执行，因此编译通过和官方前端契约都不等于真实提交验收完成。

## 研究生教务

`academic` 使用 EHall `gsapp` 的四个独立官方应用，但统一装在一个 `GraduateAcademicClient` 中，并共用 `ehall` 认证能力：

- `grades` 读取已发布成绩，输出学期、课程代码/名称、类别、学分、显示成绩和是否通过。
- `exams` 读取当前或指定学期的考试与考查安排，不读取监考功能。
- `schedule` 读取研究生课表的课程、教师、星期、节次、地点和页面已有的时间地点说明。
- `plan` 读取学生绑定的培养方案、课程类别学分要求和方案课程。

这些 endpoint 和字段来自已核对的官方前端，未增加本科接口 fallback。开发探测只记录行数和字段名；仍待编译 CLI 取得本人真实数据并核对，状态见 M3。

## 网上办事大厅

`ehall services` 搜索官方服务目录；`tasks` 查询待办、已办或我发起的任务；`applications` 查询进行中、已完成或已撤销的办件。DTO 不携带原始 `formUrl`、`processInstanceId` 或带认证参数的链接。`ehall link` 只按数字 `appId` 生成 `https://ehall.nju.edu.cn/appShow?appId=...`，由用户在官方页面继续办理。

V1 不自动填写或提交 EHall 申请。成绩认定等表单涉及动态附件、流程节点和 readback，当前只允许从服务目录取得入口，避免把个人正式账号当测试账号。

## 软件学院教学支持系统

`softse` 使用软件学院 Moodle 当前 HTML 契约：`courses` 读取我的课程，`search` 搜索课程，`course` 读取章节与活动，`assignment` 读取要求正文、语义化提交状态、ISO 截止时间和附件链接，`grades` 读取课程成绩表。`assignments [course-id] --pending` 读取作业详情后按截止时间排序，省略课程 ID 时遍历 `courses` 返回的课程；草稿和重新开放的作业都保留。课程列表仅提供 ID、名称和链接，不从列表推断自助选课资格。输出不包含 Moodle 用户 ID、sesskey 或页面脚本配置。

`softse enroll` 从自助选课页原样收集隐藏字段，只提交一次，并重新访问选课页，要求官方成员关系判断将其重定向至目标课程且课程结构有效；必须带 `--yes`。需要选课密钥时只读取 `NJUCLI_SOFTSE_ENROLMENT_KEY`，不允许把密钥写在参数中。该写链路只依据页面契约实现，不在个人正式课程上执行开发验证。

`softse download` 只下载当前作业列出的唯一同名附件，默认是要求附件，`--submitted` 是本人已交文件；使用同一会话和二进制响应，保存到指定输出路径，已有文件直接替换。不接受任意 URL，也不向其他站点转发认证请求。

作业文件上传还需要 Moodle repository multipart 契约、文件限制和提交后状态回读。当前只提供 `submission-link` 交接到官方编辑页，名称明确表示没有上传或提交。

## TeX

`njucli tex <command>` 使用本站 TeXPage 契约，不套用 Overleaf 接口。`projects` 查询项目并按稳定项目标识合并普通项与置顶项；结果保留名称、项目标识、版本号、官方编辑地址和分页状态。`files` 只返回文件标识、路径和目录标记；`read` 只接受当前版本文件列表中的 UTF-8 文本，不输出临时签名下载地址。

`download` 下载指定版本的源码 ZIP，校验 ZIP 文件头后保存到指定输出路径，已有文件直接替换。`templates` 分页读取官方模板目录，返回模板标识、名称和下一页状态，供 `from-template` 使用。`create` 和 `from-template` 分别通过唯一 JSON 请求创建空白项目和模板副本；`rename` 单次提交新名称，随后按稳定项目标识和名称核对。不猜测模板标识或模板 API。

`write` 从本地 UTF-8 文件读取正文，要求目标项目版本中已有该文本文件和 `--yes`。它在同一 CLI context 打开官方编辑器、定位目标路径，仅填入一次正文，交由网站自身协作协议保存；不自行实现 CRDT 或上传覆盖 Adapter。手动提交模式在修改前拒绝；自动同步时通过只读请求核对服务器正文，相同才返回成功。等待超时不重写，明确要求查询确认；Windows 换行统一为 LF。

`compile` 复用上述编辑器定位，在同一会话中点击一次官方编译按钮，按 Socket.IO requestId 核对本次响应，再检查编译日志，最后下载 PDF。服务端在 LaTeX 失败后可能仍返回成功状态和旧 PDF，因此必须先拒绝错误日志；不能只校验文件头。`pdf` 只读取最近编译结果并执行同一日志检查；`log` 返回日志原文供 Agent 定位错误。两种 PDF 下载均替换指定本地输出文件；编译或下载失败时不会执行本地保存。

`upload` 将单个本地文件传入同一官方编辑器的上传控件，只选择一次文件，不实现第二套对象存储上传协议。目标固定为根目录，保留本地文件名；不存在则创建，同名文件默认替换，不增加覆盖开关。网站本身限制隐藏文件和大于等于 50 MiB 的文件，文件也不能替换目录。同名时原生组件在传输前提示冲突，CLI 点击一次覆盖；等待对应项目、版本、名称、根目录及本次覆盖状态的登记响应，再由 `TexClient` 列文件并下载该文件，逐字节核对本地内容。结果不明时不自动重传，也不删除远端对象；只返回必要的文件标识、路径、字节数。同名替换已实现，仍待授权后单独实网验收。

TeX 已完成的实网范围见[验收记录](#验收记录)。当前不提供目录上传、分享、删除或手动提交命令。

## 图书馆

图书馆模块实现一个现代汇文 `meta-local` client，契约名为 `nju-huiwen-meta-local-v1`：

- 按全字段、题名、作者、ISBN 或索书号检索。
- 查询书目详情与复本馆藏，保留馆藏地、索书号、架位标记、状态和是否可借。
- 查询当前读者借阅，保留题名、应还日和逾期状态。

这份字段契约来自同产品族公开部署的真实响应；由于 `opac.nju.edu.cn` 在当前网络返回“请使用南大 VPN 访问”，南大部署本身尚未完成校园网/WebVPN 实网 smoke。生产装配通过 `vpn -> opac` 会话链访问 WebVPN 包装后的 OPAC；契约不匹配时不会改用第三方书目数据。

续借和预约馆藏的 endpoint、资格校验与 readback 尚未验证，因此 MVP 不注册 `renew` 或 `reserve` 命令。

## 体育场馆

体育模块实现单一 `SportsClient`，覆盖：

- 场馆与具体 venue site 列表和详情。
- 按 venue site 与日期读取各场地、各时间片状态；文本输出按 space 状态即时统计余量。
- 我的预约分页列表与单条预约详情。
- CAS 落地 `oauth_token` 到业务 access token 的交换、角色选择与已验证签名规则。

`sports reserve-link` 返回指定场地的官方预约页、目标日期和 venue site ID，日期仍需在页面选择；`cancel-link` 返回官方预约记录页和目标订单 ID，供人继续取消。余量仍由明确的 `sports slots` 命令查询。两个交接命令均不提交订单或取消，不宣称办理成功。

预约、支付和取消场地仍缺少完整的验证码与 readback 契约，因此 MVP 不注册 `sports book` 或 `sports cancel` 命令，也不会绕过页面挑战或跳过服务端要求的订单状态。

真实 NJU 账号的角色、token 生命周期、实时余量和订单状态仍需真人登录 smoke。

## 聚合与诊断

顶层 `today [date]` 依次读取当天课表、读者借阅和体育预约。任一调用失败时整个命令直接失败，不返回部分成功或空数组兜底；调用 Agent 可以改为分别执行三个领域命令。EHall 待办已由独立命令提供，未硬塞进 `today` 以免一次聚合触发更多授权域。

`doctor` 当前检查正在使用的 account、可用认证 capability、南京大学官网连通性和 OPAC 直连网络门禁。它不是完整业务验收：成功只说明探测项通过，不代表课表、馆藏和体育三条授权链路均有非空数据。

## MCP

`njucli mcp` 启动 stdio MCP server，提供课表、研究生选课查询、教务、EHall、SoftSE、TeX、图书馆、体育、公告和日常聚合的只读工具。TeX 工具固定为 `tex_projects`、`tex_templates`、`tex_files`、`tex_read` 和 `tex_log`；结果直接使用 `NjuServices` 的领域 DTO。

MCP 不开放 mutation，也不实现另一套 HTTP client、认证或 fallback。它与 CLI 复用同一个 service 和最外层失败输出。

插件只是这一 CLI/MCP 的分发清单及写作 Skill，不增加内部动态插件系统。Skill 让有终端能力的 AI 调用现有 TeX 写命令；纯 MCP 宿主只能读取。本地插件包不等于豆包 App 兼容，客户端安装需另行验收。安装和论文素材边界见 [AI 接入与论文写作](ai-plugin.md)。

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

当前只对输入、认证、VPN、确认、用户交互、未找到和少数领域结构错误保留语义码。其他网络、HTTP 和解析异常原样冒泡到统一输出边界，不在各 client 重复包装。失败信息和 JSON/MCP 结构化数据在输出边界对 Cookie、JWT、token、ticket、密码、验证码及授权查询参数脱敏；不依赖脱敏器识别任意姓名、学号或自由文本个人信息，验收记录须主动省略这些内容。

## 验证与验收

自动测试只保留少量本地集成用例，使用 Node 内置 runner，不做单测或 E2E，不维护大套 fixture。提交前执行：

```bash
pnpm lint
pnpm test
node dist/cli.js --help
node dist/cli.js campus sources --format json
npm pack --dry-run
```

`pnpm test` 包含构建；测试不启动浏览器，不连接学校服务或真实钥匙串。这些检查不等于生产实网可用。以下是更新实网里程碑所需的证据，只有在任务要求、网络和授权条件具备时核对，不属于日常自动测试：

1. 登录后验证 EHall、timetable、softse、tex、sports、WebVPN、OPAC 与独立 selection 会话的真实关系、跨进程复用和每次业务前的在线探测；至少相隔 15 分钟复验持续可用性。
2. 本科课表返回非空 occurrence，并与当前学期页面逐字段核对日期、节次、教师和地点。
3. 体育返回真实场馆、具体场地和余量，并核对角色选择、token 生命周期和预约详情。
4. OPAC 在校园网或 WebVPN 下完成 search、book、holdings 和 loans smoke，确认南大部署与已实现的汇文契约一致。
5. 用个人账号只验证 `academic`、`ehall` 和 `softse` 读取结果；不得创建办件、选课、上传或提交。
6. 只有维护者另行准备可撤销课程时，才验证一次研究生选退课、SoftSE 选课与 readback；正式课程不得用于 mutation smoke。
7. library/sports/EHall/SoftSE 上传写接口在契约和 readback 方案齐备之前不注册命令。
8. TeX 按指定验收项目核对文件正文与下载 ZIP；写验收另行限定项目、允许动作及 CLI 执行入口，浏览器许可不扩大为 CLI 或全账号写许可。

## 验收里程碑

2026-09-22 范围：精简内部实现、恢复少量本地集成测试并完善开发流程和 TeX Skill。没有访问学校服务，不改变下列实网里程碑。

2026-09-21 本轮范围：补齐邮箱只读实现，修复 EHall 登录误判、业务 ID 脱敏与重复认证，并清理中间包装。研究生日期课表/ICS、作业上传和申请提交没有在本轮完成，不改变其里程碑状态。

交付只认学生任务的实际结果。每项必须用编译后的 CLI、新进程、真实南京大学服务执行，并与官方结果核对。源码、离线模拟、浏览器 DOM 和原始接口成功分别记录，不升级成 CLI 已交付；未通过的项目保持未通过，不用完成百分比替代。

| 里程碑 | 通过条件 | 当前状态与下一步 |
|---|---|---|
| M0 登录可复用 | 在 CLI 隔离浏览器登录后，新进程读取本人非空业务数据；至少相隔 15 分钟再次读取成功；会话可恢复时自动恢复，不能恢复时准确要求登录，不重放业务请求 | **SoftSE 复用通过**：独立进程读取、显式刷新、真实跨 15 分钟读取均为 6 条非空课程；远端子会话真实失效后的静默重建未单独触发，其他认证分支仍需独立验收 |
| M1 作业资料落地 | 列出作业，区分待交/草稿/已交；要求和截止时间与页面一致；附件真正下载、可正常打开且与官方文件内容一致；再次下载更新指定输出文件 | **待验收**：SoftSE 复用已通过；下一步用编译 CLI 下载真实附件并核对内容 |
| M2 代交指定作业 | 对指定验收作业上传指定文件，按真实设置完成保存/最终提交；重新查询为 submitted，目标文件内容与本地一致；不能只生成草稿 | **未实现**：需获准读取学生编辑页，确认本站上传与提交契约；真实写入只使用另行授权的可撤销作业 |
| M3 上课和个人教务 | 日期课表的时间、地点、教学周与官方页面一致；ICS 导入后事件正确；成绩、考试、培养方案取得本人真实数据并核对关键字段。本科/研究生分别验收 | **未通过**：研究生日期课表与 ICS 尚未接通，其他读取需完成 CLI 实网核对；不以本科成功覆盖研究生 |
| M4 选退课 | 查询真实可选/已选课程；指定验收班单次选入后在已选中出现，另行单次退课后消失；不重复提交，不占用正式课程席位测试 | **待受控验收**：已有代码和离线检查；需 selection 会话及维护者准备的验收教学班 |
| M5 找书和续借 | 南大真实馆藏返回校区、馆藏地、索书号和复本状态；按稳定借阅标识续借一次，回查应还日或续借次数确实变化 | **未实现**：先验证南大 OPAC 读取及借阅唯一 ID，再实现续借；需要校园网/WebVPN 和授权借阅目标 |
| M6 预约和取消场馆 | 查询指定场地、日期、时段的余量；完成官方必要挑战后单次预约，回查确认订单匹配；取消同一验收订单后回查取消状态 | **未实现**：需确认本站写契约、指定可撤销场地时段；不得跳过资格、验证码或费用条件 |
| M7 一项学生申请 | 先确定一个高频学生申请及固定契约，用真实授权材料提交一次，拿到稳定申请 ID，并能回查该 ID 的办理状态 | **未实现**：目录和链接不计申请能力；需明确申请类型、材料、唯一 ID 和受控撤销方式，不填随机资料 |
| M8 TeX 写作与源码落地 | 编译 CLI 查询项目及模板、读取文件、下载正文一致的 ZIP；在授权目标单次创建或按模板创建、重命名及替换正文，新进程核对结果；上传文本与二进制文件并核对内容，同名默认替换；编译后下载内容正确的 PDF，编译失败不得交付旧 PDF | **已有能力通过，同名上传替换待实网验收**：创建、模板、改名、正文编辑及编译已通过；9 月 8 日追加 TeX/BibTeX/PNG 新文件上传，安装产物回读三文件一致，图片与参考文献编译进入单页 PDF；错误编译拒绝旧 PDF 的既有验收通过 |
| M9 邮箱日常读取 | 本机绑定一次，独立进程列出真实邮件、搜索、读取 MIME 正文并下载内容正确的附件；前后已读标记不变；退出 CLI 后再次查询无需扫码 | **已实现，个人邮箱验收待首次绑定**：固定 IMAP/TLS、系统钥匙串、8 个 CLI 子命令和 4 个只读 MCP 工具；端口连通不等于收件成功 |

M0 按认证分支独立记录，SoftSE 分支通过即可推进 M1 验收，不被 OPAC/VPN 拖住；selection 维持已证实的独立会话。SoftSE 的后续顺序为 M1 → M2；TeX 的已验收范围不替代其他里程碑。跨 15 分钟的复验必须真实经过该时间，不修改元数据或时钟冒充。

### 待完成验收

负责人是实现方：执行、定位失败、修代码、复验和更新记录，不要求用户代跑整套测试。用户只承担必须本人完成的学校认证、必要人工挑战和受控写目标授权；这些前提不满足时明确阻塞，不扩大权限或操作正式数据。

M1 使用已有命令，不增加验收框架。ID 和文件名从真实只读结果中取得；输出和下载文件不存进仓库。只有会话要求重新登录时才执行 `auth login softse`。

```bash
node dist/cli.js softse courses --format json
node dist/cli.js softse assignments <course-id> --format json
node dist/cli.js softse assignment <activity-id> --format json
node dist/cli.js softse download <activity-id> "<file-name>" --output "<output-path>" --format json
```

下载验收核对文件内容、格式、大小和 SHA-256，再次下载核对指定输出文件确实更新。摘要只用于标识文件，不能单独证明内容正确。M1 只涉及读取和指定本地输出文件写入，不需要远端业务写授权。

只有 M2 的本站表单契约明确后才接上传命令；保存可能已经正式提交，不能假设存在无影响草稿。任何写里程碑都必须先确定目标、允许的动作与撤销办法；离线写检查通过仍不算真实写入通过。

### 验收记录

以下是已有验收结论，不表示文档更新时重新执行了实网验证。时间均为 UTC；各构建基于 `main@9be09b6` 的未提交修改，源码摘要按排序后的 `src` 路径、NUL、文件内容、NUL 计算。

| 范围 | 执行时间与入口 | 已核对结果 |
|---|---|---|
| SoftSE 会话复用 | 2026-09-05 13:33–13:52；新进程 `softse courses` → `auth refresh softse` → `softse courses`，并用安装产物读取 | 课程均为 6 条，实际间隔超过 15 分钟；安装入口可用。仅证明跨进程、跨时间复用，未单独触发远端子会话过期重建 |
| TeX 写作 | 2026-09-05 15:22–15:45；编译 CLI 创建/模板创建、改名、写入、编译及下载 | 234 字节正文新进程回读一致；模板副本 14 项；PDF 50,577 字节、1 页，文本与渲染通过；源码 ZIP 内容一致 |
| TeX 编译失败 | 同一写作验收中，错误正文 → `tex compile` → `tex log`，随后恢复正文 | 失败时退出码 1，不下载残留旧 PDF；日志定位错误；恢复后重新编译通过 |
| TeX 新文件上传 | 2026-09-07 16:57–17:01；`tex upload` → 安装产物新进程 `files/read/download` → `compile/log` | 合成 TeX 283 字节、BibTeX 151 字节、PNG 76 字节逐字节回读一致；ZIP 1,132 字节，原有正文不变；图片和参考文献进入 29,552 字节单页 PDF |
| 早期本地验证 | 2026-09-07 17:34；类型检查、构建、CLI/MCP smoke、实际 tarball 临时安装 | 66 个 leaf 帮助、8 个公开来源目录项、非法参数与确认门禁、本地文件替换和日期计算通过；未请求学校服务，不提升实网等级 |
| TeX 插件包 | 2026-09-09 18:32；`pnpm lint/build`、插件/Skill 校验、本地 tarball 安装后的 `njucli --help` 与 stdio MCP | 插件清单、MCP 配置和 Skill 均进入安装产物；握手列出 30 个只读工具，其中新增 5 个 TeX 工具。安装产物实网读取专用项目 1 个、文件 4 项、正文 234 字节、日志 4,994 字节、模板 9 项；没有执行远端 mutation。未安装到 Codex/TRAE/豆包客户端 |
| 根会话失效后的 TeX 复用 | 2026-09-10，07:48 完成核对；独立进程 `node dist/cli.js auth status sso --format json` → `auth status tex --format json` → `tex projects --format json` | SSO 为 expired，TeX 为 valid，项目读取成功返回 8 项；没有清理会话、重新登录或执行业务写入。仅证明有效子站会话不被根会话状态阻断，不提升根会话续期、子站过期重建或定期保活的验收等级 |
| 邮箱与精简版本，本机 | 2026-09-21；macOS / Node v25.9.0；`pnpm install --frozen-lockfile`、`pnpm lint/build`、全部 leaf 帮助、MCP stdio、实际 tarball 临时安装 | 76 个 leaf 帮助、34 个只读 MCP 工具、安装产物 mail 帮助/status 通过；合成邮件分页/中文 MIME/附件及原样未读标记检查通过；临时钥匙串条目跨进程保存、读取、解绑和账号删除清理通过。未增加测试目录或框架 |
| 本轮实网 | 2026-09-21；编译 CLI `campus canteens`、`tex projects`、`academic schedule`、修复后的 `auth status ehall`；无凭据 IMAP TLS 探测 | 食堂返回 14 项；IMAP 证书有效且收到 OK greeting。TeX 为 AUTH_REFRESH_FAILED，教务读取为 AUTH_REQUIRED；EHall 修正后明确返回 expired。邮箱尚未绑定，不能计入真实收件验收；未执行个人账号业务写入 |
| 内部精简，本地集成 | 2026-09-22；基于 `main@9be09b6` 的已有未提交工作区；`pnpm lint`、`pnpm test`、Skill 校验、CLI 帮助与来源目录、`npm pack --dry-run` | 3 个集成用例通过：认证依赖/刷新/退出落盘、校园文章查询解析、TeX 单次提交/回读/错误传递与失败日志阻止旧 PDF。仍有 76 个 leaf 命令。未运行 E2E，未访问学校账号，未提交或发布 |

对应源码摘要：

- 本轮邮箱与精简版本：`985aee15350ad27a81c526c655341ae096f755258d37d6f8a9225f8c1ebf104b`。本轮算法为按路径排序的 `src/**/*.ts`，依次拼接相对路径、换行和文件原字节后取 SHA-256；基于 `main@9be09b6` 的已有未提交工作区，不代表已提交或发布。

2026-09-21 源码行数按 `src/**/*.ts` 统计，包含空行，排除 dist、依赖和文档：7,579 → 7,543。原有文件净减少 264 行，新增邮箱 client/commands 两文件 228 行。

2026-09-22 同口径源码 7,543 → 7,246，减少 297 行：移除会话结果包装、单实现存储接口、动态认证注册及派生工厂，复用 client 方法类型，合并校园栏目重复结构。原有单测在本轮开始前已删除；新增一个 153 行的本地集成测试文件。源码加测试合计 7,399 行，比本轮起点净少 144 行，现有业务命令保留。

- SoftSE 安装产物：`1d36d360ba6106a67bdd85e587e15fe816a2f1b932fce442bd54c351cf0bfb03`。
- TeX 写作及错误编译验收：`125554c465f42bef2a89d1bdfb36b3c7bb53282376e9477c07ba2c684dbe2350`。
- TeX 新文件上传：`24ae54d298dc1e10a1551c61b603790fd1d6f5e46252df6b32ff00100e40b433`。
- 最近本地验证：`2b1d71efb498e1149aa60b3c1ef2e5600ff98cf772ab50efe6e6268bba1d2620`。
- TeX 插件包：`83dd89172bf411481fc45e3005bac524fab7b7ad23397ea2173743ea759bf5e8`。
- 根会话失效后的 TeX 复用：源码同 TeX 插件包；本次未重新构建，实际运行的 `dist` 按相同算法计算摘要为 `44e6fc6390a4a0fac0f28fa00a69a0d1220eea6e557dcbd45908384a57b833ae`。

TeX 上传验收的授权仅覆盖向「NjuCLI-CLI-验收-20260905-写作闭环」上传上述三份合成文件；不扩大到个人资料、其他项目或后续任意文件。同名上传替换仍待单独授权和实网验收；本地输出替换已验证，不代表远端替换通过。

未对个人账号选退正式课程、提交作业、预约、续借或提交申请。未发布 npm 包或 tag。

## 范围限制

V1 尚未注册交换项目、校园卡、宿舍、图书续借/预约、体育预约提交，以及 EHall 表单填写。这些能力需要固定远端契约、认证边界和安全 readback，不提前创建空命令。

范围外：抢课、绕过验证码/VPN/访问频率、在线支付、校园卡充值、修改密码、静默复制用户浏览器 Cookie，以及教师、行政或资产管理业务。高频学生申请按 M7 逐项核实、授权与验收。
