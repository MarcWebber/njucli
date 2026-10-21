# README 与全局 Skills 套件验证

**18 个独立 Skill 已在一个全局套件内完成实际安装与发现验证。** Codex 与 NJURunner 使用的 Pi 加载器均分别发现全部 18 个业务 Skill；统一 CLI 和公开镜像请求通过。

## 执行范围与证据

本轮 Agent 按 README 的安装提示词逐项执行环境检查、安装、命令与套件回读、公开镜像查询。安装使用临时全局 prefix、独立的 `CODEX_HOME` 和 XDG 配置目录，`NJUCLI_SKILLS_DIR` 留空以验证默认注册规则。

- [真实执行记录](assets/2026-10-20-skill-suite/verification.json)：提示词、环境检查、一键安装、候选包安装、CLI 输出、迁移前后目录、重复注册、自定义目录及实际 Skill 发现结果；本机路径已脱敏。
- [本地检查日志](assets/2026-10-20-skill-suite/checks.txt)：`pnpm lint`、`pnpm test`，2 项真实本地检查通过。

## 结果

| 验证项 | 实际结果 |
| --- | --- |
| README 一键命令 | 通过网络获取官方安装脚本，完成依赖安装、构建、打包和全局安装，退出码 0 |
| 旧版迁移 | 一键安装当前 `main` 后有 18 个本包业务链接；在同一 prefix 安装候选 tarball 后收拢到一个 `njucli/` 套件目录，18 个 Skill 均保留 |
| 默认全局位置 | `${CODEX_HOME}/skills/njucli/njucli-*/SKILL.md` 均可读且与源码一致，每个业务保留自己的 frontmatter；套件容器内直接包含 18 个业务目录 |
| 重复与自定义注册 | 再次注册成功；`NJUCLI_SKILLS_DIR` 指定目录内同样只注册一个 `njucli` 套件 |
| Codex 0.163.0 | 实际启动本地 app-server 并调用 `skills/list`，返回 18 个 `njucli:njucli-*` 业务 Skill，均为用户级 |
| Pi | 使用 NJURunner 当前安装的真实 Skill 加载器，分别读取全局目录与 Runner 的包内目录；均识别全部 18 个业务 Skill，诊断为空 |
| CLI 与公开请求 | 仓库外执行 `njucli --help` 成功；`njucli campus mirrors ubuntu --format json` 实际返回 8 项 |
| 安装自动检查 | 新 tarball 实际安装；一个全局套件中的 18 份 `SKILL.md`、业务帮助、模板导出、机构目录和 136 个只读 MCP 工具检查通过 |
| README 与素材 | GitHub Markdown API 渲染通过；只保留安装与 AI 提示词两个代码块；本地链接有效，Logo 经本机 SVG 渲染核对 |

本轮一键命令获取合入前的 `main`，候选版本随后通过实际 tarball 安装验证。安装脚本沿用同一流程；套件目录布局随本次改动合入后由一键命令提供。Skill 发现检查使用本地 API 与加载器，安装提示词的步骤由本轮 Agent 执行。WorkBuddy 的套件目录递归发现待实机核对。

Logo 复用 NJUWeb 的 `public/nanyong.svg`，复制到本仓库并保留来源。Web 与 Runner 仓库链接已通过 GitHub API 核对。

## Agent Skills 规范核对

18 个业务 Skill 均通过 [Agent Skills 官方参考工具](https://agentskills.io/specification#validation)的 `skills-ref validate` 检查，[逐项执行结果](assets/2026-10-20-skill-suite/agent-skills.txt)已保存。各业务的目录名、`name`、`description` 与 `SKILL.md` 格式符合该开放规范；参考资料继续按相对路径引用。

suite 统一分发这些标准 Skill，共用根包的 CLI 与依赖。全局安装位置和宿主发现方式由客户端决定：当前注册与发现已验证 Codex、Pi；Claude Code 的原生插件入口与个人 Skills 路径见[官方接入说明](https://code.claude.com/docs/en/skills#choose-where-skills-load)。本次格式核对的结论限于 Skill 规范，Claude Code 宿主发现另行验证。
