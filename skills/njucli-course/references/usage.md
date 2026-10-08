# 课表与选课操作

```bash
node "$SKILL_DIR/scripts/run.mjs" course terms --format json
node "$SKILL_DIR/scripts/run.mjs" course today --format json
node "$SKILL_DIR/scripts/run.mjs" course week --format json
node "$SKILL_DIR/scripts/run.mjs" course export ./schedule.ics --format json
node "$SKILL_DIR/scripts/run.mjs" course available --kind public --format json
node "$SKILL_DIR/scripts/run.mjs" course selected --format json
```

term-id 来自 terms；选课 class-id 来自 available，退课 class-id 来自 selected。用户明确指定课程后，调用 course select CLASS_ID 或 course withdraw CLASS_ID，单次提交并读取返回结果。对提示提交失败或回读失败的操作，先查询 selected 核对现状。日历导出到用户指定位置。

