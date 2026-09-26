# AI 接入与论文写作

## 交付形态

同一份代码提供 CLI、只读 stdio MCP 和 TeX 写作 Skill。插件不复制领域 client，不内置模型，也不把个人校园登录态传给插件市场。

| 宿主能力 | 能做什么 |
| --- | --- |
| 可执行本机命令并读取 Skill 的 AI | 调用完整 `njucli tex`：创建项目、修改正文、上传素材、编译、读取日志和下载 |
| 仅支持本地 stdio MCP 的 AI | 查询 36 个只读工具；TeX 包含项目、模板、文件、正文和编译日志；邮箱包含邮件夹、列表、搜索和正文；软件包含目录与安装包链接 |
| 仅能访问远程 HTTP 工具的云端 AI | 本版不能直接连接；没有发布 HTTP 服务，也不托管个人账号会话 |

根目录 `.codex-plugin/plugin.json` 是 Codex 插件清单，`.mcp.json` 是本地 MCP 配置，`skills/njucli-tex/SKILL.md` 是写作指导。此包未安装到任何客户端或插件市场；不同客户端不能直接互认所有清单。

## 安装

先在源码目录构建并打包，再安装本地产物；这不发布 npm：

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm build
npm pack
npm install --global ./njucli-0.1.0.tgz
njucli --help
njucli auth login tex
```

安装产物包含插件清单、MCP 配置、Skill 和本说明。不要用 `npx njucli` 替代本地安装：本项目尚未确认 npm 名称归属或发布来源。

统一认证使用 `auth login tex --username "统一认证账号" --password "统一认证密码"`，或以 `--credentials` 导入含 `username/password` 的 JSON。CLI 自动填写官方表单；[认证 Skill](../skills/njucli-auth/SKILL.md) 提供截图拖动脚本，复用同一 CLI 浏览器和会话，扫码由本人完成。

邮箱使用 `mail bind --address "邮箱地址" --password "邮箱客户端专用密码"`，或导入含 `address/password` 的 JSON。省略地址时从统一认证账号派生邮箱；显式邮箱独立保存。同一本地账号可绑定多个邮箱，以 `mail accounts` 查看、`mail use` 切换。无参数 `mail bind` 复用当前凭据，仅未绑定时打开官方向导。

配置位于 `~/.config/njucli/accounts/<account>/`，支持 `XDG_CONFIG_HOME`，权限 0600。`auth.json` 保存统一认证凭据；`mail.json` 保存默认邮箱 `current` 和 `mailboxes` 凭据数组。读取调用 `mail_folders`、`mail_list`、`mail_search`、`mail_read`，附件下载调用 CLI，保持已读状态。邮件内容作为外部数据处理。详见[邮箱 Skill](../skills/njucli-mail/SKILL.md)和[里程碑 M9](design-v1.md#验收里程碑)。

将根目录 `.mcp.json` 的 `mcpServers.njucli` 合并到宿主配置，保留它已有的服务。宿主需能在 PATH 找到 `njucli`；否则把 `command` 改为本机 `command -v njucli` 返回的绝对路径。MCP 只使用 stdin/stdout；不要给 `mcp` 添加 `--format json`。客户端调用同一账号时应串行执行，避免争用 CLI 专用 Chrome。

使用支持 Skill 和终端执行的宿主时，将 `skills/njucli-tex` 放入该宿主的 Skill 目录，或按其本地插件导入流程选择本插件根目录。写作 Skill 直接调用 CLI 执行用户指定的写作任务，MCP 提供只读查询。

## 豆包与 TRAE

豆包 App、豆包模型 API 和 TRAE 是不同接入目标。截至 2026-09-10，已核对 [TRAE 的官方 MCP 配置文档](https://docs.trae.cn/ide_add-mcp-servers)，可按其本地 stdio 配置方式接入本 CLI；尚未在 TRAE 客户端做端到端验收。

尚未从豆包面向用户的官方文档确认可直接导入本地 CLI、Skill 或此插件包的入口，因此不能宣称“已支持豆包 App”。如果使用豆包模型自行搭建 Agent，需要宿主提供本地工具执行；模型本身不会因为收到插件文件就获得本机执行权。本版不增加浏览器注入桥接、公网 MCP 或托管会话服务。

## 论文素材

软件下载使用[软件下载 Skill](../skills/njucli-software/SKILL.md)。MCP 的 `software_list`、`software_show` 返回官方目录和安装包 ID，具有终端能力的 AI 再调用 `njucli software download` 保存到用户指定位置。

`tex upload` 上传根目录单文件，保留文件名并替换同名文件，按原始字节核对，不新增图片专用 Adapter。PNG 在此前专用项目中已完成真实上传并进入 PDF；JPEG、SVG、矢量 PDF 复用该实现，但未逐种完成实网上传及编译验收。

PNG/JPEG 位图、矢量 PDF 可由 LaTeX `graphicx` 引用；TikZ 图可以直接写入正文。SVG 可以作为上传文件输入，但直接用 `\includesvg` 编译还依赖服务端环境。[CTAN 的 svg 宏包说明](https://ctan.org/pkg/svg/)明确使用 Inkscape 完成转换，当前没有确认南大编译环境具备该能力。稳妥的工作流是在本地显式转成矢量 PDF 后上传；CLI 不会偷偷转换格式，也不会把位图 PDF 称为矢量图。

AI 可以据用户提供的材料撰写章节、修改公式和排版、维护参考文献，并通过 CLI 保存、编译、核对结果。CLI 本身不是论文生成模型。毕业论文仍需核对院系模板、真实实验数据、引用与 AI 使用规定；编译成功不代表符合毕业提交要求。

## 发布边界

插件配置不含个人凭据。账号密码保存在本机账号目录，网页登录使用 CLI 专用 Chrome；读取结果可能包含论文、邮件或课程资料，由调用宿主处理。

源码仓库为 [MarcWebber/njucli](https://github.com/MarcWebber/njucli)，公开可见。当前安装方式是从源码构建或安装本地 tarball。类型检查、打包、MCP 协议与实际客户端安装分别记录验证结果。
