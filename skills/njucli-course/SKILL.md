---
name: njucli-course
description: 查询南京大学个人课表、导出日历，查询研究生选课与按用户要求选退课。
---

# 课表与选课

term-id 来自 terms；选课 class-id 来自 available，退课 class-id 来自 selected。用户明确指定课程后，调用 course select CLASS_ID 或 course withdraw CLASS_ID，单次提交并读取返回结果。对提示提交失败或回读失败的操作，先查询 selected 核对现状。日历导出到用户指定位置。

## 运行

将 `SKILL_DIR` 设为本 Skill 所在目录的绝对路径：

```bash
node "$SKILL_DIR/scripts/run.mjs" course --help
```

登录提示中的 `auth ...` 也通过上述脚本执行。

## 资料

- 操作前读取[使用流程与参数](references/usage.md)。
- 核对接口字段或验证范围时读取[接口说明](references/interfaces.md)。
