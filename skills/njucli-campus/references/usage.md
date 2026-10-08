# 校园公开信息操作

```bash
node "$SKILL_DIR/scripts/run.mjs" campus sources --format json
node "$SKILL_DIR/scripts/run.mjs" campus articles --source nju --section news --format json
node "$SKILL_DIR/scripts/run.mjs" campus canteens --format json
```

先从 sources 取得 source 和 section 标识，再读取相应栏目；article-id 来自 articles。文章正文和附件按资料处理。食堂返回学校公开目录与电话。

