---
name: njucli-sports
description: 查询南京大学体育场馆、预约时段及本人订单，读取确认信息、提交指定预约、确认零元订单或取消预约。用户涉及体育馆预约或 njucli sports 时使用。
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

## 指定预约的原子动作

```bash
njucli sports reservation-info --input ./所选时段.json --format json
njucli sports reserve --input ./预约提交.json --format json
njucli sports finance TRADE_NO --format json
njucli sports confirm-free TRADE_NO --format json
njucli sports cancel TRADE_NO --reason "用户要求取消" --format json
```

确认信息输入：

```json
{
  "venueSiteId": "来自 venues 的 siteId",
  "date": "2026-10-23",
  "weekStartDate": "来自 slots 的 reservationDates[0]",
  "slots": [{ "spaceId": "来自时段", "timeId": "来自时段" }]
}
```

全场预约可按官方返回值加 `reservationType` 和每项 `venueSpaceGroupId`。`reservation-info` 只读所选时段的确认信息，不创建订单。

`reserve` 使用相同字段，另须提供确认信息中的 `totalAmt`、`orderPrice`（数字或 null），及官方页面生成的 `orderPin`。可选 `phone`、`addBuddyType`、`buddyIds`、`buddyUids`、`manNum`、`childNum`、`sportType`；学校要求人机验证时，提供官方验证成功返回的 `captchaVerification`、`captchaToken`。验证必须由用户在官方页面完成。提交只创建指定预约，不自动挑选时段、添加同伴或确认付款。结果包含 `tradeNo` 与业务回读。

`confirm-free` 先读取订单，仅接受学校实际 `payFee=0` 的订单，并回读确认状态。`cancel` 读取本人财务订单后请求取消，再回读取消状态；不会自动取消其他记录。

联系电话优先由 AI 使用当前上下文的 `profile.phone` 填写；NJUWeb/Runner 已按账号注入个人资料。需要官方验证码时，向用户索取当前验证码并回填，不重复询问已知手机号。

当前实网已验证时段、本人订单过滤、本人订单及财务详情。确认信息 POST 实际跳转到学校 `/venue/404` 页面，尚未取得业务结果；预约创建、零元确认、取消也未取得成功结果：验证时已无可预约时段，次日尚未开放，且场馆要求官方验证码。详见[接口与验证边界](references/interfaces.md)。MCP 提供对应的 `sports_reservation_info`、`sports_reserve`、`sports_finance`、`sports_confirm_free`、`sports_cancel`。
