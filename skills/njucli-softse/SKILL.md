---
name: njucli-softse
description: 使用 NjuCLI 遍历南京大学软件学院 Moodle 课程目录，查询当前账号有权查看的单门课程名单。用户涉及 selearning.nju.edu.cn 的课程目录、课程 ID 或选课名单时使用。
---

# SoftSE 课程与作业

课程 ID 从目录、我的课程或官方链接取得，名单按 nextPage 翻页。课程与成员数据以当前账号的学校权限为准；选课等写入依用户指定目标执行。

## 运行

将 `SKILL_DIR` 设为本 Skill 所在目录的绝对路径：

```bash
node "$SKILL_DIR/scripts/run.mjs" softse --help
```

登录提示中的 `auth ...` 也通过上述脚本执行。

## 资料

- 操作前读取[使用流程与参数](references/usage.md)。
- 核对接口字段或验证范围时读取[接口说明](references/interfaces.md)。
