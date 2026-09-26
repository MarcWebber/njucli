# NjuCLI

面向南京大学学生与 AI 助手的校园服务命令行。

在终端管理 TeX 论文、阅读校园邮件、查询课程与作业，使用统一的命令格式和 JSON 输出连接日常校园服务。

[快速开始](#快速开始) · [功能](#功能) · [使用示例](#使用示例) · [AI 接入](#ai-接入) · [目录结构](#目录结构) · [参与开发](#参与开发)

## 快速开始

准备 Node.js 20+ 和 pnpm 10.27.0。网页认证使用本机 Google Chrome，账号和密码保存在本地账号目录。当前验证环境为 macOS。

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
njucli auth login tex --username "统一认证账号" --password "统一认证密码"
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
| **正版软件** `software` | 官方软件目录、说明链接、Adobe / WPS / MathType / Origin 安装包查询与下载 |
| **账号与认证** `account` / `auth` | 本地账号切换、隔离会话、登录检查、会话恢复、主动刷新与退出 |

`today` 汇总本科课程、借阅和体育预约；`doctor` 检查当前账号及服务连接。接口来源与执行结果分别记录在[接口说明](docs/interface-evidence.md)和[实网记录](docs/design-v1.md#验收里程碑)。

## 使用示例

### 写论文

```bash
njucli auth login tex
njucli tex templates
njucli tex from-template TEMPLATE_KEY
njucli tex projects "论文"
njucli tex files PROJECT --version VERSION
njucli tex read PROJECT FILE_KEY --version VERSION
njucli tex write PROJECT main.tex --version VERSION --input ./main.tex
njucli tex upload PROJECT ./figure.png --version VERSION
njucli tex compile PROJECT main.tex --version VERSION --output ./paper.pdf
njucli tex log PROJECT --version VERSION
njucli tex download PROJECT --version VERSION --output ./source.zip
```

`TEMPLATE_KEY` 来自模板查询；`PROJECT` 和 `VERSION` 来自项目查询；`FILE_KEY` 来自文件列表。正文写入和编译使用文件路径，例如 `main.tex`。

`write` 更新已有 UTF-8 文件；`upload` 将单个非隐藏文件上传至项目根目录，同名文件直接替换。文件大小遵循网站的小于 50 MiB 限制。上传后按字节回读，正文写入后核对保存，编译结合本次响应与日志确认产物。

AI 可以根据你的材料撰写章节、调整公式、维护参考文献，再通过这些命令保存、编译和下载。完整流程见 [TeX 写作 Skill](skills/njucli-tex/SKILL.md)。

### 读校园邮件

直接提供完整邮箱地址和客户端专用密码，校验成功后保存到本地：

```bash
njucli mail bind --address "邮箱地址" --password "邮箱客户端专用密码"
njucli mail folders
njucli mail list --unread --limit 10
njucli mail search "奖学金"
njucli mail read MESSAGE_ID
njucli mail download MESSAGE_ID 1 --output ./附件.pdf
```

也可用 `mail bind --credentials ./mail-credentials.json` 导入含 `address/password` 的 JSON。已保存统一认证账号时，`mail bind --password "邮箱客户端专用密码"` 默认使用 `username@smail.nju.edu.cn`；username 已为完整邮箱地址则直接使用。显式 `--address` 独立保存，不改变统一认证账号。

同一本地账号可绑定多个邮箱，每次绑定成功后切换为该邮箱。`mail accounts` 列出绑定邮箱，`mail use "邮箱地址"` 切换默认邮箱，`mail unbind [address]` 删除指定或当前邮箱的本地凭据。

无参数 `mail bind` 校验并复用当前邮箱。尚无凭据时打开[校园邮箱](https://mail.nju.edu.cn/)官方向导：检查 IMAP、必要时开启 IMAP/SMTP、生成一个专用密码并验证保存；扫码由本人完成。

`MESSAGE_ID` 来自列表或搜索结果，附件编号来自正文查询。分页使用 `nextBefore`：`njucli mail list --before UID`。`folders/list/search` 使用当前邮箱；`read/download` 按邮件 ID 使用其所属的已绑定邮箱，切换默认邮箱后仍可读取原 ID。读取和下载保持原有已读标记，`mail status` 查看本机绑定。

完整流程见[邮箱 Skill](skills/njucli-mail/SKILL.md)，官方说明见[学生邮箱客户端设置](https://itsc.nju.edu.cn/1a/8f/c21586a334479/page.htm)。

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

### 下载正版软件

```bash
njucli software list
njucli software show adobe-cc
njucli software show adobe --format json
njucli software download adobe-cc FILE_ID --output ./CreativeCloud.dmg
```

`FILE_ID` 取自 `show` 的 `files[].id`，按目标操作系统选择；CC 的 `macarm64` 为 Apple Silicon，`osx10` 为 Intel Mac，`win64` 与 `winarm64` 为对应 Windows 架构。`adobe-cc` 读取 Adobe 官网的 Creative Cloud 安装包，安装后以“学工号@nju.edu.cn”进入南大统一认证，再由 CC 安装 Photoshop 等产品。`adobe` 读取南大提供的离线版本，版本与适用系统以官方页面为准。

`wps-365`、`mathtype`、`origin` 同样支持 `show` 和 `download`。校内服务器下载需要校园网或官方 VPN。下载流式保存至指定路径，同名输出直接更新；软件安装与校园授权按官方说明完成。详见[软件下载 Skill](skills/njucli-software/SKILL.md)和[南大正版软件专区](https://itsc.nju.edu.cn/zbrj/list.htm)。

### 管理登录

```bash
njucli auth login --username "统一认证账号" --password "统一认证密码"
njucli auth status
njucli auth refresh tex
njucli auth logout tex
```

`auth login [capability] --credentials ./auth-credentials.json` 可导入含 `username/password` 的 JSON。后续登录复用已存凭据，CLI 自动填写统一认证官方账号登录表单；滑块可通过[认证 Skill 的截图拖动脚本](skills/njucli-auth/SKILL.md)完成，扫码由本人完成。每次业务前探测会话，失效时自动登录，包括之前主动退出的会话。

配置默认位于 `~/.config/njucli/accounts/<account>/`，设置 `XDG_CONFIG_HOME` 可更换根目录。`auth.json` 保存统一认证的 `username/password`；`mail.json` 保存 `current` 和 `mailboxes`，每个邮箱包含 `address/password`。两份文件权限为 `0600`。`auth logout` 清除会话，已保存的账号密码供后续登录复用。

通过 `account add/use/current/list/remove` 管理本地账号；`NJUCLI_ACCOUNT` 为当前进程指定账号。统一认证账号与邮箱地址分别管理。

## AI 接入

### 终端与 JSON

具备终端能力的 AI 使用现有 CLI。为具体命令添加 `--format json`，或为进程设置 `NJUCLI_FORMAT=json`：

```bash
njucli tex projects --format json
NJUCLI_FORMAT=json njucli softse assignments --pending
```

成功结果位于 `data`，失败信息位于 `error`；认证提示提供下一步的 `auth_command`。命令直接执行指定动作，写入成功包含必要的结果回读。

### MCP 与 Skill

`njucli mcp` 提供 36 个只读工具，CLI 与 MCP 共用业务实现。将以下配置加入支持本地 stdio MCP 的 AI 宿主：

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
│   ├── software/           # 正版软件目录与下载
│   ├── academic/           # 研究生教务
│   ├── course/             # 课表与选课
│   ├── softse/             # 软件学院教学
│   ├── library/            # 图书馆
│   ├── sports/             # 体育
│   ├── ehall/              # 网上办事大厅
│   └── campus/             # 校园公开信息
└── mcp/                    # 只读 MCP 工具
tests/integration.test.mjs   # 本地集成测试
skills/                     # 统一认证、TeX 写作、校园邮箱与软件下载 Skill
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
