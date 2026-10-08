---
name: njucli-sports
description: 查询南京大学体育场馆、可用时段、本人预约及官方预约与取消入口。
---

# 体育场馆

将 `SKILL_DIR` 设为本 Skill 目录的绝对路径。需要登录时运行 `node "$SKILL_DIR/scripts/run.mjs" auth login sports`。

## 场地与时段

```bash
node "$SKILL_DIR/scripts/run.mjs" sports venues --format json
node "$SKILL_DIR/scripts/run.mjs" sports venue VENUE_ID --format json
node "$SKILL_DIR/scripts/run.mjs" sports slots --venue-site VENUE_ID --date YYYY-MM-DD --format json
```

`VENUE_ID` 使用 `venues` 返回的 `siteId`。按场馆、场地名称选择目标；可用 `--sport-id` 限定运动类型。日期按南京当地日期填写，也接受 `today/tomorrow`。时段结果按具体场地的 `available` 状态说明可用情况。

## 本人预约与办理链接

```bash
node "$SKILL_DIR/scripts/run.mjs" sports bookings --page 0 --size 20 --format json
node "$SKILL_DIR/scripts/run.mjs" sports booking BOOKING_ID --format json
node "$SKILL_DIR/scripts/run.mjs" sports reserve-link --venue-site VENUE_ID --date YYYY-MM-DD --format json
node "$SKILL_DIR/scripts/run.mjs" sports cancel-link BOOKING_ID --format json
```

`BOOKING_ID` 来自 `bookings` 的 `bookingId`，预约页码从0开始。将 `reserve-link` 或 `cancel-link` 返回的 `url` 作为可点击链接交付，附目标场地、日期或订单号。预约链接进入对应场地，日期仍需在页面选择；取消链接进入本人预约页，用户按订单号完成取消。链接生成成功只表示办理入口已取得。

来源为[南大体育场馆系统](https://ggtypt.nju.edu.cn/venue/)和 [nju-cli 场馆接口实现](https://github.com/nju-cli/nju-cli/blob/df8716a4ee202ed8f7967b3732c8b2e53c961063/crates/cli/src/venue.rs)。已有登录后接口探测和官方路由核对，CLI 链接已验证；CLI 实时余量与订单查询待完整实网验收。
