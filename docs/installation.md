# 安装与维护

NjuCLI 将全局命令和一个完整的 Skills 套件一起安装、更新。安装入口与可复制给 AI 的提示词见 [README](../README.md#一键安装)。

## 环境与位置

需要 Node.js 20+（含 npm）、Git、curl、Bash。Linux 使用 `util-linux` 提供的 `flock` 管理账号会话锁。校园登录及页面操作的浏览器前提见[认证说明](../skills/njucli-auth/SKILL.md#运行前提)。

| 内容 | 默认位置与设置 |
| --- | --- |
| CLI | npm 全局安装前缀下的 `bin/njucli`；使用 `NJUCLI_INSTALL_PREFIX` 指定前缀时，将其 `bin` 加入 PATH |
| Skills 套件 | `${CODEX_HOME:-~/.codex}/skills/njucli/`，每个业务子目录有自己的 `SKILL.md` |
| Claude Code | 先安装 CLI，再通过下方原生插件入口安装整个套件 |
| 其他 AI 客户端 | 用 `NJUCLI_SKILLS_DIR` 指定该客户端的全局 Skills 目录，套件安装到其中的 `njucli/` |

套件目录链接到已安装的 NjuCLI 包。各 Skill 分别提供触发说明、任务流程与参考资料，共用同一个 CLI 和依赖。

```text
skills/
└── njucli/                    ← 整个套件
    ├── njucli-auth/SKILL.md
    ├── njucli-ehall/SKILL.md
    ├── njucli-campus/SKILL.md
    └── …                      ← 全部业务 Skill
```

宿主递归读取套件中的业务 Skill。Codex 与 NJURunner 的 Pi 加载器已实际验证；其他客户端需支持目录递归发现。升级会将本包管理的旧业务链接收拢到套件；其他内容保持原有归属。

## Claude Code

先按 README 安装 NjuCLI，确认运行 Claude Code 的终端中可执行 `njucli --help`，再安装用户级插件：

```bash
claude plugin install njucli --marketplace MarcWebber/njucli --scope user
```

重新打开 Claude Code 会话后，插件提供完整业务 Skills 和 `njucli` MCP 服务。可使用 `/njucli:njucli-campus` 查询公开镜像，或直接描述校园任务。插件中的 Skill 统一调用全局 `njucli`，校园账号和会话使用同一份 CLI 配置。

使用 `claude plugin details njucli@njucli` 查看组件清单，使用 `claude plugin update njucli@njucli` 更新插件。CLI 与依赖通过 `njucli upgrade` 更新。

## 更新与检查

使用 `njucli upgrade` 一起更新命令和套件。后台保活进程运行时，先按[认证说明](../skills/njucli-auth/SKILL.md#后台保活)停止，升级后重新启动。

安装后运行 `njucli --help` 核对命令，读取全局套件中各业务的 `SKILL.md`，再执行 `njucli campus mirrors ubuntu --format json` 验证公开服务请求。AI 客户端需要重新打开会话以刷新 Skill 列表。

## 账号与业务使用

账号、校园凭据与 Cookie 使用本地隔离目录。个人服务首次使用时，按[认证说明](../skills/njucli-auth/SKILL.md)登录；具体参数和任务流程见 [README 的业务入口](../README.md#可以做什么)。
