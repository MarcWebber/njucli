---
name: njucli-itxia
description: 通过南京大学 IT 侠官网提交电脑维修预约，按预约单编号或姓名、手机号查询当前预约状态、处理人和回复。用户需要 IT 侠预约或进度查询时使用。
---

# IT 侠维修预约

官网入口：[IT 侠预约系统](https://itxia.nju.edu.cn/custom/order)。以下命令在本 Skill 目录运行，统一 CLI 使用 `njucli itxia ...`。预约使用表单信息直接提交，查询使用预约单编号或预约时的姓名、手机号。

## 创建预约

先阅读[预约须知](references/reservation-notice.md)和[服务条款](references/service-terms.md)，向用户说明适用要求，并依据用户提供的信息准备 JSON 文件。提交需要用户授权这次预约并同意条款；已有明确授权时直接执行。

```json
{
  "name": "本人姓名",
  "phone": "本人手机号",
  "email": "本人邮箱",
  "campus": "XIANLIN",
  "brandModel": "电脑品牌与具体型号",
  "os": "操作系统及版本",
  "freeTime": "周三-14:00到16:00，周五-19:00到21:00",
  "description": "故障现象、持续时间、复现频率、此前操作；偏好邮件联系。"
}
```

以上字段全部必填。`campus` 使用 `XIANLIN`（仙林）、`GULOU`（鼓楼）或 `SUZHOU`（苏州）。可选字段为 `qq`、`warranty`（保修情况文本），以及 `acceptEmailNotification`（邮件提醒，默认 `true`）；QQ 和保修情况省略或填 `null`。鼓楼用户在问题描述中补充宿舍楼或办公室位置，尤其是台式机。

```bash
node scripts/run.mjs itxia create --input /path/to/order.json --agree-terms --format json
```

成功结果包含回读后的预约单 `id`、状态，以及打开预约单页面所需的 `url`、`openScript` 和 `retrieveUrl`。创建成功后，回复用户时必须同时给出预约单编号和打开方法：

- 预约单页面 `url`（https://itxia.nju.edu.cn/custom/order）。官网按浏览器 `localStorage.requestedOrderId` 展示预约单，提交预约的同一浏览器可直接打开该链接。
- 其他浏览器：在任一 itxia.nju.edu.cn 页面打开开发者工具控制台，运行 `openScript` 后即进入本单页面。
- 或在 `retrieveUrl`（https://itxia.nju.edu.cn/custom/retrieve）填写预约时的姓名和手机号找回本单。

`node scripts/run.mjs itxia open ORDER_ID` 离线输出上述链接与方法。保存该编号供后续查询。提交结果不明时，先用姓名和手机号找回；返回编号后回读失败时，按错误中的 `orderId` 查询，核对本单再决定下一步。个人预约信息文件放在用户指定的私人目录，预约单编号按个人信息保管。

## 取消预约

取消后无法恢复。仅在用户针对指定预约单明确确认取消后执行，并带上 `--yes`：

```bash
node scripts/run.mjs itxia cancel ORDER_ID --yes --format json
```

成功后返回回读的预约详情，`status` 为 `CANCELED`。已被接单的预约可能取消失败，此时先查询状态，再告知用户联系 IT 侠。

## 查询进度

已有预约单编号：

```bash
node scripts/run.mjs itxia status ORDER_ID --format json
```

找回官网当前预约：

```bash
node scripts/run.mjs itxia status --name "预约时的姓名" --phone "预约时的手机号" --format json
```

查询返回打开链接（`url`、`openScript`、`retrieveUrl`）、`status`、`statusText`、处理人 `handler`、回复记录 `replies` 和预约详情；回复包含发送者、时间、正文和附件信息。进度以官网当前状态和回复为依据，接单及维修时间以 IT 侠联系结果为准。

| 状态 | 含义 |
| --- | --- |
| `PENDING` | 待接单 |
| `HANDLING` | 处理中 |
| `DONE` | 已完成 |
| `CANCELED` | 已取消 |

只读 MCP 提供 `itxia_status`（`id`）和 `itxia_retrieve`（`name`、`phone`）；提交预约使用 CLI。接口依据与实网验证范围见[接口说明](references/interfaces.md)。
