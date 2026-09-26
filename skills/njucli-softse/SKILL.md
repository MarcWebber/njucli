---
name: njucli-softse
description: 使用 NjuCLI 遍历南京大学软件学院 Moodle 课程目录，查询当前账号有权查看的单门课程名单。用户涉及 selearning.nju.edu.cn 的课程目录、课程 ID 或选课名单时使用。
---

# SoftSE 课程与名单

## 前置条件

安装 NjuCLI 与 Google Chrome。通过 `njucli account use <name>` 或 `NJUCLI_ACCOUNT` 选择本地账号；首次使用 `njucli auth login softse` 完成统一认证。业务命令复用同一次调用中的专用浏览器会话。同一账号串行运行命令。

## 查询流程

```bash
njucli softse catalog --format json
njucli softse courses --format json
njucli softse participants COURSE_ID --page 1 --format json
```

`catalog` 遍历当前账号可见的全部分类和分页，返回按 `courseId` 去重的课程数组；`courses` 返回“我的课程”导航中的条目。课程 ID 来自这些结果或官方课程链接的 `id` 参数。

`participants` 查询指定课程名单，每页 20 人。成功时 `ok: true`，`data.items` 为本页成员，字段为 `userId`、`name`、`url`、`roles`、`groups`；继续查询时将 `data.nextPage` 传入 `--page`，其值为 `null` 表示最后一页。文本输出也会显示下一页命令。

`name` 是页面显示名，`userId` 是 Moodle 用户标识。学生身份与学号的对应关系尚未实现；资料页目前仅核对字段标签，其字段与学号的关系尚待验证。权限错误交由课程管理员核对角色与课程配置；测试记录只保留状态、字段与计数。

仅支持 MCP 时使用 `softse_catalog` 和 `softse_participants`，参数与上述业务一致。实际接口与实网验证范围见[接口证据](https://github.com/MarcWebber/njucli/blob/main/docs/interface-evidence.md#softse-课程目录与名单2026-09-26)。
