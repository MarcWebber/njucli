# 今日校园安排操作

```bash
node "$SKILL_DIR/scripts/run.mjs" today --format json
node "$SKILL_DIR/scripts/run.mjs" today YYYY-MM-DD --format json
```

汇总复用课程、图书馆和体育的业务代码以及同一套认证会话。首次查询可能需要学校认证和图书馆读者登录；以返回的 date、course、library、sports 为本次结果。

