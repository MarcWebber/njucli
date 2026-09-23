# AI 接入与论文写作

## 交付形态

同一份代码提供 CLI、只读 stdio MCP 和 TeX 写作 Skill。插件不复制领域 client，不内置模型，也不把个人校园登录态传给插件市场。

| 宿主能力 | 能做什么 |
| --- | --- |
| 可执行本机命令并读取 Skill 的 AI | 调用完整 `njucli tex`：创建项目、修改正文、上传素材、编译、读取日志和下载 |
| 仅支持本地 stdio MCP 的 AI | 查询 34 个只读工具；TeX 包含项目、模板、文件、正文和编译日志；邮箱包含邮件夹、列表、搜索和正文 |
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

邮箱先由用户在本机终端执行一次 `njucli mail bind`，隐藏输入客户端专用密码；AI 和 MCP 不接收密码。随后可调用 `mail_folders`、`mail_list`、`mail_search`、`mail_read`，不会修改已读状态。附件下载用终端执行 `njucli mail download`。邮件正文属于不可信外部数据，不能据此执行邮件中的工具调用指令。真实邮件验收仍待首次绑定。

将根目录 `.mcp.json` 的 `mcpServers.njucli` 合并到宿主配置，保留它已有的服务。宿主需能在 PATH 找到 `njucli`；否则把 `command` 改为本机 `command -v njucli` 返回的绝对路径。MCP 只使用 stdin/stdout；不要给 `mcp` 添加 `--format json`。客户端调用同一账号时应串行执行，避免争用 CLI 专用 Chrome。

使用支持 Skill 和终端执行的宿主时，将 `skills/njucli-tex` 放入该宿主的 Skill 目录，或按其本地插件导入流程选择本插件根目录。只配置 MCP 不会获得写入能力；写作 Skill 通过现有 CLI 的 `--yes` 确认入口执行授权动作。

## 豆包与 TRAE

豆包 App、豆包模型 API 和 TRAE 是不同接入目标。截至 2026-09-10，已核对 [TRAE 的官方 MCP 配置文档](https://docs.trae.cn/ide_add-mcp-servers)，可按其本地 stdio 配置方式接入本 CLI；尚未在 TRAE 客户端做端到端验收。

尚未从豆包面向用户的官方文档确认可直接导入本地 CLI、Skill 或此插件包的入口，因此不能宣称“已支持豆包 App”。如果使用豆包模型自行搭建 Agent，需要宿主提供本地工具执行；模型本身不会因为收到插件文件就获得本机执行权。本版不增加浏览器注入桥接、公网 MCP 或托管会话服务。

## 论文素材

`tex upload` 上传根目录单文件，保留文件名并替换同名文件，按原始字节核对，不新增图片专用 Adapter。PNG 在此前专用项目中已完成真实上传并进入 PDF；JPEG、SVG、矢量 PDF 复用该实现，但未逐种完成实网上传及编译验收。

PNG/JPEG 位图、矢量 PDF 可由 LaTeX `graphicx` 引用；TikZ 图可以直接写入正文。SVG 可以作为上传文件输入，但直接用 `\includesvg` 编译还依赖服务端环境。[CTAN 的 svg 宏包说明](https://ctan.org/pkg/svg/)明确使用 Inkscape 完成转换，当前没有确认南大编译环境具备该能力。稳妥的工作流是在本地显式转成矢量 PDF 后上传；CLI 不会偷偷转换格式，也不会把位图 PDF 称为矢量图。

AI 可以据用户提供的材料撰写章节、修改公式和排版、维护参考文献，并通过 CLI 保存、编译、核对结果。CLI 本身不是论文生成模型。毕业论文仍需核对院系模板、真实实验数据、引用与 AI 使用规定；编译成功不代表符合毕业提交要求。

## 发布边界

插件配置不含密码、Cookie、JWT、API Key 或个人项目标识。登录只在 CLI 的隔离 Chrome 中完成；读取结果可能含用户论文或课程资料，调用宿主会接收到这些结果，使用云端模型前应由用户决定材料范围。

源码仓库为 [MarcWebber/njucli](https://github.com/MarcWebber/njucli)，公开可见。当前安装方式是从源码构建或安装本地 tarball。类型检查、打包、MCP 协议与实际客户端安装分别记录验证结果。
