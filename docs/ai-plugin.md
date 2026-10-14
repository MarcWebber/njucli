# AI 客户端接入

NjuCLI 提供统一 CLI、只读 stdio MCP 工具和独立 Skill。安装步骤见 [README](../README.md#安装)。

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

## 独立 Skill

按需[安装单个 Skill](../README.md#只安装一个-skill)，然后让 AI 按该 Skill 完成任务。各业务 Skill 可独立提供对应的只读 MCP 工具；`njucli mcp` 提供全部工具，工具清单由客户端发现。

例如安装软件学院课程 Skill：

```bash
curl -fsSL https://raw.githubusercontent.com/MarcWebber/njucli/main/scripts/install.sh | bash -s -- --skill se
```

独立入口使用 `node "$SKILL_DIR/scripts/run.mjs" mcp`。日常汇总工具名为 `campus_today`。

## 任务使用

| 任务 | 工作流程 |
| --- | --- |
| [学院与教师](../skills/njucli-institution/SKILL.md) | 1. 使用 `teachers` 或 `search --kind teacher` 按姓名、学院查询教师，匹配结果默认将已有电话/邮箱者排前，并在详情中将联系方式置于履历前。2. 若快照缺少联系方式，使用 `teacher <id> --live` 实时核对个人主页；必要时可进一步检查页面明确链接的官方个人主页。3. 若个人联系方式仍缺失，使用 `show <id>` 查询该教师所属机构的办公联系方式，并向用户明确说明这是单位联系方式，禁止将其混淆为个人联系方式。4. 缺项仅代表当前资料未收录或解析被过滤（如模板占位符），不要向用户宣称“官网未公布”或“全网无公开电话”。 |
| [IT 侠维修](../skills/njucli-itxia/SKILL.md) | 根据用户维修需求提交预约，按编号或姓名、手机号查询状态和回复，并给出打开预约单的方法。取消仅 CLI、须 `--yes`；只读 MCP 不暴露取消 |
| [青年平台](../skills/njucli-youth/SKILL.md) | 查询活动、志愿时长与第二课堂，按用户要求报名或取消 |
| [协同表格](../skills/njucli-table/SKILL.md) | 查找与复制模板，创建表格、公式和视图，按行 ID 填写记录 |
| [云盘](../skills/njucli-box/SKILL.md) | 查询资料库和路径，上传下载或管理文件；分享后将返回的 `url` 交给用户，保留 `id` 供撤销 |
| [教务与办事大厅](../skills/njucli-ehall/SKILL.md) | 查询课表、选课、成绩、考试与培养方案；办理行程时一次补齐缺项，提交后回读 |
| [论文写作](../skills/njucli-tex/SKILL.md) | 按用户材料修改正文、上传素材，编译后读取日志和 PDF |
| [邮箱](../skills/njucli-mail/SKILL.md) | 绑定和切换邮箱，查询、搜索、读取正文并下载附件；读取保持原有已读状态 |
| [软件学院课程](../skills/njucli-se/SKILL.md) | 查询课程、作业、名单与成绩，下载作业资料 |
| [校园信息](../skills/njucli-campus/SKILL.md) | 查询新闻、通知和食堂；`campus today` 汇总当天课程、借阅和预约 |
| [软件下载](../skills/njucli-software/SKILL.md) | 查询官方目录和安装包 ID，下载到指定位置 |

上传、下载与远端写入使用 CLI。具体参数见对应 Skill，远端契约与验证范围见[校园服务接口](interface-evidence.md)。
