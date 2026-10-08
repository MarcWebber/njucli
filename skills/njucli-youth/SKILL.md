---
name: njucli-youth
description: 查询南京大学青年平台的志愿时长、活动、第二课堂成绩单、社会实践、社团和票券；按用户要求报名或取消志愿活动及培训。
---

# 青年平台

活动 ID 来自活动列表；取消和评价使用本人活动中的报名记录 ID。报名材料完整后提交一次，并以返回的回读结果确认完成。

## 运行

将 `SKILL_DIR` 设为本 Skill 所在目录的绝对路径：

```bash
node "$SKILL_DIR/scripts/run.mjs" youth --help
```

登录提示中的 `auth ...` 也通过上述脚本执行。

## 资料

- 操作前读取[使用流程与参数](references/usage.md)。
- 核对接口字段或验证范围时读取[接口说明](references/interfaces.md)。
