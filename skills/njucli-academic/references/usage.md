# 研究生教务操作

```bash
node "$SKILL_DIR/scripts/run.mjs" academic grades --format json
node "$SKILL_DIR/scripts/run.mjs" academic exams --format json
node "$SKILL_DIR/scripts/run.mjs" academic schedule --format json
node "$SKILL_DIR/scripts/run.mjs" academic plan --format json
```

学期标识来自官方结果，省略 --term 时采用接口默认学期。交付真实成绩、考试安排和培养方案；数据缺失时展示学校返回的状态。

