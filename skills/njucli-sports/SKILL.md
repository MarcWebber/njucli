---
name: njucli-sports
description: 查询南京大学体育场馆场地、可用空闲时段与本人预约，获取官方预约与取消办理链接。用户涉及体育馆预约或 njucli sports 时使用。
---

# 体育场馆

以下命令在本 Skill 目录运行。需要登录时运行：`node scripts/run.mjs auth login sports`。

## 场地与空闲时段

```bash
node scripts/run.mjs sports venues --format json
node scripts/run.mjs sports venue VENUE_ID --format json
node scripts/run.mjs sports slots --venue-site VENUE_ID --date YYYY-MM-DD --format json
```

`VENUE_ID` 来自 `venues` 的 `siteId`。场馆列表可加 `--sport-id` 筛选运动类型。

查时段时，日期可填 `YYYY-MM-DD`、`today` 或 `tomorrow`。具体场地的 `slots[].spaces[].state` 为 `available` 时表示可预约。

## 本人预约与办理链接

```bash
node scripts/run.mjs sports bookings --page 0 --size 20 --format json
node scripts/run.mjs sports booking BOOKING_ID --format json
node scripts/run.mjs sports reserve-link --venue-site VENUE_ID --date YYYY-MM-DD --format json
node scripts/run.mjs sports cancel-link BOOKING_ID --format json
```

`bookings` 查询个人预约列表（页码从 0 开始）；`BOOKING_ID` 取自其 `bookingId`。

预约和取消通过官方网页办理。将命令返回的 `url` 作为可点击链接交给用户：

- `reserve-link` 打开对应场地，日期和时段仍需在页面选择并确认。
- `cancel-link` 打开本人预约页，同时提供订单号，供用户找到对应预约并取消。
