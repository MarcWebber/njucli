# 校园服务接口证据

更新日期：2026-09-26（SoftSE 课程目录、名单与全局安装升级）

本文记录 NjuCLI V1 实际采用的入口、请求顺序、字段契约和证据等级。公开实现只用于发现公开站点协议；本仓库没有以第三方代码或 Git 历史为底座，也不授权绕过验证码、VPN 或访问控制。

## 证据等级

- `nju-live-public`：从当前网络直接访问南京大学公开页面或网络门禁得到的结果。
- `nju-live-authenticated`：在南京大学真实登录会话中完成的黑盒验证。
- `nju-official-frontend`：从南京大学当前生产页面加载的前端脚本观察到请求链路；对写操作仍不等于真实提交 smoke。
- `same-product-live`：在同一产品族的公开部署中观察到真实响应；仍需南大部署复核。
- `reference-code`：公开实现中出现的请求或字段线索；不能单独证明南大当前生产环境可用。
- `pending`：真实能力存在，但南大当前契约或授权链尚未完成 smoke。

本地集成测试只检查模块衔接，不是远端证据。`reference-code` 与 `same-product-live` 可以支撑一个明确标注边界的 client，但不能被写成“南大实网已验证”；最终可用性必须由对应的真实结果确认。

下列站点证据来自已记录的核对，不表示文档更新时重新执行了实网验证。CLI 交付状态统一见[验收里程碑](design-v1.md#验收里程碑)。

## 外部实现边界

主要参考实现为 [nju-cli/nju-cli 固定提交](https://github.com/nju-cli/nju-cli/tree/df8716a4ee202ed8f7967b3732c8b2e53c961063)。它使用 Rust workspace 和 AGPL-3.0；NjuCLI 没有复制其 crate、命令树、登录缓存、验证码识别代码或 Git 历史，只复核公开 URL、请求先后关系、签名规则和字段名。

课表钟点另参考了 [SuperKenVery/nju-schedule-ics](https://github.com/SuperKenVery/nju-schedule-ics)。现代汇文字段另由 [WUST Library Mini Program](https://github.com/LingHangStudio/wust-library-mini-program) 所对应的公开同产品族实例复核。两者都不是南京大学官方接口承诺，因此在下文分别标为 `reference-code` 或 `same-product-live`。

## 统一身份认证

登录共用 `BrowserSession.login / completeLogin` 的可见页面与等待流程。authserver 正式账号登录表单自动使用 `auth.json` 的 username/password；站点 driver 决定成功地址和会话校验。SSO、selection、SoftSE、WebVPN 和 TeX 复用等待能力，验证码或扫码由本人在官方页面完成。

### 已观察关系

- 统一身份认证入口：`https://authserver.nju.edu.cn/authserver/login`。
- 同一隔离浏览器会话完成 SSO 后，EHall 可以进入已登录区域：`nju-live-authenticated`。
- EHall 的本科课表和研究生 `gsapp` 教务应用可以从同一会话进入：`nju-live-authenticated`。
- 软件学院教学支持系统的登录页提供站内 CAS 链接；当前 SSO 会话可以进入 `/my/`：`nju-live-authenticated`。
- TeXPage 通过本站 `/oauth/login` 进入学校统一认证；CLI 专用可见 Chrome 进入控制台后，`/api/user/info` 返回成功：`nju-live-authenticated`。
- 体育场馆由 CAS service 落地返回一次性 `oauth_token`，再交换业务 access token：`nju-live-authenticated + reference-code`。
- 研究生选课站要求使用统一身份认证账号，但当前登录页直接提交本站登录接口并展示验证码，没有观察到可复用的 CAS 重定向入口：`nju-live-public + nju-live-authenticated + nju-official-frontend`。
- `opac.nju.edu.cn` 在当前网络先被 VPN 门禁拦截，因此 OPAC 与 SSO 的最终关系仍为 `pending`。

### 实现边界

一个 `AuthCoordinator` 固定维护以下依赖：

```text
sso -> ehall -> timetable
sso -> softse
sso -> tex
sso -> sports
sso -> vpn -> opac
selection
```

`selection` 使用同一 account 浏览器目录中的独立会话。登录和业务请求共用隔离的 Playwright persistent context。CLI 自有会话型 Cookie 以 0600 权限原子保存到 `session-cookies.json`，下次启动恢复；持久 Cookie 由 Chromium 目录维护。

每次业务前在线探测目标能力，失效时自动登录并复用本地凭据。metadata 只记录 capability/status，`logged-out` 也允许后续业务登录。`auth status` 探测状态，`auth refresh` 检查并恢复会话。SSO 根探针访问 `authserver/login?service=...`，核对 EHall 落地路径。

同一命令认证与业务在 `AsyncLocalStorage` 作用域内共用一个 context，结束后保存并关闭。全量 logout 包含 SSO，清理会话并记录 logged-out；本地账号密码保留供后续登录使用。

体育 access token 只在当前命令期间使用。统一认证账号密码可通过命令参数或 JSON 导入本地。会话是否有效以在线探测为准，认证在业务之前完成，业务请求执行一次。

页面导航和登录等待统一使用 `domcontentloaded`。SoftSE 的编译 CLI 跨进程、跨 15 分钟复用已验收；真实子会话过期重建未单独触发，其他能力不能随之升级。命令、时间和源码标识见[验收记录](design-v1.md#验收记录)。

2026-09-10 只读复核中，编译 CLI 的 `auth status sso` 返回 `expired`，随后 `auth status tex` 返回 `valid`，新进程 `tex projects` 返回 8 个项目。说明根会话失效不应阻断仍有效的子站会话；该结果不证明根会话续期或子站过期重建。

同日读取[公开登录页](https://authserver.nju.edu.cn/authserver/login)及其直接引用的 `login.js`、`schoolCombinedLogin.js`、`utils.js`、`common-header.js`（版本 `20260703.154014`），未发现可供 CLI 使用的 `refresh_token` 或启用长期登录的控件。[common-header.js](https://authserver.nju.edu.cn/authserver/njuTheme/static/common/common-header.js?v=20260703.154014) 中的 30 天期限用于 `MULTIFACTOR_BROWSER_FINGERPRINT`，不是登录会话有效期。上述检查不代表学校所有认证渠道均无长期授权；目前没有足够契约或实网证据支持注册长期刷新入口或承诺永久免登录。

## 本科个人课表

### 固定契约

V1 契约名为 `nju-ehall-wdkb-v1`，appId 为 `4770397878132218`。`EHallTimetableClient` 每次调用只走以下固定准备和查询路径：

```text
GET  https://ehall.nju.edu.cn/appShow?appId=4770397878132218
GET  /jwapp/sys/wdkb/*default/index.do
GET  /jwapp/sys/funauthapp/api/changeAppRole/wdkb/20230211151103310.do
POST /jwapp/sys/wdkb/modules/jshkcb/xnxqcx.do
POST /jwapp/sys/wdkb/modules/jshkcb/dqxnxq.do
GET  /jwapp/sys/wdkb/modules/jshkcb/cxjcs.do
POST /jwapp/sys/wdkb/modules/xskcb/cxxszhxqkb.do
```

前一条使用 EHall host，后六条使用 `https://ehallapp.nju.edu.cn`。学期、当前学期与课表路径来自 `reference-code`；结构化课表 action 固定为 `cxxszhxqkb`，不会在运行时退回文本详情接口。

### 字段

核心远端字段与 DTO 映射：

| 远端字段 | 领域含义 |
|---|---|
| `DM` / `MC` | 学期 ID / 名称 |
| `XQKSRQ` | 学期开始日期 |
| `JXBID` | 教学班 ID |
| `KCM` | 课程名 |
| `SKJS` | 教师 |
| `KSJC` / `JSJC` | 开始 / 结束节次 |
| `SKXQ` | 星期 |
| `SKZC` | 教学周位图 |
| `JASMC` | 上课地点 |
| `XXXQDM_DISPLAY` | 校区 |

parser 按固定 EMap envelope 校验 `code`、`datas.<action>.rows` 和字段类型。缺少 action、周位图异常、节次越界或非 JSON 响应都会直接失败，不会推测或返回空结果。

第 1–13 节的当前静态钟点来自公开参考实现，证据为 `reference-code`；仍需与南京大学当前学期、各校区官方作息做实网核对。

研究生课表不作为这份本科契约的 fallback；它由下文独立的 `GraduateAcademicClient` 负责。

## 研究生教务

EHall 当前服务目录与官方应用页面确认四个常用应用：我的成绩、我的考试、我的课表和我的培养方案。应用 ID 与业务根路径分别为：

| 能力 | appId | 根路径 |
|---|---|---|
| 成绩 | `5094115980385668` | `/gsapp/sys/wdcjapp/` |
| 考试 | `5051542166524964` | `/gsapp/sys/wdksapp/` |
| 课表 | `4979568947762216` | `/gsapp/sys/wdkbapp/` |
| 培养方案 | `5006012186614764` | `/gsapp/sys/wdpyfaapp/` |

当前实现先访问对应 `appShow` 和应用 index，再走一条固定读取链。证据为 `nju-live-authenticated + nju-official-frontend`；探测阶段只读取页面和查询接口，并只带回状态、行数及字段名，没有保存真实姓名、学号、课程或成绩。

成绩使用：

```text
POST /gsapp/sys/wdcjapp/modules/wdcj/xscjcx.do
```

action 为 `xscjcx`。当前官方脚本使用 `XNXQDM_DISPLAY`、`KCDM`、`KCMC`、`KCLBMC`、`XF`、`CJXSZ` 与 `SFJG`；CLI 只映射这些高频字段。

考试使用：

```text
GET  /gsapp/sys/wdksapp/modules/ksxxck/getXnxqList.do
POST /gsapp/sys/wdksapp/modules/ksxxck/wdksxxcx.do
POST /gsapp/sys/wdksapp/modules/ksxxck/wdkckcxxcx.do
```

查询条件固定包含学期、`SFFBKSAP=1`、当前学号，以及 `KSAPWID` 的 null/not-null 条件。当前实现只输出课程、日期、起止时间、地点和座位等常用字段，不接入教师监考与打印入口。

研究生课表使用：

```text
POST /gsapp/sys/wdkbapp/modules/xskcb/kfdxnxqcx.do
GET  /gsapp/sys/wdkbapp/wdkcb/initXsxx.do?XH=
POST /gsapp/sys/wdkbapp/modules/xskcb/xspkjgcx.do
```

`initXsxx` 仅在请求过程中取得当前学号，不进入 DTO、日志或元数据。课程映射固定使用 `KCDM`、`KCMC`、`BJMC`、`JSXM`、`XQ`、`KSJCDM`、`PKSJDD`、`JASMC` 和 `XQDM_DISPLAY`。

已核对的官方课表脚本中，`getSkjcList` 调用 `/gsapp/sys/wdkbapp/modules/xskcb/xsskjccx.do`，参数为 `XNXQDM`、`XH`；页面按 `JCFADM`、`DM`、`MC`、`KSSJ`、`JSSJ` 读取节次方案，排课记录还使用 `ZCMC`、`XQ` 和 `KSJCDM`。这是 `nju-official-frontend` 线索，尚未新增 client 请求。脚本名为 `getWeeks` 的方法读取的是每周起始星期配置，不是学期日历；教学周到自然日、调课和完整起止节次仍须验证，不能沿用本科时刻表猜测。

培养方案使用：

```text
POST /gsapp/sys/wdpyfaapp/modules/pyfaxq/gjxhcxdyfadm.do
POST /gsapp/sys/wdpyfaapp/modules/pyfaxq/facx.do
POST /gsapp/sys/wdpyfaapp/modules/pyfaxq/wdFacxPyfakclbxfyqcx.do
POST /gsapp/sys/wdpyfaapp/modules/pyfaxq/pyfakcxxcx.do
```

先由学号取得唯一 `FADM`，随后读取方案头、课程类别学分要求与课程。学分要求接口按官方页面读取返回数组首项的 `falxdykclbxfyqResults`，其中固定使用 `KCLBDM_DISPLAY`、`ZDXF` 与 `ZGXF`；没有把它误当成普通 EMap `datas.<action>.rows`。没有跨方案查询、备用 endpoint 或本科培养方案 fallback。

## 网上办事大厅

服务目录使用：

```text
GET /jsonp/ywtb/onlineYwtbApps?searchKeyword=...&labels=
```

官方前端将 `result=success` 的 `data` 作为应用数组。匿名只读响应已确认每项使用 `appId`、`appName` 和 `hasPermission`；当前实现只保留这三个字段，并生成不含 session 参数的 `/appShow?appId=...`。证据为 `nju-live-public + nju-official-frontend`。

任务与办件使用：

```text
POST /taskcenterapp/sys/taskCenter/taskNew/getTaskRestful.do
POST /taskcenterapp/sys/taskCenter/taskNew/queryProcessTrack.do
```

任务的 `flag=1|2|3` 分别表示待办、已办、我发起的任务；办件的 `state=1|2|3` 分别表示进行中、已完成、已撤销。DTO 不返回 `formUrl`、`processInstanceFormView`、`appId` 或 `processInstanceId`，避免 Agent 把含认证上下文的内部链接当作稳定 API。成绩认定、离返校登记、研究生证补办、出国申请和通用报名等服务入口已在服务目录观察到，但其表单 mutation 未进入 V1。

## 软件学院教学支持系统

官方入口为 `https://selearning.nju.edu.cn/`，当前部署是 Moodle 页面结构。站内登录页的 CAS 入口为：

```text
GET /login/index.php?authCAS=CAS
```

`softse` capability 依赖 `sso`。每次业务前先读取 `/my/`，要求最终地址为本站 `/my/` 且 HTML 含 `a[href*="/login/logout.php"]`；已登录直接使用。探测失效时访问上述站内 CAS 入口，再读取 `/my/` 验证，不能恢复时要求官方登录。交互登录结束也使用同一验证，不以普通主页或错误页宣告成功。

读取契约：

```text
GET /my/
GET /course/index.php
GET /course/index.php?categoryid={categoryId}
GET /course/search.php?search=...&perpage=20&page=...
GET /user/index.php?id={courseId}&page={zeroBasedPage}&perpage=20
GET /course/view.php?id={courseId}
GET /mod/assign/view.php?id={activityId}
GET /grade/report/index.php?id={courseId}
```

课程页按 `li.section[data-sectionid]` 与 `li.activity[id^=module-]` 读取章节和活动；作业按 `.submissionstatustable` 的固定中文标签读取提交状态、评分状态、截止时间、最后修改与文件链接；成绩按 `table.user-grade` 的 `column-*` class 读取。证据为 `nju-live-authenticated`，但实网只进行了 GET/page-model 探测，未上传或提交任何内容。

匿名课程列表不含可靠的自助选课资格标记，因此不输出可选资格布尔值，实际资格以选课表单为准。

已登录作业页确认标题是 `#region-main h2`（页头 `h1` 是课程名），所属课程来自 `.breadcrumb` 的课程链接，要求正文和附件来自 `#intro`；已交状态为 `td.submissionstatussubmitted`。生产解析器对页面片段的标题、课程、状态、截止时间、正文及两类附件均校验通过，未保存个人内容。`dueAt` 由该站中文日期格式转换为带 `+08:00` 的 ISO 字符串，`assignments --pending` 过滤正式已交状态并按截止时间排序。

`download` 使用本作业已列出的 `/pluginfile.php/...`，加 `forcedownload=1` 后读取二进制响应，并要求 `Content-Disposition: attachment`；否则不写文件。响应头/二进制由现有浏览器 transport 提供，不新增下载 Adapter。只允许同源跳转，表单响应的 307/308 不自动重发。本地保存替换指定输出文件；真实 CLI 下载尚待单独验收。

自助选课页为 `/enrol/index.php?id={courseId}`。当前表单明确包含 `id`、`instance`、`sesskey`、动态 `_qf__...` 字段、可选 `enrolpassword` 与 `submitbutton`。实现不硬编码动态表单名，而是原样收集隐藏字段，只 POST 一次，再 GET 选课页验证已加入关系。根据 [Moodle 3.10.8 官方选课页](https://github.com/moodle/moodle/blob/v3.10.8/enrol/index.php)，活跃成员会被重定向；实现要求最终为目标课程且章节结构有效，错误页和仅访客可读的课程不算成功。选课密钥只允许来自 `NJUCLI_SOFTSE_ENROLMENT_KEY`。该 mutation 尚未使用真实课程执行。

作业上传还需确认本站的 Moodle file-manager item ID、repository、文件大小/数量、multipart 上传参数与 readback。当前仅提供 `submission-link`，不上传文件，也不宣称已经提交。

[Moodle 官方作业说明](https://docs.moodle.org/502/en/Using_Assignment) 明确区分保存后即提交和需要额外确认的草稿流程；这是产品行为说明，不是南大部署的接口证据。后续上传须按当前作业表单确认文件限制、草稿/最终提交、个人/小组设置，再确定唯一请求序列。不能为了探测上传参数往个人作业区写测试文件。

官方开源 [repository upload](https://github.com/moodle/moodle/blob/v3.10.8/repository/upload/lib.php) 仅提供 multipart 参考，未取得南大当前编辑表单和文件限制，不据此注册上传命令。

## TeX

入口为 [南京大学 TeX 控制台](https://tex.nju.edu.cn/console)。[学校登录说明](https://doc.nju.edu.cn/books/latex/page/d09bf) 与当前页面确认使用 TeXPage，提供南京大学统一认证登录；这不是 Overleaf 协议证据。

### 认证与运行路径

2026-09-05，登录页实际加载 [njuLogin.c2e9cd.js](https://static.texpage.com/dist/nju/njuLogin.c2e9cd.js) 和 [base.85706d.js](https://static.texpage.com/dist/nju/base.85706d.js)。登录按钮仅导航 `/oauth/login`；学校授权后返回本站 `/oauth/callback`。不保存授权 code、state、Cookie 或回调完整 URL。

2026-09-05 实网确认：同一 CLI 专用目录使用普通可见 Chrome，先访问 `/console` 后，`GET /api/user/info` 返回 `status.code=1`；使用无头 Chrome，即使先访问控制台仍得到安全校验 HTML。因此 `tex` 固定使用可见 Chrome，不自动切换 headless，不绕过校验或搬运日常/IAB 浏览器 Cookie。每次业务前访问 `/console`，若落在登录页则进入 `/oauth/login`，等待回到 `/console` 后由 `/api/user/info` 核对。该 capability 依赖 `sso`，与业务共用同一个 context，沿用 CLI 会话保存及退出规则。

2026-09-25 修复回跳等待：自动探测等待上限为 15 秒，显式登录为 3 分钟。URL 等待以导航提交为完成条件；`net::ERR_ABORTED` 或回跳等待超时不直接作为 TeX 鉴权结论，仍核对 `user/info`。共享登录入口遇到导航中断后继续等待指定落地页，其他网络及页面关闭错误保留。类型检查、构建、CLI 帮助和 9 项临时行为核对通过，未新增测试文件。编译后的 CLI 实际执行 `auth status tex` 返回 valid，`tex projects` 返回 8 个项目。没有清除真实会话或触发远端写入；自然过期后的自动恢复尚未实网验证。

JSON 接口使用 `{ status: { code }, result }` envelope：`1` 为成功、`1003` 为登录失效、`1010` 为二次验证。HTML 不当作 JSON 成功；错误不触发业务重放。这些状态来自 [695 官方请求模块](https://static.texpage.com/dist/695.dd000b3124969bd596ec.js)，字符偏移约 126050；没有据可选 Authorization header 推断或提取个人 token。

### 项目与文件契约

以下路径均相对 `https://tex.nju.edu.cn`，未包含真实项目标识。证据来自当前官方前端和下述分层验收，不是猜测接口。

| 动作 | 请求 | 请求/响应契约 |
|---|---|---|
| 模板目录 | `GET /zh/template?page=<n>` | 官方服务端 HTML；校验 `h1` 为“LaTeX 模板”（忽略首尾空白），从 `a[href^="/zh/template/"]` 下的 `h2` 提取标识及名称，按下一页 href 判断分页 |
| 项目列表 | `GET /api/project` | query 为 `page`、`projectName`、`sortBy=updateAt`、`getType=all`；`result` 含 `list`、`pinnedList`、`hasMore`，项目含 `projectKey`、`projectName`、`selectedVersion.versionNo` |
| 空白创建 | `POST /api/project` | JSON `{ projectName }`；成功结果含 `projectKey`，随后按稳定标识及名称查询核对 |
| 模板创建 | `POST /api/project/byTemplate` | JSON `{ key, isGuide: false }`；成功结果含 `projectKey`、`versionNo`，随后查询核对 |
| 重命名 | `PUT /api/project/rename` | JSON `{ projectKey, projectName }`；随后按同一项目标识和新名称查询核对 |
| 文件列表 | `GET /api/project/files` | query 为 `projectKey`、`versionNo`；`result` 直接为数组，行含 `fileKey`、`filePath`、布尔 `isDir`、`fileType`；不是 `result.files` |
| 文件原文 | `GET /api/project/file` | query 为 `projectKey`、`versionNo`、`fileKey`；302 至 `latex-file.texpageusercontent.com` 短期签名地址，跟随后为 200 原文；实测初始文件为 `text/plain`，协作编辑后文件为 `application/octet-stream`，不是 JSON |
| 源码 ZIP | `GET /api/project/download` | query 为 `projectKey`、`versionNo`；二进制 ZIP，CLI 校验 ZIP 文件头后替换指定本地输出文件 |

项目查询/写入/下载契约见 [963 官方项目模块](https://static.texpage.com/dist/963.ade336fc7d008f992e9d.js)，字符偏移约 9237、10672、16982、21437、18238；列表筛选和创建表单见 [console 官方入口](https://static.texpage.com/dist/console.2b05d24ce4f4a318d8ef.js)，约 134362、19707。JSON 编码由 [89 请求依赖](https://static.texpage.com/dist/89.d398136bde244a750a5e.js) 的 Axios `transformRequest` 确认，约 562727；不能根据未展开的默认 header 误写成 URL-encoded。模板创建响应定位于 [createByTemplate 官方入口](https://static.texpage.com/dist/createByTemplate.36b21a056bbd5aebb768.js)，约 7722。

文件数组读取见 [167 官方项目状态模块](https://static.texpage.com/dist/167.ec7f24b66d9376044eb6.js)，约 82532；文件下载链接见 [project 官方编辑器](https://static.texpage.com/dist/project.c5c94a9a068c0673468d.js)，约 546606、657021。编辑地址固定为 `/project/user/<projectKey>/<versionNo>`；未发现可靠的文件直达 query/hash 契约，CLI 不构造猜测参数。

公开文件 DTO 只有 `fileKey`、`path`、`isDir`；`fileType` 仅用于拒绝目录及非 `text/plain` 读取。文件读取严格解码 UTF-8，不输出签名地址；`X-Amz-*` 查询参数在 core 单一输出边界脱敏。源码下载替换指定输出文件；新文件权限为 `0600`，已有文件保留原权限。

### 文本保存

官方编辑器不是整篇正文 HTTP PUT。它通过 Socket.IO 加入文件房间，再发送带版本的协作操作；客户端原生编辑器负责 CRDT 状态。`joinDoc` 含 `fileKey`、`ownerKey`、`projectKey`、`versionNo`、`v: "chunk"`；`joinedDoc` 返回 `roomId` 及含 `fileState`、`operations`、`v` 的数据。`operations` 携带 `batchId`、`syncType`、`operations`、`v`、`range`，确认包按 `batchId` 对应 `status: "ok"`。定位分别在上述 167 模块约 35015、109000，以及 project 模块约 230630、224390；这些协议证据不作为自制 CRDT 的实现依据。

CLI `write` 复用同一 `TexClient` 和浏览器 context：先确认目标是已有文本文件，打开官方编辑地址，按目录路径定位文件，核对编辑器路径，再对 `.cm-content[contenteditable="true"]` 填入一次正文。页面存在 `.project-info-item.sync-btn` 表示手动提交模式，在修改前拒绝，不擅自 commit。自动同步保存完全由网站执行；CLI 只读取文件正文核对，匹配后才成功，等待超时不再次写入。没有可靠的通用 DOM“已保存”提示，因此不以编辑器显示的文本充当服务器保存证据。

`write` 固定使用这一编辑路径，不在失败后改走上传；`upload` 则按本地完整文件上传或替换同名文件。两条命令语义独立，不互为兜底，也不提供分享或删除命令。

### 单文件上传

2026-09-07，通过 CLI 自有会话核对专用验收项目的官方上传对话框：`.explorer-header .icon-upload` 打开“上传文件”，本地上传面板默认目标为 `/`；`input[type="file"][multiple]` 对应“选择文件”，两个带 `webkitdirectory` 的 input 是目录上传，不使用它们。

[project 官方编辑器](https://static.texpage.com/dist/project.c5c94a9a068c0673468d.js) 字符偏移 574042 的 `beforeUpload` 拒绝点开头文件，要求 `size / 1024 / 1024 < 50`；583201 的 `upload` 默认 `overwrite=false`，先按父目录和文件名检查同名项，冲突时在对象传输前返回本地状态 2002。584470 的 `overwriteFile` 由原生覆盖按钮触发，向同一个 `upload` 传入 `overwrite:true`。584983 的 `saveFile` 登记 JSON 包含 `addType:"upload"`、`ownerKey`、`projectKey`、`versionNo`、`isDir:false`、`parentKey`、`fileName`、对象 `key` 和布尔 `overwrite`，根目录 `parentKey` 为 `"0"`。[167 官方项目状态模块](https://static.texpage.com/dist/167.ec7f24b66d9376044eb6.js) 字符偏移 63601 的 `uploadProjectFile` 将上述 JSON 单次 POST 到 `/api/project/file`。`renderStatus`/`renderFileList` 在约 595000 处将单文件覆盖按钮置于 `.upload-list`；CLI 不使用覆盖全部按钮。

CLI 不提取页面账号参数或上传凭据，不自行实现对象存储 SDK；使用同一浏览器 context 的官方上传控件，输入固定的文件名和二进制快照。上传前列表确定是否同名：不存在则创建，同名文件则点击一次原生覆盖按钮，同名目录拒绝。登记响应须对应目标项目、版本、名称、根目录及预先确定的 `overwrite` 值；成功后复用文件列表和 `GET /api/project/file`，逐字节核对上传内容，不以列表中出现名字或 UI 成功提示代替验收。文本读取和二进制回读共用同一个文件请求方法，没有新 Provider 或下载 Adapter。

原生对象上传模块为 [754 官方模块](https://static.texpage.com/dist/754.61b142621fc56e55c622.js) 的模块 43680（约 29870 起）。其内部根据服务器的临时上传配置传输文件，CLI 不复制这套分支或打印配置。

命令为 `tex upload <project-key> <local-file> --version <version-no>`，只支持根目录单文件，同名文件默认替换，不支持文件夹或递归。新文件上传已取得 `nju-live-authenticated` 的 CLI 证据；同名替换根据官方前端接线，仍待单独授权和实网验收。上传、安装产物回读及编译结果见[验收记录](design-v1.md#验收记录)。

### 编译与日志

[167 官方项目状态模块](https://static.texpage.com/dist/167.ec7f24b66d9376044eb6.js) 约 38653 处的 `compileProject` 使用 Socket.IO `request` 事件，`request` 含 `requestId` 和 `action: "get:/api/project/compile"`，`data` 含项目、版本、文件路径及主文件等编辑器参数。这里的 action 不是可直接调用的 HTTP GET 接口。约 108248 处通过 `response.requestId` 对应任务；CLI 在同一原生编辑器点击一次编译，观察这一请求及匹配响应，不自行构造协作状态或编译请求。

[project 官方编辑器](https://static.texpage.com/dist/project.c5c94a9a068c0673468d.js) 约 860919 处确认 `.project-menu .icon-compile` 只在非编译中显示；CLI 等待该按钮，避免误点“停止编译”。文件树的完整路径 `title` 见约 564676 处。

| 读取 | 契约 |
|---|---|
| 最近编译结果 | `GET /api/project/compileResult/pdf?projectKey=...&versionNo=...`，result 含 `pdfUrl`、`pdfSize`、`logUrl`、`blgUrl`；见 167 模块约 52821 |
| PDF 下载 | `GET /api/project/pdf/download?projectKey=...&versionNo=...`，原始 PDF；见 167 模块约 58550 |
| 编译日志 | GET 上述结果的 `logUrl`，实测主机为 `latex-file.texpageusercontent.com`，200 `text/plain`；CLI 不输出签名 URL |

实网负向验收确认：不存在的文档类导致 LaTeX 失败，但返回状态仍为 `code=1`，`pdfUrl` 和下载接口仍可指向上次的 PDF。因此 `compile` 按 requestId 取得结果后、`pdf` 取得最近结果后，都先读取日志。错误行识别使用 167 模块约 5700 处的官方规则（`!` 或文件名加行号的错误，排除 `ignored error`），并拒绝 `No pages of output.`。发现错误即退出，不请求 PDF 下载；`log` 则返回日志原文供 Agent 修正源码。无错误后才下载并校验 `%PDF-`，再替换指定输出文件；新文件权限为 0600。

### 实网验收

编译 CLI 已在授权专用项目完成空白/模板创建、重命名、正文写入与回读、源码下载、编译、PDF 与日志读取、新文件上传。编译失败不下载旧 PDF 的负向验收也已通过；同名上传替换仍待验收。执行时间、源码标识、授权范围和结果统一见[验收记录](design-v1.md#验收记录)。

2026-09-10（北京时间），临时安装的 tarball 经 stdio MCP 完成项目、文件、正文、日志和模板五项读取，返回非空真实数据；MCP 直接调用原有 `NjuServices.tex`，没有新增远端请求契约。插件和 Skill 格式、安装 CLI 帮助及 MCP 握手均通过。PNG 沿用既有上传验收；JPEG、SVG、矢量 PDF 只有通用二进制上传实现，不能据此认定逐格式实网通过。SVG 宏包对 Inkscape 的依赖参见 [CTAN 官方说明](https://ctan.org/pkg/svg/)，南大编译环境尚未验证。豆包 App 未完成兼容验证。

2026-09-05 15:04 UTC，编译 CLI `tex templates --format json` 从[官方模板目录](https://tex.nju.edu.cn/zh/template?page=1)取得 9 个模板，包含南京大学学位论文模板，`hasMore=true`。该目录查询证据与项目模板创建相互独立，均不推断未验证的模板 API。

## 研究生选课

### 入口与登录

官方入口为：

```text
https://yjsxk.nju.edu.cn/yjsxkapp/sys/xsxkapp/course_nju.html
```

2026-09-05 核对的页面和研究生院选课通知均确认使用统一身份认证账号。选课站的登录页面自身包含账号、密码和验证码字段，并向本站登录接口提交；没有观察到 `authserver.nju.edu.cn` 的 CAS 跳转。因此生产装配只增加一个 `selection` session capability：它复用当前 account 的隔离浏览器目录，本站登录和验证码由用户在官方页面完成；本地凭据自动填写目前接入 authserver 正式账号登录表单。

登录成功后，CLI 以 `loadPublicInfo_course.do` 返回非空 `loginUserId` 和 `csrfToken` 作为在线 session 探针。退出使用页面给出的固定 `login/auth/logout.do` 地址。每次业务命令前都会执行该探针，不用本地 valid 状态跳过在线检查；本站失效后仍可能需要用户完成官方验证码，不能承诺由 CAS 自动恢复。

### 读取契约

当前唯一 `GraduateCourseSelectionClient` 使用：

```text
POST /sys/xsxkapp/xsxkCourse/loadFanCourseInfo.do  # 方案内，kind=plan
POST /sys/xsxkapp/xsxkCourse/loadGxkCourseInfo.do  # 公选课/跨院系，kind=public
GET  /sys/xsxkapp/xsxkCourse/loadStdCourseInfo.do  # 已选课程
```

课程列表请求固定发送页面同名筛选字段及 `pageIndex`、`pageSize`、`sortField`、`sortOrder`，其中 `query_sfym=0` 表示“未满”。2026-09-05 在已认证会话中验证了方案内、公选课与已选课程均能返回非空数据；带 `query_sfym=0` 的公选课查询也返回非空结果，且每行都有数字类型的当前人数与容量。证据为 `nju-live-authenticated + nju-official-frontend`。

核心字段映射：

| 远端字段 | 领域含义 |
|---|---|
| `BJDM` / `BJMC` | 教学班 ID / 班级名 |
| `KCDM` / `KCMC` | 课程代码 / 课程名 |
| `RKJS` / `KCKKDWMC` | 教师 / 开课院系 |
| `XQMC` / `SKYYMC` | 校区 / 授课语言 |
| `XF` / `PKSJDDMS` | 学分 / 上课时间地点 |
| `DQRS` / `KXRS` | 当前人数 / 容量 |
| `IS_CONFLICT` | 是否与已选课程冲突 |

`remaining` 只按当前响应计算为 `KXRS - DQRS`，是读取时快照，不是席位保证。缺少固定字段或字段类型变化时直接失败，不生成空结果。

### 单次选课

官方前端当前使用以下链路：

```text
GET  /sys/xsxkapp/xsxkHome/loadPublicInfo_course.do
POST /sys/xsxkapp/xsxkCourse/choiceCourse.do
POST /sys/xsxkapp/xsxkCourse/loadXkjgRes.do
GET  /sys/xsxkapp/xsxkCourse/loadStdCourseInfo.do
```

提交体只有教学班 ID `bjdm`、课程范围 `lx` 和当前 `csrfToken`；`plan` 对应 `lx=2`，`public` 对应 `lx=1`。`choiceCourse` 返回事务 ID 后，客户端最多读取 30 次官方异步结果；结果报告成功后，必须在已选课程中再次找到同一 `BJDM` 才返回成功。

CLI 命令直接提交一次。提交请求在网络错误、认证错误或结果不明时都不会自动重放；用户应运行 `course selected` 复核。MCP 不开放该 mutation。当前证据为 `nju-official-frontend`，尚未对真实课程执行写入，因此不能标记为 `nju-live-authenticated` mutation smoke。

退课契约来自已获取的官方 `courses.js` 中 `doCancelCourse`：`POST /sys/xsxkapp/xsxkCourse/cancelCourse.do`，参数 `bjdm`、`csrfToken`，同步返回 `code === 1` 表示成功。`course withdraw` 固定执行已选课程确认目标、取当前 token、单次退课、已选课程确认消失；不复用选课异步结果轮询。真实退课未执行。

验证码只在官方页面由用户完成，不实现 OCR、绕过或命令行输入。V1 也不实现余量轮询抢课、重修课或资格校验入口。

## 图书馆 OPAC

### 网络门禁

[南京大学图书馆](https://lib.nju.edu.cn/) 把纸本检索和“我的图书馆”指向 `https://opac.nju.edu.cn/`。当前网络直连 OPAC 返回 HTTP 403 且页面提示使用南大 VPN，证据为 `nju-live-public`。NjuCLI 将该结果明确映射为 `VPN_REQUIRED`，不会改用第三方书目或把公网书目冒充南大馆藏。

生产装配目前通过 WebVPN 包装 host 访问相同路径，并要求 `vpn` capability；读者借阅进一步要求 `opac` capability。WebVPN 是否能在所有账号上直接复用 SSO、是否还有短信挑战，以及南大 OPAC 的真实读者登录落地仍为 `pending`。

### 已实现的汇文契约

契约名为 `nju-huiwen-meta-local-v1`。当前唯一 client 使用：

```text
POST /meta-local/opac/search/
GET  /meta-local/opac/bibs/{bibId}/infos
GET  /meta-local/opac/bibs/{bibId}/holdings
GET  /meta-local/opac/users/loans?page={page}&pageSize={pageSize}
```

请求/响应形态在现代汇文同产品族公开实例获得真实 JSON，证据为 `same-product-live`，不是 `nju-live-authenticated`。

检索 envelope 固定读取 `data.actualTotal` 与 `dataList`，核心书目字段只有 `bibId`、`title`、`author`、`callno`、`itemCount` 和 `circCount`。

馆藏接口的 `data.holdings` 是 JSON 字符串，二次解析后固定读取：

```text
callNo, library, location, shelfMark, status, itemsAvailable
```

借阅固定读取题名、应还日与逾期状态。书目详情只从 infos 的 `baseInfo` 读取题名和作者，其余复本信息来自 holdings。

南大校园网/WebVPN smoke 必须确认四个 endpoint、envelope 与字段在 `opac.nju.edu.cn` 部署上完全一致；否则直接失败并修订唯一 contract，不能并排保留多个自动 fallback client。

### 写操作

续借与预约的真实南大 mutation endpoint、资格校验和 readback 尚未捕获，证据为 `pending`。MVP 不注册 `library renew/reserve`，也不会发送猜测的 POST。

[图书馆规章制度](https://lib.nju.edu.cn/info/1044/1109.htm) 说明续借、预约及跨校区委托；[研修间预约](https://lib.nju.edu.cn/rmfw/sbfw/yxjyy.htm) 链接 `ytj.nju.edu.cn`，并说明人数、签到和失约规则。网页存在不等于 API 已确认，不固化可能变化的额度、费用或违约规则；这两类写能力均维持 `pending`。

[南大 NLSP 介绍](https://lib.nju.edu.cn/zhtsg/NLSPxydtsgglxt.htm) 指出 Libstar/NLSP 产品，不能单凭汇文名称认定与当前同产品参考契约一致。WUST 参考的续借接口依赖该校服务级凭据，不是已确认的南大学生会话 API，本仓库不移植凭据或调用该接口。现有 loans 还缺少南大实际借阅/复本唯一标识；必须先验证读取契约，再实现续借和委托。

## 体育场馆

### 入口与派生 token

EHall 中的体育场馆管理系统资源编号为 `6600339867991076`，业务页面与 API 基址分别为：

```text
https://ggtypt.nju.edu.cn/venue/
https://ggtypt.nju.edu.cn/venue-server
```

CAS service 为 `/venue-server/sso/manageLogin`。固定派生顺序：

```text
CAS landing -> oauth_token
POST /api/login
POST /roleLogin    # 响应提供角色时
```

`oauth_token` 一次性使用，`/api/login` 返回的 token 不持久化。角色存在时固定选取返回列表第一项，并要求 roleLogin 返回新的 token；没有角色时直接使用登录 token。真实账号的角色含义和多角色选择策略仍需 `nju-live-authenticated` smoke，不会在当前实现中增加第二套 Provider。

### 签名与只读接口

固定请求头为公开前端协议中的 `app-key`、毫秒 `timestamp`、`sign` 和 `cgAuthorization`。签名按已观察顺序对 path、排序后的非空参数、timestamp 与公开客户端常量计算 MD5。公开 app key 与签名常量不是用户 secret，但仍以 contract 常量集中管理。

唯一 `SportsClient` 使用：

```text
GET /api/reservation/campus/venue/info
GET /api/front/website/venue_sites/{venueSiteId}
GET /api/reservation/day/info?venueSiteId=...&searchDate=...&hasReserveInfo=1
GET /api/orders/mine?page=...&size=...
GET /api/orders/{orderId}
```

已有接口探测和参考代码证据（`nju-live-authenticated + reference-code`）；编译 CLI 仍需复核 token 生命周期、角色选择、实时余量和订单状态，不能将接口探测等同于任务交付。

`day/info` parser 输出日期、时间段、space 名称和预约状态。文本展示只统计解析为 `available` 的具体 space，不读取模糊页面文案。

预约列表与详情将 `reservationDateDetail` 保留为 `reservationDetail` 并展示；字段来自上述固定参考提交的 `crates/cli/src/venue.rs`，证据为 `reference-code`。官方取消/预约契约尚未完成核对，不声称已交付写操作。

2026-09-10（北京时间）读取官方 `/venue/js/chingo.631e3eaa.js` 确认页面路由 `/venue-reservation/:id` 和 `/orders`；`chunk-2cb4a94c.21dde223.js` 将路由 `params.id` 作为 `venueSiteId`，`chunk-2595ddd9.f80bb79b.js` 是包含取消按钮的预约记录页。`sports reserve-link` 因此返回 `https://ggtypt.nju.edu.cn/venue/venue-reservation/{venueSiteId}`；未确认日期预填参数，日期仍需在页面选择。`cancel-link` 返回 `https://ggtypt.nju.edu.cn/venue/orders` 及目标订单 ID，不伪造订单预选参数。两个编译 CLI 链接输出 smoke 通过，不代表完成预约或取消。

### 写操作

公开参考中出现过以下写路径：

```text
POST /api/reservation/order/info
POST /api/captcha/check
POST /api/reservation/order/submit
POST /api/venue/finances/order/pay
POST /api/venue/finances/order/cancel
```

当前 MVP 没有调用这些 endpoint，也不注册 `sports book/cancel`。没有 OCR、自动点选、支付或失败后重放分支。

## 校园公开信息源

`campus canteens [query]` 使用官网固定页面 `https://www.nju.edu.cn/xyfw/hqfw.htm` 的“膳食中心”表格，读取学生/民族食堂名称与办公电话，按名称过滤。2026-09-10 已只读核对 HTML 的 `rowspan` 分组与两列条目契约；完整 CLI 公开实网验收待完成。不输出猜测的营业状态、实时菜单或拥挤度。

V1 为八个 source 分别固定 HTTPS origin、section、列表 selector、详情 selector 和允许的文章路径：

| source | origin | 当前证据 |
|---|---|---|
| `nju` | `https://www.nju.edu.cn/` | `nju-live-public` |
| `academic-affairs` | `https://jw.nju.edu.cn/` | `nju-live-public` |
| `graduate-school` | `https://grawww.nju.edu.cn/` | `nju-live-public` |
| `graduate-admission` | `https://yzb.nju.edu.cn/` | `nju-live-public` |
| `itsc` | `https://itsc.nju.edu.cn/` | `nju-live-public` |
| `youth-league` | `https://tuanwei.nju.edu.cn/` | `VPN_REQUIRED` |
| `research` | `https://scit.nju.edu.cn/` | `nju-live-public` |
| `asset-management` | `https://zcc.nju.edu.cn/` | `nju-live-public` |

七个可直连来源的列表非空和详情 smoke 已通过；团委来源按网络门禁返回 `VPN_REQUIRED`。跨 host 链接会被跳过，不会由当前 source parser 跟随抓取。

## 输出与当前验证

远端 client 只识别认证、VPN 等调用方需要采取动作的错误；普通网络、HTTP、业务码和解析异常直接抛出。CLI/MCP 在唯一的最外层边界将失败输出为 `{ ok: false, error }`，成功输出为 `{ ok: true, data }`。失败信息和 JSON/MCP 结构化数据中的 Cookie、JWT、token、ticket、密码、验证码及授权查询参数在输出边界脱敏；不依赖脱敏器识别任意姓名、学号或自由文本个人信息。

本地验证包括类型检查、构建、少量集成测试和产物检查；不做单测或 E2E。模拟 HTTP 与临时会话文件只用于本地集成，不改变学校接口的证据等级。实网交付状态以[验收里程碑](design-v1.md#验收里程碑)为准。

进入南大“已实网可用”结论前仍需保存不含真实学号、姓名、Cookie、JWT 或验证码的 smoke 记录。特别是 OPAC 只能在校园网/WebVPN 验证后升级证据等级；同产品族实例不能替代该步骤。

## 新契约准入

后续每个远端契约至少需要当前官方页面或真实响应证据、一个明确的认证 capability 与单一 client。mutation 需要明确目标、唯一提交请求、人工挑战条件和 readback 标识。

交换项目、EHall 表单提交、SoftSE 文件上传、图书续借/预约和体育预约提交在满足上述条件前维持 `pending`，不注册空壳命令。研究生选课读取已经达到 `nju-live-authenticated`；研究生选退课与 SoftSE 自助选课写入仍需使用专门的可撤销目标完成受控 smoke，不能拿个人正式课程验证。

## 2026-09-21 核对与修正

本节为历史记录：当时的钥匙串存储、参数限制和退出恢复行为已由 9 月 25 日的本地凭据实现替代，保留当日契约与验证结果。

### 邮箱

契约来自学校的[学生邮箱客户端设置](https://itsc.nju.edu.cn/1a/8f/c21586a334479/page.htm)和[邮箱问答](https://itsc.nju.edu.cn/96/2e/c21475a497198/page.htm)：完整邮箱地址、客户端专用密码、`imap.exmail.qq.com:993`、TLS。开启客户端服务和生成密码仍需要官方网页授权；长期不用可能关闭客户端服务。未找到可用的个人账户 OAuth 或自动生成密码契约，不以企业管理员 API 代替。

实现为 `MailClient`，使用 ImapFlow 连接及 MailParser 解码。按当前本地账号配置目录，在系统钥匙串 `njucli.mail` 下保存凭据；macOS 使用 Keychain，Linux 明确选择持久 Secret Service。绑定先连接并只读打开 INBOX，再保存凭据。解绑/账号删除只删除对应本机钥匙串条目，不更改官方客户端服务。

只读链路：`EXAMINE` 打开邮件夹；`UID SEARCH` 筛选；`UID FETCH` 读取邮件头或 `BODY.PEEK[]` 正文；按需解析单封 MIME。列表与搜索返回倒序 UID 分页；ID 包含邮箱、文件夹、UIDVALIDITY 和 UID，不使用不稳定的消息序号。附件保存要求明确输出路径。CLI 有 bind/status/unbind/folders/list/search/read/download；MCP 只开放四个读取工具。

当日证据：

- 官方 IMAP 端口 TLS 证书校验通过，收到 `* OK` greeting；未发送个人账号凭据。
- 本机钥匙串用临时合成条目完成保存 → 新进程读取 → 解绑；删除临时 CLI 账号后对应条目也已清除。没有读取其他应用凭据。
- 内联本地 smoke 验证倒序分页、中文 MIME 正文、附件二进制与 0600 权限、账号 ID 不匹配拒绝；这些是合成数据检查，不是南大邮件验收。
- 编译 CLI 的 `mail status` 返回未绑定；非交互 `mail bind` 退出 4，不接收参数或管道密码；MCP `mail_list` 返回 `AUTH_REQUIRED` 和绑定命令。
- 当前官方邮箱页尚未登录。真实邮件数量、搜索结果、附件内容、服务端已读标记和长期复用尚未验收。

### EHall 会话

匿名 `GET /new/index.html` 返回 HTTP 200，不能证明已登录。该页引用的 [amp.min.js](https://ehall.nju.edu.cn/new/portal/js/amp.min.js) 使用 `AmpServices.userInfo()` 请求 `/jsonp/userInfo.json`，以 `hasLogin` 控制已登录状态；当日匿名响应已确认 `hasLogin: false`。

探针固定检查该字段。若为 false，按同一官方前端的 `goLoginPage` 逻辑访问 `/login?service=<首页>` 一次，然后再次检查 `userInfo.json`。正常子会话不受根会话失效阻断；无法恢复时返回 expired，不发起业务请求。编译 CLI `auth status ehall --format json` 当日返回 expired，修复了旧首页探针误报有效的问题。根会话有效时的恢复成功路径仍需另行实网验收。

### 结构清理

移除浏览器 Page 包装、单实现 Factory 与旧生产注入选项；直接复用同一个 Playwright Page/context。删除 Clock 注入和只读取一次的研究生身份 Promise 缓存。体育业务使用探针兑换的同一 token；本科课表探针和业务共享同一个 client 与当前学期请求。内联 smoke 已检查一次探针、显式退出不恢复、课表只初始化一次。

脱敏键的 `sid` 改为完整键匹配，保留 `classId`、`teachingClassId`、`campusId`；token、Cookie 和真正的 sid 仍脱敏。MCP 统一只读注册和输出，保留逐项显式 service 调用，不增加动态动作分派。

### APP 探索

[南大 APP 官方介绍](https://guide.nju.edu.cn/faq/33/06/c44791a537350/pagem.htm)确认课表、成绩、校园卡等服务；[鼓楼服务大厅](https://www.nju.edu.cn/xyfw/glfwdt.htm)列出校园卡余额、明细等在线能力。后续优先核实余额/消费流水、空闲教室等学生高频读取。此轮没有登录态下的 APP 请求证据，不据公开功能清单新增猜测 endpoint 或宣称已支持申请提交。

## 正版软件下载（2026-09-25）

公开只读入口：

| 入口 | 已确认契约 |
| --- | --- |
| [南大软件目录](https://itsc.nju.edu.cn/zbrj/list.htm) | `.wp_listcolumn > .wp_column > a` 的软件栏目，15 项；软件 ID 由栏目名称规范化生成 |
| [Adobe 说明](https://itsc.nju.edu.cn/adobe/list.htm)及其[离线下载页](https://itsc.nju.edu.cn/0e/53/c50138a593491/page.htm) | `.wp_articlecontent` 中的可见链接；32 个校内下载条目（主说明页 2 个，离线页 30 个），按 URL 去重 |
| [Adobe CC 直接下载页](https://helpx.adobe.com/cn/download-install/apps/download-install-apps/creative-cloud-apps/download-creative-cloud-desktop-app-using-direct-links.html) | `table.dexter-Table a[href]` 中的可见下载链接，共 9 个；安装包区分平台与版本 |
| [WPS 365](https://itsc.nju.edu.cn/WPS365/list.htm)、[MathType](https://itsc.nju.edu.cn/MathType/list.htm)、[Origin](https://itsc.nju.edu.cn/Origin_56479/list.htm) | 同一正文链接解析，分别得到 2、2、3 个校内安装包 |

`software list` 返回 15 个学校栏目与单独的 `adobe-cc` 条目。`show` 分别返回说明链接和下载文件；`files[].id` 取 URL 最后两段，保留平台路径，避免 CC 不同架构的同名文件混淆。下载地址限定为页面提供的 `download.nju.edu.cn`、`ccmdl.adobe.com`、`ccmdls.adobe.com` HTTPS 链接。下载只保存文件，校园许可与安装按官方步骤完成。

实网结果：源码 CLI 与本地 tarball 安装后的编译 CLI 均成功下载 `macarm64/ACCCx6_10_0_252_41.dmg`，返回 311,485,111 字节。源码 CLI 的落盘大小与服务端 Content-Length 一致，DMG 尾部 `koly` 标识与 0600 权限正确。临时安装目录与下载文件已清理；未运行安装程序。当前网络解析 `download.nju.edu.cn` 返回 ENOTFOUND，校内包完整下载仍需校园网或官方 VPN 验收。

本地新增一个集成用例，覆盖目录过滤、链接去重、CC 架构 ID、流式下载、覆盖已有输出、HTML 响应拒绝及错误前保留原文件。类型检查与全部 5 个集成用例通过。

同日较早的只读状态核对：`mail status` 返回 `bound:false`，当时尚未完成邮箱绑定；TeX `auth status/refresh` 均返回 valid，新进程读取 8 个项目；`auth status sso` 返回 expired。该结果证明现有 TeX 会话可复用，不能证明根会话已续期或永久免登录。NJU APP 仍处于公开入口调研层级。

## 邮箱绑定向导（2026-09-24）

通过官方邮箱已登录页面只读核对以下 DOM 和当前页面内联脚本，证据为 `nju-live-authenticated` 与 `nju-official-frontend`。此处为当日页面探测证据，没有生成凭据或保存设置。当前直接凭据绑定和实网读取结果见下方 9 月 25 日记录。

| 环节 | 实际页面契约 |
| --- | --- |
| 登录 | `https://mail.nju.edu.cn/`；成功进入 `/cgi-bin/frame_html`；顶部 `#useraddr` 为完整邮箱地址 |
| 设置 | 顶部“设置”链接；内容在 `iframe#mainFrame`；其中“客户端设置”进入客户端配置 |
| IMAP | `input#openimap` 对应“开启IMAP/SMTP服务”；当前账号已勾选；POP 服务及收取选项是独立控件 |
| 保存 | `a#sendbtn` 为“保存更改”；官方表单 `form#web_set` 使用 POST `/cgi-bin/setting4`，页面函数 `CheckInputCheckBox` 提交整张当前表单 |
| 专用密码入口 | 顶部“微信绑定”进入 `setting4` 的 `setting_wx` 页面；“生成新密码”绑定 `addClientPwd` |
| 生成 | 用户点击后，官方前端 POST `/cgi-bin/wx_token`，动作 `act=add_spwd`；请求带当前会话及安全校验字段，由页面负责生成 |
| 一次性展示 | 前端成功条件为 `errcode == "0"`，从 `data.passwd` 构造弹窗中的 `input#authorCode`；同次响应还包含凭据记录 ID、用途与时间，登记到 `#wx_auth_table` |

`domains/mail/bind.ts` 执行官方浏览器路径：登录 → 检查 IMAP → 必要时保存并回读 → 微信绑定 → 单次生成 → `MailClient.bind` 验证保存。无参数 `mail bind` 仅在没有本地邮箱凭据时使用此路径。点击前监听 POST `/cgi-bin/wx_token` 且表单 `act=add_spwd` 的本次响应，HTTP 成功且 `errcode == "0"` 时接收 `data.passwd`。IMAP 验证成功后保存到 `mail.json`。

历史失败记录：2026-09-25 较早的两次浏览器绑定均在读取 `#authorCode` 弹窗时超时；其中一次已点击生成，但未确认远端生成结果，未完成 IMAP 验证或本机凭据保存。此后将接收方式改为监听官方响应。浏览器生成分支的实网闭环仍待验收；下方通过的是直接提供凭据的路径。

## 本地凭据与邮箱读取（2026-09-25）

`auth login [capability] --username <username> --password <password>` 或 `--credentials <json>` 将统一认证 username/password 保存到 `auth.json`。`BrowserSession` 在 authserver 正式账号表单自动填写并提交，后续业务探测失效时自动登录。此次实网已自动填写正确账号并提交，但官方滑块在 180 秒内未完成，SSO 登录未成功。

`mail bind --address <address> --password <password>` 或 `--credentials <json>` 使用提供的邮箱凭据验证 IMAP 后保存。同一本地账号允许多个邮箱，`mail.json` 为 `{ current, mailboxes: [{ address, password }] }`。两份文件位于 `~/.config/njucli/accounts/<account>/`，支持 `XDG_CONFIG_HOME`，权限 0600。统一认证账号与邮箱地址独立；省略地址时使用 auth username 派生的 `username@smail.nju.edu.cn`，username 已为完整邮箱地址则直接使用。

`mail accounts` 列出邮箱，`mail use <address>` 切换默认，`mail unbind [address]` 删除指定或当前邮箱。无参数 `mail bind` 复用已存凭据校验。`folders/list/search` 使用当前邮箱，`read/download` 使用邮件 ID 中对应的已绑定邮箱。日常读取通过 `imap.exmail.qq.com:993` TLS，使用 EXAMINE/BODY.PEEK 保持已读状态。

| 验证层 | 实际结果 |
| --- | --- |
| 编译 CLI、真实 IMAP | `mail bind` 复用通过；6 个邮件夹；两页各 5 封且无重复；搜索命中；正文 410 字符；回读未读状态不变 |
| 本地集成 | 7 个用例通过，包含多邮箱绑定与切换、默认地址派生、SSO 与邮箱独立、本地凭据保存、MIME 正文及附件 |
| 实网附件 | 近期抽查无附件，尚未验证真实附件下载 |
| 统一认证 | 已自动填表并提交，到达官方滑块；180 秒未完成人工挑战，登录未成功 |

记录仅保留操作、数量与状态；个人邮箱、邮件内容和密码未写入仓库。

## 代码精简与产物核对（2026-09-25）

本轮开始时 `src/**/*.ts` 为 7,403 行，完成后为 6,637 行，净减少 766 行。统计以本轮开始时的工作区快照为基准，包含原有未提交修改；新增的本地凭据、自动登录和多邮箱代码也计入最终行数。

认证协调器与账号索引直接读写本地数据；命令直接执行业务动作；领域响应使用已确认字段和就地 TypeScript 类型。体育独立解析器已合并至 client，清理了重复 schema、参数与重定向检查。业务状态码、文件格式、编译日志与写入回读继续用于确认实际结果。

- `pnpm install --frozen-lockfile`、`pnpm lint`、7 项本地集成和 `git diff --check` 通过。
- 临时本机 HTTP 核对体育预约字段归属、图书数字转换和嵌套 holdings JSON、研究生已选课程映射通过。
- 编译 CLI 读取南大新闻列表 10 条，第一篇正文 2,187 字符；本科生院所选文章实际跳转统一认证，返回 `AUTH_REQUIRED`。
- `npm pack --dry-run` 与实际 tarball 临时安装通过，清单 91 个文件；安装产物的帮助、邮箱绑定状态和真实邮件列表均通过。
- MCP stdio 注册 36 个只读工具，`mail_list` 实网返回 1 封邮件。

源码 SHA-256：`478920d4e4691d9c9b2500be8e5f0f9c2431b878163f321667886c781dd0d64a`。个人凭据与邮件内容未进入源码、文档或安装包。


## 滑块与继续精简（2026-09-26）

统一认证使用 CLI 专用 Chrome 和现有生产认证方法。临时脚本截图后，从滑块按钮中心执行鼠标按下、横向移动和松开；首次定位偏右失败，刷新图像后按新的拼图缺口距离拖动，官方页面验证通过并回跳办事大厅。成功结果来自 `auth.login` 的目标页面判定。

- 新进程 `auth status sso --format json` 返回 `valid`，确认已保存会话可以恢复。
- 新进程 `academic grades --format json` 返回 18 条；记录不保存成绩或身份内容。
- 可复用路径收敛为 `skills/njucli-auth/scripts/login.mjs`（29 行），相对导入安装包中的生产模块。输入 `shot` 输出截图路径，输入 `drag x y dx` 按当前截图坐标拖动。登录完成后保存会话并退出。
- 脚本复用已保存的凭据。截图通过 `saveFile` 写入系统临时目录，新文件权限 0600。

源码本轮从 6,637 行降至 6,579 行，净减少 58 行；累计较最初 7,403 行减少 824 行。清理 AccountStore 未使用构造参数、SoftwareClient 测试专用 fetch 注入、日期未使用参数、URL 包装、无状态 driver 类、`capabilities`、`nativeFetch`、`httpCheck`、`webVpnUrl`、`removePath`，同时去掉 Cookie JSON 错误的重复包装和未使用 signal 检查。真实浏览器请求转换与领域状态判断继续承担对应生产职责。

`pnpm lint`、构建和 7 项本地集成通过。本机 HTTP 测试在允许监听 127.0.0.1 的环境执行。源码 SHA-256：`013390ba00cc1b7d500acbd31a1d47c2df6c63f30b25299b504f4faaebbc5233`。


## 第二邮箱实网验证（2026-09-26）

为另一邮箱绑定用户新提供的客户端密码时，IMAP 返回认证失败，未改变旧邮箱凭据。通过临时请求观测确认：实际发送的完整地址符合用户截图，新密码与当轮输入相同，且与旧邮箱密码不同；正式服务器为 `imap.exmail.qq.com:993` TLS。

在用户已登录的 Chrome 邮箱设置标签核对到目标账号的“开启 IMAP/SMTP 服务”未勾选。勾选并保存后，页面显示“设置保存成功”，回读开关为开启；同一组账号和新密码随即通过 CLI `mail bind --credentials`。此次设置操作使用官方 UI；没有复制用户浏览器 Cookie，日常查询仍使用 IMAP。

新进程实测：两个邮箱分别保留，新邮箱为当前邮箱；保存的新密码与输入一致，`mail.json` 权限 0600；邮件夹 6 个，列表 3 封，正文 692 字符，读取前后未读状态相同。临时凭据文件与个人数据验证输出在完成后删除。此项验证了第二个真实邮箱的绑定和读取，浏览器自动生成客户端密码仍沿用此前未验收的状态。

源码与 7 项本地集成通过；`git diff --check`、CLI 帮助、8 个校园源和 `npm pack --dry-run` 通过，打包清单为 92 个文件，含认证 Skill 与 29 行脚本。实际 tarball 安装到临时目录后，帮助、邮箱绑定状态和新邮箱 1 封列表读取通过，脚本相对导入路径保留。

## SoftSE 课程目录与名单（2026-09-26）

已有工作区修改先提交为 `7d42b5a`，本轮在该基线上扩展 `SoftSeClient`、CLI 与只读 MCP。新增命令：

```bash
njucli softse catalog --format json
njucli softse participants 370 --page 1 --format json
```

`catalog` 从 `/course/index.php` 出发，跟随 `.course_category_tree` 内的分类、分页和更多课程链接。目录根页本轮返回 14 个顶层分类；分类内使用 `.coursebox .coursename a` 提取课程。URL 查询参数排序、去除片段与归一化零页后去重，课程按 `courseId` 去重。空分类实际可能没有课程树，其页面为 `body#page-course-index-category`，`#switchcategory select[name="categoryid"]` 选中目标分类。

`participants` 使用 `/user/index.php?id={courseId}&page={page-1}&perpage=20`，只读取指定课程的指定页。`#participants tbody tr` 的 `th.c0` 内 `/user/view.php?id={userId}&course={courseId}` 链接提供页面显示名、Moodle 用户 ID 和课程内资料链接，`td.c1/c2` 分别为角色与小组。末页包含 `.emptyrow` 补齐行，解析时跳过；下一页取同课程的分页链接。结果为 `{ courseId, page, nextPage, items }`，末页 `nextPage: null`。

名单表当前显示账号名称、角色、小组和最近课程访问。指定资料页 `/user/profile.php?id={userId}` 本轮仅核对了字段标签，可见“电子邮件地址”等字段，未观察到独立的“学号”标签；这些字段能否可靠对应学号尚未验证。当前 `participants` 完成了课程成员账号的分页读取，学生身份与学号的对应能力仍未完成。

| 验证层 | 实际结果 |
| --- | --- |
| 源码与本地集成 | `pnpm lint`、`pnpm test` 通过，共 9 项；SoftSE 覆盖课程分类与分页去重、空分类、成员分页及末页补齐 |
| 认证实网：目录 CLI | 返回 438 门课程，438 个唯一 `courseId` |
| 认证实网：课程 370 名单 CLI | 第 1、2 页各 20 人，跨页重复为 0；第 16 页 14 人，`nextPage: null` |
| 匿名 HTTP | 指定名单页与资料页最终均为 `/login/index.php`，最终 HTTP 200 表示登录页 |
| 认证实网：权限对照 | 370 出现在当前账号的课程导航，名单可读；451 不在导航，名单请求最终为 `/enrol/index.php`，CLI 返回 `USER_ACTION_REQUIRED`、退出码 4 |
| MCP stdio | 列出 38 个工具，包含 `softse_catalog` 和 `softse_participants`，两者均声明只读 |
| 使用说明与打包 | SoftSE Skill 校验通过；CLI 帮助、8 个校园源和 `npm pack --dry-run` 通过，清单 93 个文件，包含新增 Skill 与编译 client |

权限样本确认了当前账号与上述课程的访问结果，尚不能推出“任意两人只要有共同课程就能查看彼此资料”的通用规则。本轮仅执行查询，未提交选课请求；没有将真实姓名、学号、邮箱、成员列表或页面原文写入仓库。使用步骤见 [SoftSE Skill](../skills/njucli-softse/SKILL.md)。

## 全局安装与升级（2026-09-26）

安装入口为 `scripts/install.sh`：下载远端 `main`，使用锁定的 pnpm 10.27.0 和 `pnpm-lock.yaml` 安装构建依赖，构建并打包，再执行 npm 全局安装。`postinstall` 注册 5 个 Skill 目录链接；`njucli upgrade` 调用同一安装脚本并保持原 npm 全局前缀。开发目录安装不注册全局 Skill，同名的非本安装链接保留并报错。

| 验证层 | 实际结果 |
| --- | --- |
| 类型与本地集成 | `pnpm lint` 与 11 项集成通过；新增安装幂等、同名内容保护、升级 JSON、失败退出码与临时目录清理 |
| 完整安装脚本 | 以独立临时 Git 仓库提供 `main`，按锁文件构建并将实际 tarball 安装到临时全局前缀；CLI 帮助、8 个校园源、5 个 Skill 链接和认证脚本真实路径通过 |
| 完整升级流程 | 在临时仓库产生新提交，再运行已安装的 `njucli upgrade --format json`；输出为有效成功 JSON，原全局前缀保留，已链接 Skill 的内容更新到新提交 |
| 安装产物 | `npm pack --dry-run` 包含 96 个文件，含安装脚本、Skill 注册脚本、升级命令与 5 个 Skill |
| Skill 与文档 | 本轮更新的 4 个 Skill 均通过 frontmatter 校验；认证脚本以 Skill 的绝对路径调用，接口证据使用 GitHub 链接 |

上述安装与升级验证使用临时 CLI 和 Skill 目录，没有改动个人认证文件或客户端配置。公开远端安装的验证单独记录。
