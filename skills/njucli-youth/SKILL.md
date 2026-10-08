---
name: njucli-youth
description: 查询南京大学青年平台的志愿时长、活动、第二课堂成绩单、社会实践、社团和票券；按用户要求报名或取消志愿活动及培训。
---

# 青年平台

使用前读取[操作流程](references/usage.md)。活动 ID 来自活动列表；取消和评价使用本人活动中的报名记录 ID。报名材料完整后提交一次，并以返回的回读结果确认完成。

## 运行

需要 Node.js 20+。将 `SKILL_DIR` 设置为本文件所在目录的绝对路径。安装包包含运行入口；源码目录先在完整仓库执行 `pnpm build`。单独复制构建后的 Skill 时，安装其声明的依赖：

```bash
npm install --omit=dev --ignore-scripts --prefix "$SKILL_DIR"
node "$SKILL_DIR/scripts/run.mjs" youth --help
node "$SKILL_DIR/scripts/run.mjs" youth hours --format json
```

本入口提供共用的 `account` 和 `auth` 命令，通过 `NJUCLI_ACCOUNT` 或 `account use` 选择账号。业务查询自动检查和恢复会话，首次网页登录需要本机 Chrome；扫码由本人完成。

## 资料

- [操作流程、命令与标识](references/usage.md)
- [接口字段与验证范围](references/interfaces.md)

只读 MCP 使用 `node "$SKILL_DIR/scripts/run.mjs" mcp` 启动。报名、取消、评价和成绩单下载通过命令入口执行。完整安装时也可使用 `njucli youth`。
