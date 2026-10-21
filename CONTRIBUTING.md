# 参与贡献

欢迎提交可复现的问题、文档改进和围绕真实校园任务的功能修改。先阅读 [LICENSE](LICENSE)：个人学习及个人校园事务可按许可证使用，学校和其他机构的使用须另行取得书面授权；提交贡献时，贡献者保留著作权，并同意被接纳的贡献按该许可证提供。

## 提交修改

1. 从最新 `main` 创建分支，按改动类型使用 `feat/<主题>`、`fix/<主题>`、`docs/<主题>` 或 `refactor/<主题>`；外部贡献者先 Fork 仓库。
2. 围绕一个具体问题修改，并同步受影响的文档和验证范围。
3. 在 Node.js 20+、pnpm 10.27.0 下执行：

   ```bash
   pnpm install --frozen-lockfile
   pnpm lint
   pnpm test
   ```

4. 涉及远端能力的改动须先通过真实请求验证，再提交和发起 PR。PR 必须链接验证报告，记录实际执行的 CLI 或 MCP 命令、参数、结果及必要回读，并附可取得的 Agent 执行日志或截图。本地运行检查与实网结果分开记录；接口说明、前端扫描和登录页访问不能代替业务验证。
5. 根据评审意见更新 PR。新增提交会重新运行 CI，并使旧批准失效。

账号凭据、会话 Cookie、真实邮件和课程成员数据保留在个人配置或临时目录中。验证报告、命令日志和截图须脱敏。禁止使用模拟数据、mock/stub、伪造响应和本地替身服务。自动检查直接运行真实本地进程与构建产物；校园业务使用真实接口与实际业务结果验证。当前没有测试账号，个人账号仅用于用户当次明确授权的实际业务或实网验证；写操作须有明确的真实业务目标与材料。

## CI 与合入

[CI](.github/workflows/ci.yml) 对所有目标为 `main` 的 PR 运行，也在 `main` 更新时运行。固定检查名称为 `test`：Ubuntu、Node.js 22、锁文件安装，执行 `pnpm test` 完成 TypeScript 构建、真实子进程文件锁与 CLI 安装产物检查。

主分支规则要求 PR 通过 `test`、与最新 `main` 同步、获得代码所有者 `@MarcWebber` 的批准，并解决评审讨论。代码所有者配置见 [CODEOWNERS](.github/CODEOWNERS)。只有仓库所有者 `@MarcWebber` 可以绕过规则直接推送；该例外也允许其手动绕过检查，日常合入应等待 CI 通过。其他贡献者通过 PR 提交修改。

规则的可复核配置位于 [.github/main-ruleset.json](.github/main-ruleset.json)，实际生效状态见 [GitHub Rules](https://github.com/MarcWebber/njucli/rules)。CI 和自动评审均不代替维护者对接口契约及实网验收范围的判断。

## 实现约定

完整开发规范见 [AGENTS.md](AGENTS.md)。业务实现与说明放在所属 `skills/njucli-*/`；教务、课表、选课和办事大厅归 `njucli-ehall`，软件学院课程归 `njucli-se`。公共 SSO 与会话机制位于 `src/auth/`，业务站点的会话交接随所属 Skill 维护。

新增远端能力先验证实际契约，再接入所属 Skill 的 client、命令和只读 MCP。

简单业务将输入校验与 MCP 放在 `commands.ts`，请求与简短会话包装放在 `client.ts`。统一 CLI 在 `src/app/production.ts` 用一次 `mount` 关联业务实例、命令和 MCP。

业务说明直接写入所属 `SKILL.md`，较长流程和接口表放入 `references/`；接口索引见[校园服务接口](docs/interface-evidence.md)。

每个业务保留自己的 `SKILL.md`、代码、参考资料和模板。根包统一维护依赖、构建、安装与升级；源码编译到 `dist/`，模板随构建复制，全部 Skill 随根包分发并注册到全局 `skills/njucli/` 套件目录，命令统一使用 `njucli`。

`pnpm test` 先构建，再运行真实文件锁和安装检查。安装用例将实际 tarball 安装到临时全局目录，通过 PATH 中的 `njucli` 核对各业务帮助、公开目录、模板、MCP 查询及全局套件注册；临时目录在结束后清理。校园请求另按用户授权实测并记录报告。

所有评审者在每次评审（包括自评审）前须阅读并遵循根目录的 [REVIEW_RULES.md](REVIEW_RULES.md)，人工评审及任何模型、工具使用同一份规则。
