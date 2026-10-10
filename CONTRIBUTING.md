# 参与贡献

欢迎提交可复现的问题、文档改进和围绕真实校园任务的功能修改。先阅读 [LICENSE](LICENSE)：个人学习及个人校园事务可按许可证使用，学校和其他机构的使用须另行取得书面授权；提交贡献时，贡献者保留著作权，并同意被接纳的贡献按该许可证提供。

## 提交修改

1. 从最新 `main` 创建分支，按改动类型使用 `feat/<主题>`、`fix/<主题>`、`docs/<主题>` 或 `refactor/<主题>`；外部贡献者先 Fork 仓库。
2. 围绕一个具体问题修改，并补充受影响的文档或轻量集成用例。
3. 在 Node.js 20+、pnpm 10.27.0 下执行：

   ```bash
   pnpm install --frozen-lockfile
   pnpm lint
   pnpm test
   ```

4. 向 `main` 发起 PR，说明具体问题、修改后的行为和验证结果。实网结果与本地模拟测试分开记录。
5. 根据评审意见更新 PR。新增提交会重新运行 CI，并使旧批准失效。

账号凭据、会话 Cookie、真实邮件和课程成员数据保留在个人配置或临时目录中。测试使用合成数据、本机 HTTP 服务和自动清理的临时文件。远端写操作仅在明确授权的目标上验证。

## CI 与合入

[CI](.github/workflows/ci.yml) 对所有目标为 `main` 的 PR 运行，也在 `main` 更新时运行。固定检查名称为 `test`：Ubuntu、Node.js 22、锁文件安装，执行 `pnpm test` 完成 TypeScript 构建与本地集成测试。

主分支规则要求 PR 通过 `test`、与最新 `main` 同步、获得代码所有者 `@MarcWebber` 的批准，并解决评审讨论。代码所有者配置见 [CODEOWNERS](.github/CODEOWNERS)。只有仓库所有者 `@MarcWebber` 可以绕过规则直接推送；该例外也允许其手动绕过检查，日常合入应等待 CI 通过。其他贡献者通过 PR 提交修改。

规则的可复核配置位于 [.github/main-ruleset.json](.github/main-ruleset.json)，实际生效状态见 [GitHub Rules](https://github.com/MarcWebber/njucli/rules)。CI 和自动评审均不代替维护者对接口契约及实网验收范围的判断。

## 实现约定

完整开发规范见 [AGENTS.md](AGENTS.md)。业务实现与说明放在所属 `skills/njucli-*/`；教务、课表、选课和办事大厅归 `njucli-ehall`，软件学院课程归 `njucli-se`。认证集中在 `src/auth/`。

新增远端能力先验证实际契约，再接入所属 Skill 的 client、命令和只读 MCP。简短说明直接写入 `SKILL.md`，较长流程和接口表放入 `references/`；接口索引见[校园服务接口](docs/interface-evidence.md)。

构建为每个 Skill 生成 `scripts/run.mjs` 和依赖清单 `package.json`，共享源码打入入口。修改认证等共享代码后重新构建全部 Skill；生成的目录可独立安装运行。

`pnpm test` 先构建，再运行本地集成；独立 Skill 用例会将目录复制到临时位置，仅安装声明的依赖，核对入口、账号共享和 MCP 契约。打包前运行 `npm pack --dry-run` 检查清单，并将实际 tarball 安装到临时目录核对命令。评审重点见 [Code Review Rules](AGENTS.md#code-review-rules)。
