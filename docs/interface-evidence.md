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

本地检查见[构建验证](skill-layout.md#验证)，学校服务的实际验证范围见[验收记录](design-v1.md#验收记录)。

## 统一认证

登录入口为[南大统一身份认证](https://authserver.nju.edu.cn/authserver/login)。各站点的登录与会话探测集中在 `src/auth/`，业务复用同一账号的会话；账号文件、Cookie 保存和进程锁见[账号与认证](design-v1.md#账号与认证)。

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

[图书馆官网](https://lib.nju.edu.cn/)的纸本检索和“我的图书馆”指向 `opac.nju.edu.cn`。实现参考 [WUST Library Mini Program](https://github.com/LingHangStudio/wust-library-mini-program) 的汇文接口；南大部署仍待校园网实测。

| 请求 | 结果字段 |
| --- | --- |
| `POST /meta-local/opac/search/` | `actualTotal/dataList`；书目 ID 为 `bibId` |
| `GET /meta-local/opac/bibs/{id}/infos` | `map.baseInfo.map` |
| `GET /meta-local/opac/bibs/{id}/holdings` | `holdings` 为 JSON 字符串，`itemsAvailable` 判断可借数量 |
| `GET /meta-local/opac/users/loans?page=&pageSize=` | `dueDate/isOverdue` |

检索请求使用 JSON，分页从 1 开始；响应 `code` 为 0 或 200 时读取 `data`。检索和馆藏经 WebVPN，借阅另需读者登录。

## 体育场馆

来源为[南大体育场馆系统](https://ggtypt.nju.edu.cn/venue/)及 [nju-cli 场馆实现](https://github.com/nju-cli/nju-cli/blob/df8716a4ee202ed8f7967b3732c8b2e53c961063/crates/cli/src/venue.rs)。以下路径相对 `https://ggtypt.nju.edu.cn/venue-server`，请求均为 GET，响应 `code=200` 时读取 `data`。

| 路径 | 主要参数或字段 |
| --- | --- |
| `/api/reservation/campus/venue/info` | `sportType`；结果 `venueSiteInfo` |
| `/api/front/website/venue_sites/{id}` | 场地详情 |
| `/api/reservation/day/info` | `venueSiteId/searchDate/hasReserveInfo=1`；结果 `spaceTimeInfo/reservationDateSpaceInfo` |
| `/api/orders/mine`、`/api/orders/{id}` | 订单列表与详情；列表分页从 0 开始 |

请求携带 `cgAuthorization` 和 `scripts/signing.ts` 生成的签名。时段状态来自 `reservationStatus`，CLI 输出为 `state`。已有登录后接口探测、官方路由和 CLI 链接核对；实时余量与订单查询待完整实网验收。

## 校园信息

信息源涵盖南京大学、本科生院、研究生院、研究生招生、信息化中心、团委、科研和资产管理网站；地址与栏目路径集中在 `skills/njucli-campus/scripts/sources/`。列表与正文读取 HTML，文章 ID 与来源、栏目绑定。食堂名称和电话来自[后勤服务页](https://www.nju.edu.cn/xyfw/hqfw.htm)的“膳食中心”表格。

七个可直连来源的列表与详情已核对；团委来源在验证网络下要求 VPN。今日汇总复用课表、借阅和体育查询。

## 正版软件

来源为[南大正版软件目录](https://itsc.nju.edu.cn/zbrj/list.htm)、[Adobe 离线包](https://itsc.nju.edu.cn/0e/53/c50138a593491/page.htm)和 [Adobe CC 直接下载页](https://helpx.adobe.com/cn/download-install/apps/download-install-apps/creative-cloud-apps/download-creative-cloud-desktop-app-using-direct-links.html)。安装包从页面的 HTTPS 链接取得，下载主机为 `download.nju.edu.cn`、`ccmdl.adobe.com` 或 `ccmdls.adobe.com`。

目录、链接及 Adobe CC `macarm64` 下载已实网验证；校内安装包完整下载待校园网验收。

## 校园邮箱

[南大邮箱](https://mail.nju.edu.cn/)使用 `imap.exmail.qq.com:993` TLS；客户端专用密码需配合官网 IMAP/SMTP 开关。查询使用 `EXAMINE/BODY.PEEK`，保持邮件已读状态。邮件 ID 编码邮箱地址、邮件夹、`uidValidity` 与 UID，正文和附件按 ID 定位所属邮箱；附件编号从 1 开始。

两个真实邮箱的绑定、切换、分页、搜索和正文已验证。真实附件下载及自动生成专用密码的完整绑定向导待实网验收。
