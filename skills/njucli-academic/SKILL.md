---
name: njucli-academic
description: 查询南京大学研究生成绩、考试、课表与培养方案。
---

# 研究生教务

学期标识来自官方结果，省略 --term 时采用接口默认学期。交付真实成绩、考试安排和培养方案；数据缺失时展示学校返回的状态。

## 运行

将 `SKILL_DIR` 设为本 Skill 所在目录的绝对路径：

```bash
node "$SKILL_DIR/scripts/run.mjs" academic --help
```

登录提示中的 `auth ...` 也通过上述脚本执行。

## 资料

- 操作前读取[使用流程与参数](references/usage.md)。
- 核对接口字段或验证范围时读取[接口说明](references/interfaces.md)。
