# 图书馆操作

```bash
node "$SKILL_DIR/scripts/run.mjs" library search "关键词" --format json
node "$SKILL_DIR/scripts/run.mjs" library book BOOK_ID --format json
node "$SKILL_DIR/scripts/run.mjs" library holdings BOOK_ID --format json
node "$SKILL_DIR/scripts/run.mjs" library loans --format json
```

BOOK_ID 来自 search。检索和馆藏访问通过官方 WebVPN，本人借阅还需要读者登录。网络或登录要求按命令返回的提示完成，查询成功后交付题名、索书号、位置和借阅状态。

