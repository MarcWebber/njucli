# IT 侠接口说明

## 来源与请求

2026-10-11 核对[官网预约入口](https://itxia.nju.edu.cn/custom/order)及该页加载的官方前端资源 `/assets/index-BoivVo4q.js`。预约须知与条款来自用户提供的正文，并与 `GET /api/custom/announcement` 返回的公告正文核对；条款实施日期为 2026-05-04。

同时参考 IT 侠官方公开的历史后端：[预约模型](https://github.com/NJU-itxia/MakeItxiaGreatAgain/blob/master/projects/api-service/src/main/kotlin/cn/itxia/api/model/Order.kt)和[预约服务](https://github.com/NJU-itxia/MakeItxiaGreatAgain/blob/master/projects/api-service/src/main/kotlin/cn/itxia/api/service/OrderService.kt)。该公开仓库最后推送于 2022 年，作为历史字段证据；当前表单与路径以部署中的前端及实网响应为准。历史订单的邮箱允许为空，查询结果保留为 `null`；新建预约按当前表单要求填写邮箱。

API 根地址为 `https://itxia.nju.edu.cn/api`。官方前端使用 JSON 请求，带 `Content-Type: application/json` 和 `itxia-from: https://itxia.nju.edu.cn`。访客预约流程使用表单信息和预约单编号，独立于校园 SSO。响应结构为 `{ code, message, payload }`，`code = 0` 表示业务成功；查询 `code = 8` 表示无此预约单，CLI 输出 `NOT_FOUND`。

| 动作 | 请求 | 成功结果 |
| --- | --- | --- |
| 创建预约 | `POST /custom/order` | `payload._id` 为预约单编号，随后 `GET /custom/order/{id}` 回读 |
| 查询进度 | `GET /custom/order/{id}` | `payload` 为预约详情，含状态、处理人和回复 |
| 取消预约 | `PUT /custom/order/{id}/cancel`，无请求体，请求头同上 | `code = 0` 后回读详情，`status` 为 `CANCELED`；已被接单时官网提示可能取消失败 |
| 找回当前预约 | `POST /custom/order/retrieve`，JSON `{ name, phone }` | `payload` 为编号字符串，随后按编号查询详情 |

找回接口是查询动作，返回官网选定的当前预约单。用户提供本人预约单编号，或预约时的姓名和手机号。官网前端将当前编号保存在 `localStorage.requestedOrderId`；CLI 通过命令参数传入，使用返回的 `id` 继续查询。

## 提交字段

| 字段 | 契约 |
| --- | --- |
| `agreement` | 用户同意条款后，由 `--agree-terms` 对应为 `true` |
| `name`、`phone`、`email` | 姓名、手机号、邮箱，均必填；手机号沿用官方表单的号段正则 |
| `campus` | `XIANLIN`、`GULOU`、`SUZHOU` |
| `brandModel`、`os` | 品牌型号、操作系统，均必填 |
| `freeTime`、`description` | 空闲时间与问题描述，均必填 |
| `qq`、`warranty` | 可选；省略时提交 `null`；QQ 沿用官网 5–11 位、首位非零的校验 |
| `acceptEmailNotification` | 邮件提醒布尔值，默认 `true`，与官网一致 |
| `attachments` | 本能力提交文本预约，发送空数组 |

创建请求执行一次，再按返回的稳定编号回读并核对姓名、手机、邮箱、校区、型号、系统、问题描述和空闲时间。回读异常返回错误，同时给出 `orderId` 与查询提示。网络、HTTP、解析和业务异常交给统一输出边界，后续动作由调用 Agent 决定。

## 详情与状态

预约详情使用 `_id/status/name/phone/email/campus/brandModel/os/description/freeTime/createTime`；处理人使用 `handler.realName`，回复使用 `reply[].postBy.realName/createTime/content/attachments`。官网对空闲时间设有空值展示，历史预约的 `freeTime` 允许缺省或为空。回复作者为空时，官网将其视为预约者。附件保留 `_id/fileName/mimeType/size`。

官网前端路由仅有 `/custom/home`、`/custom/order`、`/custom/retrieve`，均不携带编号；预约单页由 `localStorage.requestedOrderId`（JSON 编码的字符串）决定展示哪一单，该值在提交成功或找回成功后写入，页面加载时据此请求 `GET /custom/order/{id}`。CLI 在创建、查询结果中输出 `url`（`/custom/order`）、`openScript`（写入该键并跳转的控制台代码）和 `retrieveUrl`（`/custom/retrieve`）；`itxia open` 离线输出同样内容。2026-10-13 已用无头浏览器验证：写入编号后打开 `/custom/order` 显示对应预约单。

`PENDING/HANDLING/DONE/CANCELED` 分别对应待接单、处理中、已完成、已取消。CLI 将 `_id` 输出为 `id`，`reply` 输出为 `replies`，并增加 `statusText` 和 `campusName`。文本输出展示状态、处理人、问题描述与回复记录。

## 验证范围

| 层次 | 范围 |
| --- | --- |
| 官方前端契约 | 已核对创建表单、字段校验、创建及查询路径、找回响应类型、四种状态、处理人和回复字段 |
| 公开实网 | 预约页面与公告返回成功；合成的无效编号和无效身份查询均返回 HTTP 200、`code = 8`，请求使用访客身份；构建后的两种 CLI 查询均输出 `NOT_FOUND`，退出码为 1 |
| 源码与本地集成 | `pnpm lint` 通过，同步最新主分支后，`pnpm test` 的 38 项用例全部通过；本机 HTTP 覆盖提交与回读、四种状态、文本与 JSON 回复展示、姓名手机号找回、参数校验和失败单次请求；13 个独立 Skill 与 93 个只读 MCP 工具接线一致 |
| 打包与安装 | `npm pack --dry-run` 包含独立入口和参考资料；实际 tarball 安装到临时目录后，统一 CLI 与独立 IT 侠入口的帮助检查通过 |
| 个人预约实网 | 真实创建、已有单成功查询与后置回读待用户指定维修材料和预约目标后验收 |

本轮实网核对仅包含公开读取与合成无效条件查询。真实提交使用用户授权的维修需求与联系方式。
