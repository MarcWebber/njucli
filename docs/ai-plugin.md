# AI 接入与论文写作

## 交付形态

同一份代码提供 CLI、只读 stdio MCP 和任务 Skill。插件不复制领域 client，不内置模型，也不把个人校园登录态传给插件市场。

| 宿主能力 | 能做什么 |
| --- | --- |
| 可执行本机命令并读取 Skill 的 AI | 调用完整 `njucli tex` 完成写作、上传和编译；通过 `njucli ehall trip-submit` 提交用户本次行程并回读核对 |
| 仅支持本地 stdio MCP 的 AI | 查询只读工具；TeX 包含项目、模板、文件、正文和编译日志；邮箱包含邮件夹、列表、搜索和正文；软件包含目录与安装包链接；SoftSE 包含可见课程目录与单门课程名单分页；`ehall_trip` 读取当前假期、默认联系方式和登记状态 |
| 仅能访问远程 HTTP 工具的云端 AI | 本版不能直接连接；没有发布 HTTP 服务，也不托管个人账号会话 |

根目录 `.codex-plugin/plugin.json` 是 Codex 插件清单，`.mcp.json` 是本地 MCP 配置，`skills/` 包含 7 个任务 Skill。全局安装会自动注册 Codex Skill；MCP 按下方配置接入。

## 安装

准备 Node.js 20+（含 npm）、Git 和 curl，执行：

```bash
curl -fsSL https://raw.githubusercontent.com/MarcWebber/njucli/main/scripts/install.sh | bash
njucli --help
njucli auth login tex
```

安装脚本从指定 GitHub 仓库获取 `main`，通过 `package.json` 锁定的 pnpm 与锁文件构建，再安装全局 `njucli` 命令；临时源码在结束时清理。7 个 Skill 通过目录链接安装到 `${CODEX_HOME:-~/.codex}/skills/`，链接指向完整包内的对应目录。已有同名目录或指向其他位置的链接会保留并报错，需先自行迁移。源码目录的普通 `pnpm install` 仅安装开发依赖。

升级时运行 `njucli upgrade`。命令重新安装远端 `main`，保留已有的全局安装前缀；Skill 链接随安装包更新，个人账号目录保持原位。升级进度写入 stderr，`--format json` 的最终结果使用统一输出格式。

需要指定其他宿主的 Skill 目录时，可设置 `NJUCLI_SKILLS_DIR`，并在安装和升级时使用相同设置。此变量优先于 `CODEX_HOME`。`NJUCLI_INSTALL_PREFIX` 可指定 CLI 安装前缀，其 `bin` 目录需位于 PATH；默认使用 npm 当前全局前缀。安装产物同时保留插件清单、MCP 配置和本说明。

统一认证使用 `auth login tex --username "统一认证账号" --password "统一认证密码"`，或以 `--credentials` 导入含 `username/password` 的 JSON。CLI 自动填写官方表单并识别、拖动统一认证滑块，复用当次会话；普通查询通过 HTTP 恢复 Cookie，状态检查不提交密码。TeX 登录完成其官方基本信息授权。[认证 Skill](../skills/njucli-auth/SKILL.md) 另提供截图和坐标协助脚本，扫码由本人完成。

持续维护使用 `NJUCLI_ACCOUNT=default njucli auth maintain --format json`，由定时任务每两小时执行。命令在会话过期时直接调用已保存凭据恢复；输出 action 为 kept-alive 或 restored，最近成功执行记录写入账号目录。日常业务直接调用各自命令，认证过期由 CLI 处理。

邮箱使用 `mail bind --address "邮箱地址" --password "邮箱客户端专用密码"`，或导入含 `address/password` 的 JSON。省略地址时从统一认证账号派生邮箱；显式邮箱独立保存。同一本地账号可绑定多个邮箱，以 `mail accounts` 查看、`mail use` 切换。无参数 `mail bind` 复用当前凭据，仅未绑定时打开官方向导。

