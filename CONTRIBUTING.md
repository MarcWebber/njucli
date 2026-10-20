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

4. 向 `main` 发起 PR，说明具体问题、修改后的行为和验证结果。本地运行检查与实网结果分开记录。
5. 根据评审意见更新 PR。新增提交会重新运行 CI，并使旧批准失效。

账号凭据、会话 Cookie、真实邮件和课程成员数据保留在个人配置或临时目录中。禁止使用模拟数据、mock/stub、伪造响应和本地替身服务。自动检查直接运行真实本地进程与构建产物；校园业务使用真实接口与实际业务结果验证。当前没有测试账号，个人账号仅用于用户当次明确要求的实际业务操作。

## CI 与合入

[CI](.github/workflows/ci.yml) 对所有目标为 `main` 的 PR 运行，也在 `main` 更新时运行。固定检查名称为 `test`：Ubuntu、Node.js 22、锁文件安装，执行 `pnpm test` 完成 TypeScript 构建、真实子进程文件锁与独立 Skill 产物检查。

主分支规则要求 PR 通过 `test`、与最新 `main` 同步、获得代码所有者 `@MarcWebber` 的批准，并解决评审讨论。代码所有者配置见 [CODEOWNERS](.github/CODEOWNERS)。只有仓库所有者 `@MarcWebber` 可以绕过规则直接推送；该例外也允许其手动绕过检查，日常合入应等待 CI 通过。其他贡献者通过 PR 提交修改。

规则的可复核配置位于 [.github/main-ruleset.json](.github/main-ruleset.json)，实际生效状态见 [GitHub Rules](https://github.com/MarcWebber/njucli/rules)。CI 和自动评审均不代替维护者对接口契约及实网验收范围的判断。

## 实现约定

完整开发规范见 [AGENTS.md](AGENTS.md)。业务实现与说明放在所属 `skills/njucli-*/`；教务、课表、选课和办事大厅归 `njucli-ehall`，软件学院课程归 `njucli-se`。公共 SSO 与会话机制位于 `src/auth/`，业务站点的会话交接随所属 Skill 维护。

新增远端能力先验证实际契约，再接入所属 Skill 的 client、命令和只读 MCP。

简单业务将输入校验与 MCP 放在 `commands.ts`，请求与简短会话包装放在 `client.ts`，由 `run.ts` 启动独立 Skill。统一 CLI 在 `src/app/production.ts` 用一次 `mount` 关联业务实例、命令和 MCP。

简短说明直接写入 `SKILL.md`，较长流程和接口表放入 `references/`；接口索引见[校园服务接口](docs/interface-evidence.md)。

构建为每个 Skill 生成 `scripts/run.mjs` 和依赖清单 `package.json`，共享源码打入入口。修改认证等共享代码后重新构建全部 Skill；生成的目录可独立安装运行。

`pnpm test` 先构建，再运行文件锁和独立 Skill 检查；独立 Skill 用例会将构建目录复制到临时位置，仅提供声明的依赖，核对入口、随包目录、模板和 MCP 契约。打包前运行 `npm pack --dry-run` 检查清单，并将实际 tarball 安装到临时目录核对命令。

所有评审者在每次评审（包括自评审）前须阅读并遵循根目录的 [REVIEW_RULES.md](REVIEW_RULES.md)，人工评审及任何模型、工具使用同一份规则。
