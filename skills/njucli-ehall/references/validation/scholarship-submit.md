# 奖学金提交验证

本报告区分构建、本地安装运行、真实查询与正式提交写入。个人申请编号在命令日志中采用 `<本人申请编号>` 脱敏，账号资料和会话继续保存在本地隔离目录。

## 验证结果

| 层级 | 执行入口 | 结果 |
| --- | --- | --- |
| 类型检查 | `pnpm lint` | 退出码 0 |
| Skill 检查 | `quick_validate.py skills/njucli-ehall` | `Skill is valid!` |
| 构建与安装 | `pnpm test` | 2 个用例通过；实际安装包覆盖 20 个 Skill、293 个 MCP 工具 |
| CLI 输入边界 | 实际安装的 `njucli ehall scholarship submit` | 帮助包含确认和预览选项；空申请编号返回 `INVALID_INPUT` |
| MCP 契约 | 实际 stdio 服务 `tools/list`、`tools/call` | 提交工具标注为写操作，确认参数默认 false；空编号由输入校验处理 |
| CLI 实网预览 | `submit <本人申请编号>` | 查询当前账号的真实记录，返回金额、内容、附件、状态及官网链接 |
| CLI 实网预览优先级 | `submit <本人申请编号> --yes --dry-run` | `submitted=false` |
| MCP 实网预览 | `ehall_scholarship_submit`，省略 `confirmed` | `submitted=false`，返回当前审核状态与官网核对链接 |

安装检查在临时源码副本中执行，副本来自当前受版本控制的文件及本次修改，复用本地第三方依赖。该方式保持工作区中旧版独立 Skill 的构建产物及其他用户文件原样。

## 实网执行日志

以下记录来自本次构建的统一 CLI 与 MCP。快照日期为 2026-10-28。

```text
$ njucli ehall scholarship submit <本人申请编号> --format json
ok=true
submitted=false
canSubmit=false
status=待学院业务老师学业奖审核
amount=8000.00
reviewUrl=https://ehall.nju.edu.cn/appShow?appId=5907343959144076

$ njucli ehall scholarship submit <本人申请编号> --yes --dry-run --format json
ok=true
submitted=false

$ MCP ehall_scholarship_submit {applicationId: <本人申请编号>}
confirmedDefault=false
readOnlyHint=false
ok=true
submitted=false
canSubmit=false
status=待学院业务老师学业奖审核
reviewUrl=https://ehall.nju.edu.cn/appShow?appId=5907343959144076
```

真实记录已进入审核，预览如实返回 `canSubmit=false`。

## 提交契约

官网 `wysq_edit.js` 的 `Submit` 使用 `ACTIONTYPE=MODIFY`、`TYPE=1`，表单字段 `data` 包装 `MODE=T_JXJ_PDXX` 与二次序列化的 `INDATA`。实现复用同一次认证会话，先定位本人记录、检查草稿状态及表单内容，再发送一次提交请求并回读。接口详情见[奖学金接口契约](../scholarship.md#接口契约)。
