# SoftSE 课程与名单

## 前置条件

按本 Skill 入口安装运行依赖，并准备 Google Chrome。通过 `node "$SKILL_DIR/scripts/run.mjs" account use <name>` 或 `NJUCLI_ACCOUNT` 选择本地账号；首次使用 `node "$SKILL_DIR/scripts/run.mjs" auth login softse` 完成统一认证。同一账号串行运行命令。

## 查询流程

```bash
node "$SKILL_DIR/scripts/run.mjs" softse catalog --format json
node "$SKILL_DIR/scripts/run.mjs" softse courses --format json
node "$SKILL_DIR/scripts/run.mjs" softse participants COURSE_ID --page 1 --format json
```

`catalog` 遍历当前账号可见的全部分类和分页，返回按 `courseId` 去重的课程数组；`courses` 返回“我的课程”导航中的条目。课程 ID 来自这些结果或官方课程链接的 `id` 参数。

`participants` 查询指定课程名单，每页 20 人。成功时 `ok: true`，`data.items` 为本页成员，字段为 `userId`、`name`、`url`、`roles`、`groups`；继续查询时将 `data.nextPage` 传入 `--page`，其值为 `null` 表示最后一页。文本输出也会显示下一页命令。

`name` 是页面显示名，`userId` 是 Moodle 用户标识，不作为学号。权限错误由课程管理员核对角色与课程配置。

仅支持 MCP 时使用 `softse_catalog` 和 `softse_participants`，参数与上述业务一致。实际接口与实网验证范围见[接口证据](interfaces.md#课程目录与名单)。
