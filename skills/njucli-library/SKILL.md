---
name: njucli-library
description: 查询南京大学图书馆馆藏、馆藏位置、可借状态与本人借阅。
---

# 图书馆

将 `SKILL_DIR` 设为本 Skill 目录的绝对路径。检索和馆藏通过官方 WebVPN，本人借阅需要读者登录；按命令提示通过同一脚本执行 `auth login vpn` 或 `auth login opac`。

```bash
node "$SKILL_DIR/scripts/run.mjs" library search "关键词" --format json
node "$SKILL_DIR/scripts/run.mjs" library search "书名" --field title --page 1 --page-size 20 --format json
node "$SKILL_DIR/scripts/run.mjs" library book BOOK_ID --format json
node "$SKILL_DIR/scripts/run.mjs" library holdings BOOK_ID --format json
node "$SKILL_DIR/scripts/run.mjs" library loans --format json
```

`BOOK_ID` 使用 `search` 返回的 `bookId`。`--field` 可选 `all/title/author/isbn/callno`；省略时检索全部字段。先查书目，再读取馆藏位置与可借状态；本人借阅返回应还日和逾期状态。向用户交付题名、索书号、馆藏位置及查询结果。

[图书馆官网](https://lib.nju.edu.cn/)的纸本检索和“我的图书馆”指向 `opac.nju.edu.cn`。实现使用汇文 `meta-local` 检索、书目、馆藏和借阅接口，参考 [WUST Library Mini Program](https://github.com/LingHangStudio/wust-library-mini-program) 对应实例；同产品接口已验证，南大部署仍待校园网实测。直连出现 `VPN_REQUIRED` 时，按学校要求完成网络连接后查询。
