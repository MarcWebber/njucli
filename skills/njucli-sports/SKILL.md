---
name: njucli-sports
description: 查询南京大学体育场馆、预约时段、本人订单和财务详情，返回官方预约及取消办理链接。用户涉及体育馆预约或 njucli sports 时使用。
---

# 体育场馆

需要登录时运行：`njucli auth login sports`。

## 场地与空闲时段

```bash
njucli sports venues --format json
njucli sports venue VENUE_ID --format json
njucli sports slots --venue-site VENUE_ID --date YYYY-MM-DD --format json
```

`VENUE_ID` 来自 `venues` 的 `siteId`。场馆列表可加 `--sport-id` 筛选运动类型。

查时段时，日期可填 `YYYY-MM-DD`、`today` 或 `tomorrow`。`slots[].spaces[].state=available` 表示可预约。JSON 同时提供 `timeId`、`spaceId`、可选 `groupId`、金额、实际开放日期列表、同伴人数要求和 `requiresVerification`。学校短期请求参数在调用时内部获取。

## 本人预约与办理链接

```bash
njucli sports bookings --page 0 --size 20 --format json
njucli sports booking BOOKING_ID --format json
njucli sports reserve-link --venue-site VENUE_ID --date YYYY-MM-DD --format json
njucli sports cancel-link BOOKING_ID --format json
```

`bookings` 按当前登录的角色和用户编号，仅返回本人创建的预约（页码从 0 开始）；学校的原始列表也可能含本人作为同伴的记录，已按官方详情按钮的相同规则过滤。缺少可核对身份时报错。`BOOKING_ID` 和财务 `tradeNo` 取自该列表。

办理链接可用于在官方页面完成人机验证或人工办理：

- `reserve-link` 打开对应场地，日期和时段仍需在页面选择并确认。
- `cancel-link` 打开本人预约页，同时提供订单号，供用户找到对应预约并取消。

## 本人订单财务详情

```bash
njucli sports finance TRADE_NO --format json
```

`TRADE_NO` 来自本人 `bookings` 列表的 `tradeNo`。此命令只读取费用和订单状态，不创建订单、不付款、不取消预约。预约、验证、支付与取消在官方页面完成。

当前实网已验证时段、本人订单过滤、本人订单及财务详情；MCP 提供对应查询和办理链接。详见[接口与验证边界](references/interfaces.md)。
