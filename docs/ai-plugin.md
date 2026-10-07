# AI 客户端接入

## 接入方式

| 宿主能力 | 接入方式 |
| --- | --- |
| 可执行本机命令并读取 Skill | 使用全局 CLI 与[现有 Skills](../README.md#现有-skills)，完成查询、下载及用户指定的写入 |
| 支持本地 stdio MCP | 注册下方 MCP 配置，调用查询工具；写入和文件下载通过 CLI 执行 |
| 仅支持远程 HTTP 工具 | 当前版本没有远程服务，需要能执行本机命令的宿主 |

安装与升级见 [README](../README.md#安装)。全局安装将各 Skill 链接到 `${CODEX_HOME:-~/.codex}/skills/`，目标是完整包内的对应目录。升级同步更新 CLI 与 Skill，保留本机账号配置。同名目录被其他内容占用时，安装保留原内容并报错。

`NJUCLI_SKILLS_DIR` 可指定其他宿主的 Skill 目录，优先于 `CODEX_HOME`；安装和升级时使用同一设置。`NJUCLI_INSTALL_PREFIX` 可指定 CLI 安装前缀，默认使用 npm 全局前缀；将其 `bin` 目录加入 PATH。

## MCP 配置

将根目录 [.mcp.json](../.mcp.json) 中的 `mcpServers.njucli` 合并到宿主配置：

```json
{
  "mcpServers": {
    "njucli": {
      "command": "njucli",
      "args": ["mcp"]
    }
  }
}
```

宿主需要能在 PATH 找到 `njucli`；否则将 `command` 改为可执行文件的绝对路径。MCP 使用 stdin/stdout，不添加 `--format json`。选择特定账号时，在该服务的 `env` 中设置 `NJUCLI_ACCOUNT`。

CLI 和 MCP 共用本地账号与业务实现，同一账号的会话读写自动排队。首次配置及定时维护见[认证 Skill](../skills/njucli-auth/SKILL.md)，独立邮箱绑定见[邮箱 Skill](../skills/njucli-mail/SKILL.md)。配置位于 `~/.config/njucli/accounts/<account>/`，支持 `XDG_CONFIG_HOME`；凭据文件权限为 0600。

Codex 在下一轮对话发现已安装的 Skill。其他支持 Skill 的宿主可指定安装目录，或导入根目录 [.codex-plugin/plugin.json](../.codex-plugin/plugin.json) 对应的完整插件包。

## 豆包与 TRAE

豆包 App、豆包模型 API 和 TRAE 是不同接入目标。截至 2026-09-10，已核对 [TRAE 的官方 MCP 配置文档](https://docs.trae.cn/ide_add-mcp-servers)，可按其本地 stdio 配置方式接入本 CLI；尚未在 TRAE 客户端做端到端验收。

尚未从豆包面向用户的官方文档确认可直接导入本地 CLI、Skill 或此插件包的入口，因此不能宣称“已支持豆包 App”。如果使用豆包模型自行搭建 Agent，需要宿主提供本地工具执行；模型本身不会因为收到插件文件就获得本机执行权。本版不增加浏览器注入桥接、公网 MCP 或托管会话服务。

## 本地数据

插件配置包含程序入口，账号凭据与会话保存在本机账号目录。论文、邮件和课程资料的查询结果由调用宿主处理。任务流程、完成条件与验证范围分别见对应 Skill 和[接口证据](interface-evidence.md)。
