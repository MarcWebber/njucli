# NjuCLI

面向南京大学学生与 AI 助手的校园服务命令行。

在终端管理 TeX 论文、阅读校园邮件、查询课程与作业，使用统一的命令格式和 JSON 输出连接日常校园服务。

[快速开始](#快速开始) · [功能](#功能) · [使用示例](#使用示例) · [AI 接入](#ai-接入) · [目录结构](#目录结构) · [参与开发](#参与开发)

## 快速开始

准备 Node.js 20+ 和 pnpm 10.27.0。网页认证使用本机 Google Chrome，邮箱凭据使用系统钥匙串。当前验证环境为 macOS。

```bash
git clone https://github.com/MarcWebber/njucli.git
cd njucli
pnpm install --frozen-lockfile
pnpm build
npm install --global .
njucli --help
```

先体验公开信息查询，再登录需要使用的服务：

```bash
njucli campus canteens
njucli auth login tex
njucli tex projects
```

所有命令遵循：

```text
njucli <领域> <动作> [目标] [选项]
```

使用 `njucli <领域> --help` 查看该领域的动作和参数。

## 功能

| 领域 | 现有命令能力 |
| --- | --- |
| **TeX 写作** `tex` | 项目与模板查询、创建、模板创建、改名、正文读写、单文件上传、编译、日志、PDF 与源码下载 |
| **校园邮箱** `mail` | 本机绑定、邮件夹、未读列表、全文搜索、正文读取、附件下载、绑定管理 |
| **研究生教务** `academic` | 成绩、考试安排、课表、培养方案 |
| **课程** `course` | 本科课表、今日/本周课程、下一节课、ICS 导出；研究生可选/已选课程查询与选退课 |
| **软件学院教学** `softse` | 课程搜索、课程活动、作业要求与状态、资料下载、成绩项、自助选课、官方作业提交页链接 |
| **图书馆** `library` | 图书检索、详情、馆藏位置与可借状态、个人借阅 |
| **体育** `sports` | 场馆、场地时段、余量、预约记录、官方预约及取消页面链接 |
| **网上办事大厅** `ehall` | 服务目录、待办、办件进度、官方应用链接 |
| **校园信息** `campus` | 公告来源、栏目文章、文章正文、食堂名称与电话 |
| **账号与认证** `account` / `auth` | 本地账号切换、隔离会话、登录检查、会话恢复、主动刷新与退出 |

`today` 汇总本科课程、借阅和体育预约；`doctor` 检查当前账号及服务连接。接口来源与执行结果分别记录在[接口说明](docs/interface-evidence.md)和[实网记录](docs/design-v1.md#验收里程碑)。

## 使用示例

### 写论文

```bash
njucli auth login tex
njucli tex templates
njucli tex from-template TEMPLATE_KEY --yes
njucli tex projects "论文"
njucli tex files PROJECT --version VERSION
njucli tex read PROJECT FILE_KEY --version VERSION
njucli tex write PROJECT main.tex --version VERSION --input ./main.tex --yes
njucli tex upload PROJECT ./figure.png --version VERSION --yes
njucli tex compile PROJECT main.tex --version VERSION --output ./paper.pdf --yes
njucli tex log PROJECT --version VERSION
njucli tex download PROJECT --version VERSION --output ./source.zip
```

`TEMPLATE_KEY` 来自模板查询；`PROJECT` 和 `VERSION` 来自项目查询；`FILE_KEY` 来自文件列表。正文写入和编译使用文件路径，例如 `main.tex`。

`write` 更新已有 UTF-8 文件；`upload` 将单个非隐藏文件上传至项目根目录，同名文件直接替换。文件大小遵循网站的小于 50 MiB 限制。上传后按字节回读，正文写入后核对保存，编译结合本次响应与日志确认产物。

AI 可以根据你的材料撰写章节、调整公式、维护参考文献，再通过这些命令保存、编译和下载。完整流程见 [TeX 写作 Skill](skills/njucli-tex/SKILL.md)。

### 读校园邮件

先在[校园邮箱](https://mail.nju.edu.cn/)完成微信授权，按[官方说明](https://itsc.nju.edu.cn/1a/8f/c21586a334479/page.htm)开启 IMAP 并生成客户端专用密码，再在本机终端绑定：

```bash
njucli mail bind
njucli mail folders
njucli mail list --unread --limit 10
njucli mail search "奖学金"
njucli mail read MESSAGE_ID
njucli mail download MESSAGE_ID 1 --output ./附件.pdf
```

`MESSAGE_ID` 来自列表或搜索结果，附件编号来自正文查询。服务地址与 TLS 端口内置，专用密码通过隐藏输入保存到当前 CLI 账号的系统钥匙串。读取与下载保持原有已读标记。

分页使用结果中的 `nextBefore`：`njucli mail list --before UID`。通过 `mail status` 查看本机绑定，通过 `mail unbind --yes` 清除本机凭据。

### 查课程和作业

```bash
njucli auth login ehall
njucli academic grades
njucli academic exams
njucli academic schedule
njucli academic plan

njucli auth login softse
njucli softse courses
njucli softse assignments --pending
njucli softse assignment ACTIVITY_ID
njucli softse download ACTIVITY_ID "作业说明.pdf" --output ./作业说明.pdf
```

`ACTIVITY_ID` 和附件名称取自作业查询结果。教务查询可使用 `--term` 指定学期。

### 管理登录

```bash
njucli auth login
njucli auth status
njucli auth refresh tex
njucli auth logout tex
```

网页服务共用当前账号的 CLI 专用浏览器目录。每次业务执行前检查目标站点会话，并通过已接入的官方认证流程尝试恢复。登录页中的验证码或扫码由本人完成，CLI 等待认证落地后继续。

通过 `account add/use/current/list/remove` 管理本地账号；`NJUCLI_ACCOUNT` 为当前进程指定账号。邮箱使用独立的 `mail bind` 凭据。

## AI 接入

### 终端与 JSON

具备终端能力的 AI 使用现有 CLI。为具体命令添加 `--format json`，或为进程设置 `NJUCLI_FORMAT=json`：

```bash
njucli tex projects --format json
NJUCLI_FORMAT=json njucli softse assignments --pending
```

成功结果位于 `data`，失败信息位于 `error`；认证提示提供下一步的 `auth_command`。写操作使用 `--yes` 确认已授权的目标。

### MCP 与 Skill

`njucli mcp` 提供 34 个只读工具，CLI 与 MCP 共用业务实现。将以下配置加入支持本地 stdio MCP 的 AI 宿主：

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

TeX 写作用 [njucli-tex Skill](skills/njucli-tex/SKILL.md) 配合终端完成。仓库同时提供 `.codex-plugin/` 插件清单，接入步骤见 [AI 接入指南](docs/ai-plugin.md)。

## 目录结构

```text
src/
├── cli.ts                  # 程序入口
├── commands/               # 命令、参数与文本展示
├── app/                    # 业务接口与生产装配
├── account/                # 本地账号与目录
├── auth/                   # 登录交接、会话存储与恢复
│   └── drivers/            # 各站点的认证流程
├── core/                   # 文件、输入、日期、输出与脱敏
├── domains/                # 领域 client 和响应解析
│   ├── tex/                # TeX 项目与写作
│   ├── mail/               # IMAP 邮件
│   ├── academic/           # 研究生教务
│   ├── course/             # 课表与选课
│   ├── softse/             # 软件学院教学
│   ├── library/            # 图书馆
│   ├── sports/             # 体育
│   ├── ehall/              # 网上办事大厅
│   └── campus/             # 校园公开信息
└── mcp/                    # 只读 MCP 工具
tests/integration.test.mjs   # 本地集成测试
skills/njucli-tex/           # AI 写作 Skill
docs/                       # 设计、接口与验证记录
AGENTS.md                   # 开发规范与交付流程
```

## 参与开发

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test
npm pack --dry-run
```

`pnpm test` 构建后运行 Node 内置集成测试，使用本机 HTTP 服务和临时会话文件。

开发流程：**最小脚本验证 → 领域 client → CLI/MCP → 集成测试 → Skill → 打包交付**。具体约定见 [AGENTS.md](AGENTS.md)；提交问题时请附命令、版本、预期结果及脱敏后的实际输出。
