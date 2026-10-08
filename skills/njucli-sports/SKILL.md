---
name: njucli-sports
description: 查询南京大学体育场馆、可用时段、本人预约及官方预约与取消入口。
---

# 体育场馆

VENUE_ID 来自 venues，日期按南京当地日期填写。预约编号来自 bookings。reserve-link 和 cancel-link 返回官方办理入口，用户在学校页面完成相应步骤；查询和入口返回分别说明结果。

## 运行

将 `SKILL_DIR` 设为本 Skill 所在目录的绝对路径：

```bash
node "$SKILL_DIR/scripts/run.mjs" sports --help
```

登录提示中的 `auth ...` 也通过上述脚本执行。

## 资料

- 操作前读取[使用流程与参数](references/usage.md)。
- 核对接口字段或验证范围时读取[接口说明](references/interfaces.md)。
