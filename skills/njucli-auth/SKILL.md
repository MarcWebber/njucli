---
name: njucli-auth
description: 使用本机 NjuCLI 登录南京大学统一认证、保存凭据、自动处理官方滑块，检查、恢复和维护登录会话。
---

# 统一认证

登录、凭据和会话处理统一使用共享认证实现。日常查询复用 HTTP 会话，需要登录或编辑页面时启动 Chrome；凭据和 Cookie 按本地账号隔离，同一账号的会话读写自动排队。

## 运行

需要 Node.js 20+。将 `SKILL_DIR` 设置为本文件所在目录的绝对路径。使用安装包中的本 Skill，或在完整源码仓库先执行 `pnpm build` 生成运行入口。单独复制构建后的目录时，在该目录安装声明的运行依赖：

```bash
npm install --omit=dev --ignore-scripts --prefix "$SKILL_DIR"
node "$SKILL_DIR/scripts/run.mjs" auth --help
```

网页登录需要本机 Google Chrome。账号通过 `NJUCLI_ACCOUNT` 或 `account use` 选择；本入口的 `account`、`auth` 与完整 CLI 共用配置和会话。

## 操作资料

- 登录、自动维护与滑块协助：读取[使用流程与参数](references/usage.md)。
- 站点登录、会话检查与验证范围：读取[接口说明](references/interfaces.md)。

完整安装时，同一组能力也可通过 `njucli auth` 执行。
