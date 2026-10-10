# 校园服务接口

简短接口资料集中在本页，较长资料保存在所属 Skill。修改远端请求时同步对应说明。

| 能力 | 资料 |
| --- | --- |
| 统一认证 | [登录与会话](#统一认证) |
| 教务与办事大厅 | [课表、选课、成绩、考试、培养方案及行程登记](../skills/njucli-ehall/references/interfaces.md) |
| 软件学院课程 | [课程、作业、名单与成绩](#软件学院课程) |
| TeX | [项目、文件、编辑与编译](../skills/njucli-tex/references/interfaces.md) |
| 图书馆 | [书目、馆藏与借阅](#图书馆) |
| 体育场馆 | [场馆、时段与预约记录](#体育场馆) |
| 校园信息 | [新闻、通知与食堂](#校园信息) |
| 正版软件 | [目录与安装包](#正版软件) |
| 校园邮箱 | [绑定、邮件与附件](#校园邮箱) |
| 青年平台 | [活动、志愿时长与第二课堂](../skills/njucli-youth/references/interfaces.md) |
| 协同表格 | [表格、记录、公式与视图](../skills/njucli-table/references/interfaces.md) |
| 南大云盘 | [资料库、文件、分享与协作](../skills/njucli-box/references/interfaces.md) |

本地检查见[贡献指南](../CONTRIBUTING.md#实现约定)。各节记录对应的实网验证范围；远端写入使用用户指定的目标和材料。

## 统一认证

登录入口为[南大统一身份认证](https://authserver.nju.edu.cn/authserver/login)。各站点的登录与会话探测集中在 `src/auth/`，业务复用同一账号的会话；账号与会话操作见[认证 Skill](../skills/njucli-auth/SKILL.md)。

SSO 的 CAS `service` 使用 EHall `/login?service=https%3A%2F%2Fehall.nju.edu.cn%2Fywtb-portal%2Fofficial%2Findex.html`。CAS 签发本次服务票据后回跳至该入口，由 EHall 建立本站 Cookie，最终到达 `/ywtb-portal/official/index.html`。登录、状态与维护以 `/jsonp/userInfo.json` 的 `hasLogin: true` 回读结果为成功条件。根会话由 `CASTGC` 标识，EHall 使用 `MOD_AUTH_CAS`；Cookie 由当次 HTTP 或浏览器 context 更新并保存。

已实网核对 CAS 到 EHall 的会话交换、Cookie 跨进程保存，以及同一后台进程的连续维护和停止清理。自然过期后的恢复、休眠恢复、跨学校会话最长有效期的持续运行仍待实网核对。后台命令与配置见[后台保活](../skills/njucli-auth/SKILL.md#后台保活)。

校内实测 [p.nju 上网认证页面](https://p.nju.edu.cn/portal/index.html)使用 `GET /api/portal/v1/getinfo` 读取当前网络账号，`GET /api/portal/v1/ipoeonline` 读取网络接入状态。无 Cookie 请求可返回本人网络身份；这两个响应未包含 token 或设置 Cookie。以全新会话访问 CAS 仍进入登录表单，目前尚未确认从网络身份兑换 CAS 会话的接口。后台保活沿用已验证的 CAS 与 EHall 流程。

## 软件学院课程

[软件学院教学支持系统](https://selearning.nju.edu.cn/)使用 Moodle，以下路径相对本站。

| 路径 | 用途 |
| --- | --- |
| `/my/`、`/course/index.php`、`/course/search.php` | 我的课程、分类目录与搜索 |
| `/course/view.php?id=COURSE_ID` | 课程章节与活动 |
| `/user/index.php?id=COURSE_ID&page=N&perpage=20` | 课程名单；接口页码从 0 开始，CLI 从 1 开始 |
| `/mod/assign/view.php?id=ACTIVITY_ID` | 作业要求、提交状态与附件 |
| `/grade/report/index.php?id=COURSE_ID` | 课程成绩 |
| `/enrol/index.php?id=COURSE_ID` | 自助选课表单 |

附件使用详情返回的同源 `/pluginfile.php/` 链接。自助选课保留表单隐藏字段，按 [Moodle 选课规则](https://github.com/moodle/moodle/blob/v3.10.8/enrol/index.php)核对跳转后的课程。已核对登录后的作业和成绩页面、名单分页及权限错误；附件下载和自助选课真实提交待验收。

## 图书馆

[图书馆官网](https://lib.nju.edu.cn/)的纸本检索和“我的图书馆”指向 [OPAC](https://opac.nju.edu.cn/)，当前为图星/超星平台。2026-10-10 在校园网中依据官网实际请求、响应及页面核对以下契约。请求头携带南大的 `groupCode: 200027`，成功以 `success: true` 为准；成功响应的 `errCode` 包括 200、80000、9000065 等业务码。

| 请求 | 参数与结果 |
| --- | --- |
| `POST /find/unify/indexSearch` | `searchFieldContent/searchField/matchMode/page/rows/indexSearch`；返回 `numFound/searchResult`，书目 ID 为 `recordId` |
| `POST /find/unify/getPItemAndOnShelfCountAndDuxiuImageUrl` | `items: [{ recordId, title, isbn }]`；按 ID 返回 `pCount/onShelfCount`，供检索结果显示实时数量 |
| `GET /find/searchResultDetail/getDetail?recordId=` | `clearTitle/authorOther` |
| `POST /find/physical/groupitems` | `recordId/page/rows/isUnify/sortType/callNo/entrance`；返回 `totalCount/list`，逐页读取全部馆藏 |
| `GET /oga/userinfo` | 通过 `userId` 确认读者会话；个人资料仅用于探测 |
| `POST /find/loanInfo/loanList` | `page/rows/searchType/searchContent/sortType/startDate/endDate`；返回 `searchResult`，应还日期为 `normReturnDate` |

检索字段 `all/title/author/isbn/callno` 分别映射 `keyWord/title/author/isbn/callNo`；匹配方式分别为 `2/2/1/1/3`。分页从 1 开始。馆藏使用 `libName/locationName/shelfNo/processType`，同时满足在架 `processTypeCode=411` 和可借 `circAttr=0` 时标记可借。检索数量按官网的第二次批量查询刷新；馆藏详情汇总本次逐册结果。

书目与馆藏直接访问 OPAC。读者登录依赖 SSO，CAS service 为 `http://opac.nju.edu.cn:8081/CASSSO2/caslogin.jsp`；官网页面完成回跳并写入 `jwt` Cookie 后，以 `jwtOpacAuth` 请求头回读 `/oga/userinfo`。Cookie 经共享 `BrowserSession`、账号锁和原子文件保存，后续借阅调用复用当次会话；令牌字段在输出边界脱敏。

实网通过五种检索字段、检索翻页和空结果、书目详情、8 册及跨页 90 册馆藏、读者登录、跨进程探测和当前借阅空列表。统一 CLI、独立 Skill 与两套 MCP 查询均已核对。正数借阅及逾期映射由本地集成验证。运行前提见[HTTPS 配置](../skills/njucli-library/references/network.md)，原始现象和截图见[校园网验证报告](reports/2026-10-10-intranet.md)。

## 体育场馆

来源为[南大体育场馆系统](https://ggtypt.nju.edu.cn/venue/)，接口参考 `nju-cli/nju-cli` 的场馆实现。当前请求定义见 [场馆 client](../skills/njucli-sports/scripts/client.ts)。以下路径相对 `https://ggtypt.nju.edu.cn/venue-server`，请求均为 GET，响应 `code=200` 时读取 `data`。

| 路径 | 主要参数或字段 |
| --- | --- |
| `/api/reservation/campus/venue/info` | `sportType`；结果 `venueSiteInfo` |
| `/api/front/website/venue_sites/{id}` | 场地详情 |
| `/api/reservation/day/info` | `venueSiteId/searchDate/hasReserveInfo=1`；结果 `spaceTimeInfo/reservationDateSpaceInfo` |
| `/api/orders/mine`、`/api/orders/{id}` | 订单列表与详情；列表分页从 0 开始 |

请求携带 `cgAuthorization` 和 `scripts/signing.ts` 生成的签名。时段状态来自 `reservationStatus`，CLI 输出为 `state`。2026-10-10 实网通过 35 个场地列表、场地详情、当日 7 个时段、14 条预约列表与可读取的预约详情。列表中的两条记录在详情接口返回学校的归属校验拒绝；CLI 保留该错误。官网详情按钮指向的记录已核对。具体查询与权限范围见[校园网验证报告](reports/2026-10-10-intranet.md)。

## 校园信息

信息源涵盖南京大学、本科生院、研究生院、研究生招生、信息化中心、团委、科研和资产管理网站；地址与栏目路径集中在 `skills/njucli-campus/scripts/sources/`。列表与正文读取 HTML，文章 ID 与来源、栏目绑定。食堂名称和电话来自[后勤服务页](https://www.nju.edu.cn/xyfw/hqfw.htm)的“膳食中心”表格。

七个可直连来源的列表与详情已核对；2026-10-10 追加通过团委通知列表（14 条）、下一页标识与一篇正文的校园网实测。今日汇总复用课表、借阅和体育查询。

## 正版软件

来源为[南大正版软件目录](https://itsc.nju.edu.cn/zbrj/list.htm)、[Adobe 离线包](https://itsc.nju.edu.cn/0e/53/c50138a593491/page.htm)和 [Adobe CC 直接下载页](https://helpx.adobe.com/cn/download-install/apps/download-install-apps/creative-cloud-apps/download-creative-cloud-desktop-app-using-direct-links.html)。安装包从页面的 HTTPS 链接取得，下载主机为 `download.nju.edu.cn`、`ccmdl.adobe.com` 或 `ccmdls.adobe.com`。

目录、链接及 Adobe CC `macarm64` 下载已实网验证；2026-10-10 追加通过校内 MathType 英文安装包完整下载（45,413,408 字节），文件头为 Windows PE，保存权限为 0600。

## 校园邮箱

[南大邮箱](https://mail.nju.edu.cn/)使用 `imap.exmail.qq.com:993` TLS；客户端专用密码需配合官网 IMAP/SMTP 开关。查询使用 `EXAMINE/BODY.PEEK`，保持邮件已读状态。邮件 ID 编码邮箱地址、邮件夹、`uidValidity` 与 UID，正文和附件按 ID 定位所属邮箱；附件编号从 1 开始。

两个真实邮箱的绑定、切换、分页、搜索和正文已验证。真实附件下载及自动生成专用密码的完整绑定向导待实网验收。

## 校医院接入评估

[医院官网](https://hospital.nju.edu.cn/)的“自助服务”指向 [自助服务平台](https://ndyy.nju.edu.cn/zzfw/)。2026-10-10 已通过 `/zzfw/asLogin.aspx` 复用 SSO，回到 `/zzfw/Pages/Default.Aspx`，并读取 `/zzfw/ashx/PageInit.ashx` 的 `homeInfo/menuInfo`。实际菜单包括体检、疫苗、急救课程、活动和结核筛查预约，以及报告、大学生医保入口。

独立 `njucli-hospital` Skill 可以按既有结构接入，认证能力由 SSO 派生。当前证据覆盖官网、认证和菜单；业务列表字段、报告下载与预约提交的接口仍需逐项核对。建议的首批功能和具体边界见[接入评估](reports/2026-10-10-intranet.md#校医院)。