配置位于 `~/.config/njucli/accounts/<account>/`，支持 `XDG_CONFIG_HOME`，权限 0600。`auth.json` 保存统一认证凭据；`mail.json` 保存默认邮箱 `current` 和 `mailboxes` 凭据数组。读取调用 `mail_folders`、`mail_list`、`mail_search`、`mail_read`，附件下载调用 CLI，保持已读状态。邮件内容作为外部数据处理。详见[邮箱 Skill](../skills/njucli-mail/SKILL.md)和[里程碑 M9](design-v1.md#验收里程碑)。

将根目录 `.mcp.json` 的 `mcpServers.njucli` 合并到宿主配置，保留它已有的服务。宿主需能在 PATH 找到 `njucli`；否则把 `command` 改为本机 `command -v njucli` 返回的绝对路径。MCP 只使用 stdin/stdout；不要给 `mcp` 添加 `--format json`。CLI 和 MCP 自动串行处理同一账号的会话读写，不同账号可同时使用。保存凭据后的统一认证在后台恢复，滑块拒绝后等待官方换图，最多尝试三张；学校账号错误直接返回，不进入人工等待。

Codex 在下一轮对话可发现已安装 Skill。其他支持 Skill 和终端执行的宿主，可通过 `NJUCLI_SKILLS_DIR` 指定其全局 Skill 目录，或按本地插件导入流程选择完整安装包。写作 Skill 直接调用 CLI 执行用户指定的写作任务，MCP 提供只读查询。

## 豆包与 TRAE

豆包 App、豆包模型 API 和 TRAE 是不同接入目标。截至 2026-09-10，已核对 [TRAE 的官方 MCP 配置文档](https://docs.trae.cn/ide_add-mcp-servers)，可按其本地 stdio 配置方式接入本 CLI；尚未在 TRAE 客户端做端到端验收。

尚未从豆包面向用户的官方文档确认可直接导入本地 CLI、Skill 或此插件包的入口，因此不能宣称“已支持豆包 App”。如果使用豆包模型自行搭建 Agent，需要宿主提供本地工具执行；模型本身不会因为收到插件文件就获得本机执行权。本版不增加浏览器注入桥接、公网 MCP 或托管会话服务。

## 行程填报

[行程填报 Skill](../skills/njucli-ehall/SKILL.md) 面向 e-Hall 研究生节假日离返校登记。AI 先运行 `ehall trip`，取得当前假期、本人联系方式默认值、缺失字段和已有登记；再将本次行程与缺失信息合成一次询问。全程留校直接执行 `ehall trip-submit --stay`；外出以 `--from/--to/--destination/--address/--transport` 传入用户行程，默认采用当前开放假期。用户已说明完整行程并要求填报时直接提交一次，成功以服务端回读为准。

联系方式和住宿信息自动保存到当前账号目录的 `ehall.json`，内容为 `{userId, contacts}`，权限 0600。每次以验证过的本人 `userId` 匹配缓存，当前官方资料优先、缓存补齐，仍有缺失才读取最近本人历史登记。正常查询同步真实默认值；用户显式更新的联系方式在校验通过后、正式提交前保存，`--dry-run` 不保存这类覆盖值。文件只保存联系人和住宿资料，不保存历史行程。

本次行程须来自用户；日期、目的地、详细地址与交通方式不足时一起补问。“是否全程留校”与“是否住校”分别填写，假期回家不会自动改动住宿资料。常见行程直接使用命令参数；多次离返校或多地停留才由 AI 整理可选的 `--input` JSON，临时文件以 0600 保存并在完成后删除。`--dry-run` 仅在需要预览时使用，用户已授权且资料完整时无需预览或二次确认。

登记分为明细保存和总登记提交，明细保存即已写入。出错后保留返回的 `registrationIds` 供核查，先查询当前状态，不直接重试提交。MCP 仅提供 `ehall_trip` 查询；真实提交需有终端能力的宿主。实网契约和提交验收范围见[接口证据](interface-evidence.md#研究生节假日行程登记2026-10-02)。

## 论文素材

软件下载使用[软件下载 Skill](../skills/njucli-software/SKILL.md)。MCP 的 `software_list`、`software_show` 返回官方目录和安装包 ID，具有终端能力的 AI 再调用 `njucli software download` 保存到用户指定位置。

`tex upload` 上传根目录单文件，保留文件名并替换同名文件，按原始字节核对，不新增图片专用 Adapter。PNG 在此前专用项目中已完成真实上传并进入 PDF；JPEG、SVG、矢量 PDF 复用该实现，但未逐种完成实网上传及编译验收。

PNG/JPEG 位图、矢量 PDF 可由 LaTeX `graphicx` 引用；TikZ 图可以直接写入正文。SVG 可以作为上传文件输入，但直接用 `\includesvg` 编译还依赖服务端环境。[CTAN 的 svg 宏包说明](https://ctan.org/pkg/svg/)明确使用 Inkscape 完成转换，当前没有确认南大编译环境具备该能力。稳妥的工作流是在本地显式转成矢量 PDF 后上传；CLI 不会偷偷转换格式，也不会把位图 PDF 称为矢量图。

AI 可以据用户提供的材料撰写章节、修改公式和排版、维护参考文献，并通过 CLI 保存、编译、核对结果。CLI 本身不是论文生成模型。毕业论文仍需核对院系模板、真实实验数据、引用与 AI 使用规定；编译成功不代表符合毕业提交要求。

## 发布边界

插件配置不含个人凭据。账号密码保存在本机账号目录，网页登录使用 CLI 专用 Chrome；读取结果可能包含论文、邮件或课程资料，由调用宿主处理。

源码仓库为 [MarcWebber/njucli](https://github.com/MarcWebber/njucli)，公开可见。全局安装直接使用该仓库，也可在源码目录构建并安装本地 tarball。类型检查、打包、MCP 协议与实际客户端安装分别记录验证结果。

## 青年平台

[青年平台 Skill](../skills/njucli-youth/SKILL.md)通过统一认证查询志愿时长、活动、第二课堂、社会实践、社团、岗位和票券。只读 MCP 使用 `youth_*` 工具，复用相同生产业务方法；报名、取消、评价及成绩单下载使用 CLI。`youth_hours` 返回官方认定总时长，`youth_activities` 的 `mine` 读取本人报名记录。所有分页工具使用返回的实际 `size` 继续翻页。
