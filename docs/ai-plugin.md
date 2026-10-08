# AI 客户端接入

NjuCLI 提供统一 CLI、91 个只读 stdio MCP 工具和 16 个独立 Skill。安装步骤见 [README](../README.md#安装)。

## 选择入口

| 宿主能力 | 使用方式 |
| --- | --- |
| 读取 Skill 并执行本机命令 | 按 Skill 完成查询、下载和用户指定的写入 |
| 支持本地 stdio MCP | 调用只读工具查询校园数据 |
| 只支持远程 HTTP 工具 | 需要宿主另行提供本地执行环境 |

仓库的 `.codex-plugin/plugin.json` 提供插件清单，`.mcp.json` 提供 MCP 配置。全局安装自动将 Skill 注册到 `${CODEX_HOME:-~/.codex}/skills/`；其他宿主可通过 `NJUCLI_SKILLS_DIR` 指定目录。

## MCP 配置

将以下服务合并到宿主配置：

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

宿主需能在 PATH 找到 `njucli`，也可将 `command` 改为本机绝对路径。`mcp` 使用标准输入输出传输协议。同一账号的调用由共享认证串行处理，读取最新 Cookie 后执行。

TRAE 可按其[本地 MCP 配置](https://docs.trae.cn/ide_add-mcp-servers)接入，客户端端到端验证待完成；豆包 App 的本地插件导入入口尚未确认。

## 独立 Skill

从安装包或构建后的源码复制所需 Skill 目录，执行 `npm install --omit=dev --ignore-scripts`。通过 `node scripts/run.mjs <domain> <command>` 使用业务功能，通过 `node scripts/run.mjs mcp` 启动该 Skill 的只读工具。

各入口自带公共 `account`、`auth` 命令，认证源码统一位于 `src/auth/`。构建、依赖和更新方式见 [Skill 组织说明](skill-layout.md)。

## 任务使用

| 任务 | 工作流程 |
| --- | --- |
| [青年平台](../skills/njucli-youth/SKILL.md) | 查询活动、志愿时长与第二课堂，按用户要求报名或取消 |
| [协同表格](../skills/njucli-table/SKILL.md) | 查找与复制模板，创建表格、公式和视图，按行 ID 填写记录 |
| [云盘](../skills/njucli-box/SKILL.md) | 查询资料库和路径，上传下载或管理文件；分享后将返回的 `url` 交给用户，保留 `id` 供撤销 |
| [行程填报](../skills/njucli-ehall/SKILL.md) | 读取当前假期和已有联系资料，一次补齐缺项；按用户行程提交并回读。多段行程可用 JSON 输入 |
| [论文写作](../skills/njucli-tex/SKILL.md) | 按用户材料修改正文、上传素材，编译后读取日志和 PDF |
| [邮箱](../skills/njucli-mail/SKILL.md) | 绑定和切换邮箱，查询、搜索、读取正文并下载附件；读取保持原有已读状态 |
| [软件下载](../skills/njucli-software/SKILL.md) | 查询官方目录和安装包 ID，下载到指定位置 |

上传、下载与远端写入使用 CLI。TeX 支持根目录单文件上传和同名替换；图片可使用 PNG、JPEG 或矢量 PDF，SVG 建议先转为 PDF。具体参数见对应 Skill，实网范围见[验证记录](design-v1.md#验收记录)。
