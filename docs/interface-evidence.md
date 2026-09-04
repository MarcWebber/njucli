# 校园服务接口证据

更新日期：2026-09-04

本文记录 NjuCLI V1 实际采用的入口、请求顺序、字段契约和证据等级。公开实现只用于发现公开站点协议；本仓库没有以第三方代码或 Git 历史为底座，也不授权绕过验证码、VPN 或访问控制。

## 证据等级

- `nju-live-public`：从当前网络直接访问南京大学公开页面或网络门禁得到的结果。
- `nju-live-authenticated`：在南京大学真实登录会话中完成的黑盒验证。
- `same-product-live`：在同一产品族的公开部署中观察到真实响应；仍需南大部署复核。
- `fixture`：本仓库脱敏 fixture 已覆盖正常、错误或 schema drift。
- `reference-code`：公开实现中出现的请求或字段线索；不能单独证明南大当前生产环境可用。
- `pending`：真实能力存在，但南大当前契约或授权链尚未完成 smoke。

默认 CI 只运行 fixture、fake session 和纯函数测试。`reference-code` 与 `same-product-live` 可以支撑一个明确标注边界的 client，但不能被写成“南大实网已验证”；最终可用性必须由对应的 NJU smoke 确认。

## 外部实现边界

主要参考实现为 [nju-cli/nju-cli 固定提交](https://github.com/nju-cli/nju-cli/tree/df8716a4ee202ed8f7967b3732c8b2e53c961063)。它使用 Rust workspace 和 AGPL-3.0；NjuCLI 没有复制其 crate、命令树、登录缓存、验证码识别代码或 Git 历史，只复核公开 URL、请求先后关系、签名规则和字段名。

课表钟点另参考了 [SuperKenVery/nju-schedule-ics](https://github.com/SuperKenVery/nju-schedule-ics)。现代汇文字段另由 [WUST Library Mini Program](https://github.com/LingHangStudio/wust-library-mini-program) 所对应的公开同产品族实例复核。两者都不是南京大学官方接口承诺，因此在下文分别标为 `reference-code` 或 `same-product-live`。

## 统一身份认证

### 已观察关系

- 统一身份认证入口：`https://authserver.nju.edu.cn/authserver/login`。
- 同一隔离浏览器会话完成 SSO 后，EHall 可以进入已登录区域：`nju-live-authenticated`。
- EHall“我的课表”可以继续派生课表会话：`nju-live-authenticated`；V1 当前只实现下述本科契约。
- 体育场馆由 CAS service 落地返回一次性 `oauth_token`，再交换业务 access token：`nju-live-authenticated + reference-code`。
- `opac.nju.edu.cn` 在当前网络先被 VPN 门禁拦截，因此 OPAC 与 SSO 的最终关系仍为 `pending`。

### 实现边界

一个 `AuthCoordinator` 固定维护以下依赖：

```text
sso -> ehall -> timetable
sso -> sports
sso -> vpn -> opac
```

登录由 account 隔离的 Playwright persistent context 承载。浏览器请求共享该 context 自己的 Cookie，但调用方不能手工注入 `Cookie` header，响应中的 `Set-Cookie` 也不会进入普通 DTO 或日志。会话以 15 分钟保守窗口进行机会式刷新；`auth status` 使用在线探测。

体育 access token 只在当前命令执行期间使用。NjuCLI 不持久化一次性 `oauth_token`，不接收命令行密码，不把本地元数据文件存在当作在线登录成功，也不在写请求失败后重新登录并重放。

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

前一条使用 EHall host，后六条使用 `https://ehallapp.nju.edu.cn`。学期、当前学期与课表路径来自 `reference-code` 并由本仓库 fixtures 验证；结构化课表 action 固定为 `cxxszhxqkb`，不会在运行时退回文本详情接口。

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

parser 先校验 EMap envelope 的 `code`、`datas.<action>.rows` 和字段类型。缺少 action、周位图异常、节次越界或非 JSON 响应都映射为 `REMOTE_SCHEMA_CHANGED`，不会推测。

第 1–13 节的当前静态钟点来自公开参考实现并由单元测试固定，证据为 `reference-code + fixture`；仍需与南京大学当前学期、各校区官方作息做实网核对。

### 尚未覆盖

研究生 EHall 入口 `https://ehallapp.nju.edu.cn/gsapp/sys/wdkbapp/*default/index.do` 已在真实页面观察到，但列表、学期和时间地点契约尚未捕获。V1 不注册研究生 parser，也不会把本科结果作为 fallback；该能力为 `pending`。

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

请求/响应形态在现代汇文同产品族公开实例获得真实 JSON，并在本仓库用脱敏 fixtures 回归，证据为 `same-product-live + fixture`，不是 `nju-live-authenticated`。

检索 envelope 固定读取 `data.actualTotal` 与 `dataList`，核心书目字段只有 `bibId`、`title`、`author`、`callno`、`itemCount` 和 `circCount`。

馆藏接口的 `data.holdings` 是 JSON 字符串，二次解析后固定读取：

```text
callNo, library, location, shelfMark, status, itemsAvailable
```

借阅固定读取题名、应还日与逾期状态。书目详情只从 infos 的 `baseInfo` 读取题名和作者，其余复本信息来自 holdings。

南大校园网/WebVPN smoke 必须确认四个 endpoint、envelope 与字段在 `opac.nju.edu.cn` 部署上完全一致；否则返回 `REMOTE_SCHEMA_CHANGED` 并修订唯一 contract，不能并排保留多个自动 fallback client。

### 写操作

续借与预约的真实南大 mutation endpoint、资格校验和 readback 尚未捕获，证据为 `pending`。MVP 不注册 `library renew/reserve`，也不会发送猜测的 POST。

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

固定请求头为公开前端协议中的 `app-key`、毫秒 `timestamp`、`sign` 和 `cgAuthorization`。签名按已观察顺序对 path、排序后的非空参数、timestamp 与公开客户端常量计算 MD5；测试覆盖参数排序、空值和已知结果。公开 app key 与签名常量不是用户 secret，但仍以 contract 常量集中管理。

唯一 `SportsClient` 使用：

```text
GET /api/reservation/campus/venue/info
GET /api/front/website/venue_sites/{venueSiteId}
GET /api/reservation/day/info?venueSiteId=...&searchDate=...&hasReserveInfo=1
GET /api/orders/mine?page=...&size=...
GET /api/orders/{orderId}
```

证据为 `nju-live-authenticated + reference-code + fixture`，但 V1 完成后仍需用真实账号复核 token 生命周期、角色选择、实时余量和订单状态。

`day/info` parser 输出日期、时间段、space 名称和预约状态。文本展示只统计解析为 `available` 的具体 space，不读取模糊页面文案。

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

V1 为八个 source 分别固定 HTTPS origin、section、列表 selector、详情 selector 和允许的文章路径：

| source | origin | 当前证据 |
|---|---|---|
| `nju` | `https://www.nju.edu.cn/` | `nju-live-public + fixture` |
| `academic-affairs` | `https://jw.nju.edu.cn/` | `nju-live-public + fixture` |
| `graduate-school` | `https://grawww.nju.edu.cn/` | `nju-live-public + fixture` |
| `graduate-admission` | `https://yzb.nju.edu.cn/` | `nju-live-public + fixture` |
| `itsc` | `https://itsc.nju.edu.cn/` | `nju-live-public + fixture` |
| `youth-league` | `https://tuanwei.nju.edu.cn/` | `VPN_REQUIRED + fixture` |
| `research` | `https://scit.nju.edu.cn/` | `nju-live-public + fixture` |
| `asset-management` | `https://zcc.nju.edu.cn/` | `nju-live-public + fixture` |

当前公开 smoke 已确认各 source 的列表契约可以获得非空数据；详情 smoke 在七个可直连来源通过，团委来源当前按网络门禁返回 `VPN_REQUIRED`。HTML fixtures 另覆盖空列表、结构变化和跨 host 文章链接。跨 host 链接会被跳过，不会由当前 source parser 跟随抓取。

## 输出与测试证据

所有远端 client 都将 HTTP/业务错误映射为稳定 `AppError`；JSON 输出统一包装为 `{ ok: true, data }` 或 `{ ok: false, error }`。Cookie、JWT、CAS ticket、验证码、密码和常见身份字段由结构化脱敏器处理。

当前回归套件覆盖：

1. account、session metadata、capability 依赖、刷新策略和 Playwright browser context。
2. campus 八个 parser 的成功、空数据、schema drift、VPN 与跨站链接。
3. course 学期与课表 envelope、周次展开、日期窗口、下一节课和 ICS。
4. OPAC search/book/holdings/loans fixtures 和 403 网络门禁。
5. sports token 交换、签名、场馆/场地/余量/订单 fixtures。
6. CLI 参数路由、帮助、JSON envelope，以及 MCP 只读工具复用同一 service。

进入南大“已实网可用”结论前仍需保存不含真实学号、姓名、Cookie、JWT 或验证码的 smoke 记录。特别是 OPAC 只能在校园网/WebVPN 验证后升级证据等级；同产品族实例与 fixtures 不能替代该步骤。

## 新契约准入

后续每个远端契约至少需要：

1. 一个脱敏成功 fixture。
2. 一个未登录、无权限或网络门禁 fixture。
3. 一个字段缺失/schema drift fixture。
4. 一个明确的认证 capability 与单一 client。
5. mutation 的显式确认、唯一提交请求、人工挑战边界和 readback 标识。

研究生课表、EHall 待办/流程、成绩与培养方案、研究生选课、交换项目和邮箱在满足上述条件前维持 `pending`，不注册空壳命令。
