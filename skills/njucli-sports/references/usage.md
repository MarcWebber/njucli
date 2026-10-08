# 体育场馆操作

```bash
node "$SKILL_DIR/scripts/run.mjs" sports venues --format json
node "$SKILL_DIR/scripts/run.mjs" sports slots --venue-site VENUE_ID --date YYYY-MM-DD --format json
node "$SKILL_DIR/scripts/run.mjs" sports bookings --format json
node "$SKILL_DIR/scripts/run.mjs" sports reserve-link --venue-site VENUE_ID --date YYYY-MM-DD --format json
```

VENUE_ID 来自 venues，日期按南京当地日期填写。预约编号来自 bookings。reserve-link 和 cancel-link 返回官方办理入口，用户在学校页面完成相应步骤；查询和入口返回分别说明结果。

