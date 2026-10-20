# 安装与维护

NjuCLI 将全局命令和一个完整的 Skills 套件一起安装、更新。安装入口与可复制给 AI 的提示词见 [README](../README.md#一键安装)。

## 环境与位置

需要 Node.js 20+（含 npm）、Git、curl、Bash。Linux 使用 `util-linux` 提供的 `flock` 管理账号会话锁。校园登录及页面操作的浏览器前提见[认证说明](../skills/njucli-auth/guide.md#运行前提)。

| 内容 | 默认位置与设置 |
| --- | --- |
| CLI | npm 全局安装前缀下的 `bin/njucli`；使用 `NJUCLI_INSTALL_PREFIX` 指定前缀时，将其 `bin` 加入 PATH |
| Skills 套件 | `${CODEX_HOME:-~/.codex}/skills/njucli/`，入口为 `SKILL.md` |
| 其他 AI 客户端 | 用 `NJUCLI_SKILLS_DIR` 指定该客户端的全局 Skills 目录，套件安装到其中的 `njucli/` |

套件目录链接到已安装的 NjuCLI 包，业务说明、参考资料和模板放在套件内部。升级会将本包管理的旧业务链接收拢到套件；其他内容保持原有归属。

## 更新与检查

使用 `njucli upgrade` 一起更新命令和套件。后台保活进程运行时，先按[认证说明](../skills/njucli-auth/guide.md#后台保活)停止，升级后重新启动。

安装后运行 `njucli --help` 核对命令，读取全局套件的 `SKILL.md`，再执行 `njucli campus mirrors ubuntu --format json` 验证公开服务请求。AI 客户端需要重新打开会话以刷新 Skill 列表。

## 账号与业务使用

账号、校园凭据与 Cookie 使用本地隔离目录。个人服务首次使用时，按[认证说明](../skills/njucli-auth/guide.md)登录；具体参数和任务流程从[套件入口](../skills/SKILL.md)选择对应业务说明。
