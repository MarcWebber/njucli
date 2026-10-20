# README 与全局 Skills 套件验证

**一键安装命令已实际执行，新版全局套件、旧版迁移及公开镜像请求通过。** Codex 与 NJURunner 使用的 Pi 加载器均只发现一个 NjuCLI 入口，18 个业务说明按需读取。

## 执行范围与证据

本轮 Agent 按 README 的安装提示词逐项执行环境检查、安装、命令与套件回读、公开镜像查询。安装使用临时全局 prefix、独立的 `CODEX_HOME` 和 XDG 配置目录，`NJUCLI_SKILLS_DIR` 留空以验证默认注册规则。

- [真实执行记录](assets/2026-10-20-skill-suite/verification.json)：提示词、一键安装、候选包安装、CLI 输出、迁移前后目录、重复注册、自定义目录及实际 Skill 发现结果；本机路径已脱敏。
- [本地检查日志](assets/2026-10-20-skill-suite/checks.txt)：`pnpm lint`、`pnpm test`，2 项真实本地检查通过。

## 结果

| 验证项 | 实际结果 |
| --- | --- |
| README 一键命令 | 通过网络获取官方安装脚本，完成依赖安装、构建、打包和全局安装，退出码 0 |
| 旧版迁移 | 一键安装当前 `main` 后有 18 个本包业务链接；在同一 prefix 安装候选 tarball 后收拢为一个 `njucli` 套件 |
| 默认全局位置 | `${CODEX_HOME}/skills/njucli/SKILL.md` 可读，18 个业务 `guide.md` 和随包资料完整 |
| 重复与自定义注册 | 再次注册成功；`NJUCLI_SKILLS_DIR` 指定目录内同样只注册一个 `njucli` 套件 |
| Codex 0.163.0 | 实际启动本地 app-server 并调用 `skills/list`，NjuCLI 只返回 `njucli:njucli` 一个入口 |
| Pi | 使用 NJURunner 当前安装的真实 Skill 加载器，分别读取全局目录与 Runner 的包内目录；均识别一个 `njucli`，诊断为空 |
| CLI 与公开请求 | 仓库外执行 `njucli --help` 成功；`njucli campus mirrors ubuntu --format json` 实际返回 8 项 |
| 安装自动检查 | 新 tarball 实际安装；18 个业务帮助、模板导出、机构目录和 136 个只读 MCP 工具检查通过 |
| README 与素材 | GitHub Markdown API 渲染通过；只保留安装与 AI 提示词两个代码块；本地链接有效，Logo 经本机 SVG 渲染核对 |

本轮一键命令获取合入前的 `main`，候选版本随后通过实际 tarball 安装验证。安装脚本沿用同一流程；新的单套件布局随本次改动合入后由一键命令提供。Skill 发现检查使用本地 API 与加载器，安装提示词的步骤由本轮 Agent 执行。

Logo 复用 NJUWeb 的 `public/nanyong.svg`，复制到本仓库并保留来源。Web 与 Runner 仓库链接已通过 GitHub API 核对。
