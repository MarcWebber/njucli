# AI 客户端接入

NjuCLI 提供统一 CLI、stdio MCP 工具和 NjuCLI Skills 套件。安装步骤见 [README](../README.md#一键安装)。

## 选择入口

| 宿主能力 | 使用方式 |
| --- | --- |
| 读取 Skill 并执行本机命令 | 按 Skill 完成查询、下载和用户指定的写入 |
| 支持本地 stdio MCP | 收发邮件、编辑文档与论文、管理文件和表格、选退课、报名及查询 |
| 只支持远程 HTTP 工具 | 需要宿主另行提供本地执行环境 |

仓库的 `.codex-plugin/plugin.json` 提供套件清单，`.mcp.json` 提供 MCP 配置。全局安装将整个套件注册到 `${CODEX_HOME:-~/.codex}/skills/njucli/`，各业务子目录保留自己的 `SKILL.md`，宿主按任务选择对应 Skill。其他支持递归发现的宿主可通过 `NJUCLI_SKILLS_DIR` 指定全局 Skills 目录，套件注册到其中的 `njucli/`。目录与验证范围见[安装与维护](installation.md)。

Claude Code 使用 `.claude-plugin/` 中的原生插件与 marketplace 声明，按[Claude Code 安装步骤](installation.md#claude-code)一次安装全部业务 Skill 和 MCP 入口。

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

## MCP 工具概览

`njucli mcp` 注册全部公开 CLI 动作。工具名称、参数和读写属性由客户端通过 `tools/list` 发现。新增 CLI 动作时，安装检查会核对对应 MCP 入口。

## 客户端指南

- [Claude Code](installation.md#claude-code)：用户级插件安装、组件检查和更新。
- [WorkBuddy](workbuddy.md)：MCP 配置、Skills 安装与客户端发现检查。

## 任务使用

| 任务 | 工作流程 |
| --- | --- |
| [学院与教师](../skills/njucli-institution/SKILL.md) | 1. 使用 `teachers` 或 `search --kind teacher` 按姓名、学院查询教师，匹配结果默认将已有电话/邮箱者排前，并在详情中将联系方式置于履历前。2. 若快照缺少联系方式，使用 `teacher <id> --live` 实时核对个人主页；必要时可进一步检查页面明确链接的官方个人主页。3. 若个人联系方式仍缺失，使用 `show <id>` 查询该教师所属机构的办公联系方式，并向用户明确说明这是单位联系方式，禁止将其混淆为个人联系方式。4. 缺项仅代表当前资料未收录或解析被过滤（如模板占位符），不要向用户宣称“官网未公布”或“全网无公开电话”。 |
| [IT 侠维修](../skills/njucli-itxia/SKILL.md) | 根据用户维修需求提交预约，按编号或姓名、手机号查询状态和回复，并给出打开预约单的方法。CLI 取消须 `--yes`，MCP 取消传 `yes: true` |
| [青年平台](../skills/njucli-youth/SKILL.md) | 查询活动、志愿时长与第二课堂，按用户要求报名或取消 |
| [协同表格](../skills/njucli-table/SKILL.md) | 查找与复制模板，创建表格、公式和视图，按行 ID 填写记录 |
| [云盘](../skills/njucli-box/SKILL.md) | 查询资料库和路径，上传下载或管理文件；分享后将返回的 `url` 交给用户，保留 `id` 供撤销 |
| [教务与办事大厅](../skills/njucli-ehall/SKILL.md) | 查询空闲教室、课表、选课、成绩、考试与培养方案；办理行程时一次补齐缺项，提交后回读 |
| [论文写作](../skills/njucli-tex/SKILL.md) | 按用户材料修改正文、上传素材，编译后读取日志和 PDF |
| [自助服务](../skills/njucli-self-service/SKILL.md) | 从实时项目目录申请正式电子成绩单或纸质证明，查询费用、管理申请、查找设备和查询云打印；电子文件默认发至绑定邮箱，询问下载后按授权保存邮件附件 |
| [邮箱](../skills/njucli-mail/SKILL.md) | 邮件与附件发送、抄送密送、回复线程，以及邮箱切换、查询和附件下载 |
| [软件学院课程](../skills/njucli-se/SKILL.md) | 查询课程、作业、名单与成绩，下载作业资料 |
| [校园信息](../skills/njucli-campus/SKILL.md) | 查询新闻、通知和食堂；`campus today` 汇总当天课程、借阅和预约 |
| [软件下载](../skills/njucli-software/SKILL.md) | 查询官方目录和安装包 ID，下载到指定位置 |

CLI 与 MCP 共用业务方法、账号会话和结果核对。查询标为 `readOnlyHint: true`，写操作标为 `false`，执行权限由客户端管理；升级后重新连接 MCP。体育预约与取消返回官网办理链接，奖学金保存草稿后通过核对链接继续提交。具体参数见对应 Skill，远端契约与验证范围见[校园服务接口](interface-evidence.md)。
