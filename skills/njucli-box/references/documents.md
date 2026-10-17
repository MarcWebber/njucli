# SeaDoc 在线文档接口

NjuCLI 将报告、图表与白板保存在 NJU Box，提供固定链接供学生在线查看和继续编辑。NJU Table 保存结构化数据，Agent 按任务读取数据、生成图文、回填报告链接。

## 命令与正文输入

统一入口使用 `njucli box`；独立 Skill 在自身目录使用 `node scripts/run.mjs box`。

| 动作 | 命令 | 结果 |
| --- | --- | --- |
| 创建 | `njucli box doc-create REPO /报告.sdoc --input report.json --format json` | 保存正文、回读后返回 `repoId/path/docUuid/version/url` |
| 读取 | `njucli box doc-read REPO /报告.sdoc --output original.json --format json` | 最新结构化正文、版本及固定链接；保存原文快照供更新 |
| 更新 | `njucli box doc-update REPO /报告.sdoc --input edited.json --base original.json --format json` | 对比原文、提交正文、回读后返回链接 |

创建时使用 [report.json 示例](../templates/report.json)。正文为 `format_version: 4` 和 `elements` 数组，每个块与文本节点具有唯一 `id`。新增或修改支持 `title`、`header2`、`paragraph` 和 `whiteboard` 块；第一块为唯一的 `title`。文档已有其他块可保持原样。白板通过下文命令插入，可承载流程图、数据图表和手绘。

更新前通过 `doc-read --output original.json` 保存原文，再复制为 `edited.json` 修改其中的 `elements`。保持原文文件、已有节点标识和其他人的内容。更新只使用输入的 `elements`，沿用本次从远端读取的其他文档字段。

`--base` 必须对应同一资料库、路径和文档 UUID；当前版本或正文与原文有差异时，命令在写入前停止，返回 `USER_ACTION_REQUIRED`。重新读取并合并后再提交。该检查发生在上传前，服务端原子条件写入仍待核实；使用时让人和 Agent 先后编辑。

同名文件已存在时，创建命令提示继续编辑已有文档。若检查后发生同名创建，服务端可能自动改名；命令返回实际路径并提示核对后继续。写入失败或回读未完成时，会保留目标路径供检查，后续按已有状态处理，避免重复创建。

`doc-read` 返回 JSON 正文，也通过只读 MCP `box_doc_read` 提供。CLI 的 `--output` 文件包含原文快照；直接重定向 `--format json` 得到的是带 `ok/data` 的命令输出，更新时请使用 `--output` 文件。

## 表格到在线报告

适用场景：从项目进度表生成周报，用户在线补充后，下一次继续更新同一篇文档。

1. 用 `njucli table show BASE --format json` 取得工作表、视图和字段名称。
2. 用 `njucli table rows BASE "工作表名" --view "视图名" --format json` 读取数据；按 `nextPage` 翻页。报告注明来源表格、视图和数据日期，数据为本次生成时的快照。
3. 将数据整理成正文，使用 `box doc-create` 创建报告；已有报告使用 `box doc-read`、修改副本、`box doc-update`。需要图表时，将选定字段映射为 `chart.json` 的 `labels` 和 `series[].values`，使用 `box chart-create` 保存为 `.exdraw`，再用 `doc-embed-whiteboard` 插入报告。图表注明统计口径与日期，保留本次输入数据。
4. 若需要关联到表格，用现有 `table update` 将返回的 `url` 写入指定行的链接字段。例如更新文件内容：

   ```json
   [{ "row_id": "从 table rows 取得的行标识", "row": { "报告链接": "从文档命令取得的 url" } }]
   ```

   然后执行 `njucli table update BASE "工作表名" --input updates.json --format json`。字段须已存在；行和字段由用户任务确定。

5. 将文档链接交给用户或演示平台；访问者沿用 NJU Box 的权限。链接回填不改变文件共享范围。

文档正文由 Agent 按任务要求组织，表格读写复用已有 [Table 命令](../../njucli-table/SKILL.md)。演示平台的页面接线与内嵌展示需在实际平台验收。

## 模块价值与架构

适用于课程报告、项目周报、实验总结：Agent 写完后给学生一篇能打开、能改、能继续维护的文档；表格数据能变成图表，方案能变成可编辑白板。只有下载或归档需求时，直接使用现有文件命令。

```text
NJU Table（数据） → Agent 整理正文与图形 → NjuCLI Box 命令
                                         ↓
                            NJU Box：.sdoc 文档 + .exdraw 白板
                                         ↓
                             固定链接 → 网页查看、编辑
                                         ↓
                               链接按需填回 NJU Table
```

能力归属 `njucli-box`，复用 BoxClient、账号隔离和当前调用的认证会话。`documents.ts` 校验正文，`whiteboards.ts` 校验原生元素并将图表数据转换为元素，`client.ts` 保存及回读；统一 CLI、独立 Skill 和只读 MCP 共享这份实现。Table 通过已有读写命令组合。

### 开源工具选择

| 工具 | 用法与接入决策 |
| --- | --- |
| [Excalidraw 官方 CLI](https://github.com/excalidraw/cli) | MIT；本地 PNG 渲染可直接用，云端命令要求 Excalidraw+ API Key。NjuCLI 采用 NJU Box 的授权及存储接口。 |
| [Excalidraw 官方 MCP](https://github.com/excalidraw/excalidraw-mcp) | 支持 MCP Apps 的客户端可用交互画图；属于 Agent 的可选绘图入口。 |
| [社区 Excalidraw Skill](https://github.com/yctimlin/mcp_excalidraw/tree/main/skills/excalidraw-skill) | MIT；提供本地画布、CLI、Mermaid 转换和 `.excalidraw` 导出。作为 Agent 的可选绘图 Skill，导出文件传给 `whiteboard-create --input`。 |
| SeaDoc / Excalidraw 编辑器 | 在线编辑由校内已部署的组件提供，NjuCLI 调用实际 HTTP 接口。 |

Skill 是给 Agent 的操作指导；npm 依赖是程序运行时加载的代码。本次使用原生 JSON 文件衔接，新增运行依赖为零。复杂绘图可以由已有 Skill 产出原生文件，NjuCLI 负责校内保存与文档嵌入。演示平台先接收返回的 `url` 打开官方编辑器。

## 白板与图表接口

| 动作 | 命令 |
| --- | --- |
| 创建白板 | `njucli box whiteboard-create REPO /架构.exdraw --input drawing.excalidraw --format json`；省略输入创建空白画布 |
| 创建数据图表 | `njucli box chart-create REPO /进度.exdraw --input chart.json --format json` |
| 读取白板 | `njucli box whiteboard-read REPO /架构.exdraw --output board-original.json --format json` |
| 更新白板 | `njucli box whiteboard-update REPO /架构.exdraw --input board-edited.json --base board-original.json --format json` |
| 嵌入文档 | `njucli box doc-embed-whiteboard REPO /报告.sdoc BOARD_REPO /架构.exdraw --base original.json --after 块ID --format json` |

图表 JSON 见 [chart.json](../templates/chart.json)：`kind` 为 `bar` 或 `line`；各组 `values` 与 `labels` 等长，支持正数、零和负数。生成的是 Excalidraw 形状与文字，数据为生成时的快照；网页可以编辑图形，数据变化后由 Agent 重新整理并更新。

白板输入使用标准 Excalidraw 导出的 `elements`，示例见 [whiteboard.excalidraw](../templates/whiteboard.excalidraw)。新增内容支持矩形、菱形、椭圆、文字、箭头、线条、手绘和画框。每个元素需唯一 `id`、类型、位置、尺寸与正整数 `version`；文字需 `text/fontSize`，线条需 `points`。修改已有元素须递增元素版本。已有图片等元素原样保留，图片资源通过网页管理。云盘白板只存储原生元素，导出文件的画布偏好 `appState` 和附件字典 `files` 不作为白板正文提交。

白板创建同样调用文件创建接口，后缀 `.exdraw`，返回 `file_uuid`。授权调用 `GET /api/v2.1/exdraw/access-token/{repoId}/?p={path}`；页面声明 `docUuid` 与 `excalidrawServerUrl`。后续请求使用当次取得的 `Authorization: Token …`。

1. `GET {excalidrawServerUrl}/api/v1/exdraw/{fileUuid}/` 读取 `{version,elements}`。
2. `POST` 同一路径，multipart 文本字段 `doc_content` 为 `{"version":当前版本,"elements":[…]}`。响应必须同时为 `success:true`、`updated:true`；版本冲突会返回 `updated:false`，停止并交给调用方合并。
3. 回读编辑器版本与元素。该接口先保存内存状态，因此将本次接受的完整状态通过 `POST /api/v2.1/exdraw/upload-file/{fileUuid}/` 的 multipart `file` 写入文件。
4. `GET /api/v2.1/exdraw/download-link/{fileUuid}/` 后读取落盘内容，比较版本和元素，再回读编辑器状态。任一步失败保留目标路径，普通失败不自动重试。

文档内使用 `type:"whiteboard"` 节点，其字段为 `repo_id/title/file_path/link/children`。`link` 来自固定内部链接并加 `readonly=true&filetype=Excalidraw`，与本站网页插入菜单一致。文档内预览，双击打开完整白板编辑器。访问文档和白板分别要求对应文件权限；放在同一资料库便于协作。

白板更新有服务端版本检查，保存到文件仍是后续步骤；文档整体替换也包含多个请求。让人和 Agent 先后编辑，完成后刷新已打开的页面。

## 能力与前提

- NJU Box 当前启用 SeaDoc，文档保存为资料库内的 `.sdoc` 文件，正文使用结构化 JSON。
- 使用已登录的云盘会话，目标资料库或目录需要读写权限。此次调用复用了 NjuCLI 保存的账号会话。
- 文档访问凭据由云盘按文档签发；此次流程使用普通用户会话取得凭据。
- 固定内部链接沿用云盘权限，用户可在 SeaDoc 网页查看与编辑。

核实站点版本为 Seafile 13.0.28。当前文档页面给出的 `seadocServerUrl` 是 `https://box.nju.edu.cn/sdoc-server`；接入时应使用目标文档页面声明的服务地址。

## 请求流程

以下云盘请求相对 `https://box.nju.edu.cn`；编辑器请求相对页面声明的 SeaDoc 服务地址。`repoId` 为资料库 ID，`path` 为包含 `.sdoc` 后缀的库内绝对路径，`docUuid` 来自创建结果。

### 创建与链接

| 动作 | 请求 | 参数与返回值 |
| --- | --- | --- |
| 创建文档 | `POST /api/v2.1/repos/{repoId}/file/?p={path}` | URL 编码路径；表单 `operation=create`；返回 `doc_uuid`、`obj_name`、`repo_id` 等字段 |
| 固定内部链接 | `GET /api/v2.1/smart-link/` | `repo_id`、`path`、`is_dir=false`；返回 `smart_link` |
| 文档访问凭据 | `GET /api/v2.1/seadoc/access-token/{repoId}/?p={path}` | 返回 `access_token` |

创建使用登录 Cookie、`X-CSRFToken`（取自 `sfcsrftoken` Cookie）及云盘 `Referer`，表单类型为 `application/x-www-form-urlencoded`。

后续文档请求使用 `Authorization: Token <access_token>`。访问凭据和临时下载链接仅在请求过程中使用，输出给用户的是固定内部链接。

### 读取、保存与刷新

| 动作 | 服务 | 请求 | 参数与返回值 |
| --- | --- | --- | --- |
| 读取当前正文 | SeaDoc | `GET /api/v1/docs/{docUuid}/` | 返回包含 `version`、`format_version`、`elements` 的 JSON |
| 写入完整正文 | 云盘 | `POST /api/v2.1/seadoc/upload-file/{docUuid}/` | multipart 的 `file` 为完整文档 JSON，文件名 `document.sdoc`，MIME `application/json`；返回 `success: true` |
| 取得落盘内容链接 | 云盘 | `GET /api/v2.1/seadoc/download-link/{docUuid}/` | 返回 `download_link`；继续 GET 该地址读取已保存的 JSON |
| 刷新编辑器文档 | SeaDoc | `POST /api/v1/docs/{docUuid}/replace/` | JSON `{"doc_name":"文档名称.sdoc"}`；返回 `success: true` |
| 保存网页编辑状态 | SeaDoc | `POST /api/v1/docs/{docUuid}/save/` | JSON `{}`；返回 `success: true` |

已核实的正文保存顺序，CLI 沿用此流程：

1. 读取 SeaDoc 当前正文；更新时先与原文快照比较，使用保留其他节点的修改稿。
2. 调用云盘 `upload-file` 写入完整 JSON。
3. 通过 `download-link` 读取落盘文件，核对正文。
4. 调用 SeaDoc `replace` 使编辑器加载新文件。正在打开的网页提示“文档内容已经被替换，请刷新页面”。
5. 再次读取 SeaDoc 正文，并在网页刷新后核对显示。

网页编辑后的回读顺序：读取 SeaDoc 正文确认新段落，再调用 `save`，通过 `download-link` 核对落盘内容。

### 正文结构

此次新建文档的 `format_version` 为 `4`，采用 `title`、`header2`、`paragraph` 三种节点。块节点和文本节点均有 `id`；文本放在 `children[].text`。节点结构示意：

```json
{
  "id": "block-uuid",
  "type": "paragraph",
  "children": [{ "id": "text-uuid", "text": "正文内容" }]
}
```

更新时保留当前文档的其余顶层字段。编辑器可能自动补充尾部空段落，回读应核对目标内容与已有节点，区分这种格式整理和正文丢失。此次接口更新保留了之前在网页中新增的段落。

段落内可以插入网页链接：`{"id":"唯一标识","type":"link","href":"https://…","title":"链接标题","children":[{"id":"另一个唯一标识","text":"链接标题"}]}`。链接前后保留普通文本节点，可将表格来源显示为简短的可点击名称。

## 验证范围

源码与构建：`pnpm lint`、`pnpm build`、`git diff --check` 通过，统一 CLI 与独立 Box Skill 的命令帮助可用。`npm pack --dry-run --json --ignore-scripts` 确认文档、白板与图表示例及独立入口均进入安装包。本地自动集成测试待补充。

以下实网结果来自用户授权的实际图文制作，覆盖接口提交、必要回读与浏览器展示。

| 项目 | 实网结果 |
| --- | --- |
| 创建 `.sdoc`、获取文档凭据和固定链接 | 成功；创建与授权接口返回 HTTP 200 |
| 上传完整正文并读取落盘文件 | HTTP 200；保存内容与提交内容一致 |
| 通知编辑器更新并读取正文 | HTTP 200；目标段落一致 |
| 网页打开与展示 | SeaDoc 编辑器显示标题、分节标题与正文 |
| 网页编辑后接口回读与保存 | HTTP 200；新增段落可读取，落盘内容包含该段落 |
| 后续接口更新 | HTTP 200；保留网页修改，并在网页刷新后显示新增内容 |
| CLI 读取与更新原方案文档 | 成功；保留已有正文，加入架构、图表说明和来源链接 |
| CLI 白板更新、数据图表创建 | 成功；编辑器与落盘文件的版本和元素一致 |
| CLI 将两个白板嵌入原文档 | 成功；网页实际显示架构白板与成绩分布图 |
| Table → 图表 → 文档 → Table | 读取已有登分表示例的 4 条记录，汇总区间后生成图表；报告链接回填 4 行并回读一致 |

## 接入范围

- 已核实人和 Agent 先后编辑同一文档。整篇更新后，已打开的网页需要刷新。
- `version` 已在读取结果中观察到；服务端原子版本检查、多人同时编辑时的冲突合并仍待核实。读取最新版后再写入，也存在期间被其他人修改的窗口。
- 演示平台首版可返回固定内部链接，由用户打开 SeaDoc 页面。平台内部嵌入尚待在实际平台核对登录态、跨站 Cookie 与嵌入策略。
- 本次核实范围是登录会话与文档访问凭据；账号级 API Token 对整套文档流程的兼容性待核实。
- 表中实网结果对应本次授权的实际文档制作。外部演示平台与 WorkBuddy 的页面接线需在各自项目中完成。

## 接口依据

- [Seahub 文件创建实现](https://github.com/haiwen/seahub/blob/master/seahub/api2/endpoints/file.py)：`.sdoc` 创建及 `doc_uuid`。
- [Seahub SeaDoc 路由](https://github.com/haiwen/seahub/blob/master/seahub/seadoc/urls.py)与[接口实现](https://github.com/haiwen/seahub/blob/master/seahub/seadoc/apis.py)：文档授权、上传与下载链接。
- [Seahub 调用 SeaDoc 的客户端](https://github.com/haiwen/seahub/blob/master/seahub/seadoc/sdoc_server_api.py)：读取、保存与替换。
- [SeaDoc 编辑器客户端](https://github.com/haiwen/seadoc-editor/blob/main/packages/sdoc-editor/src/api/sdoc-server-api.js)：编辑器侧请求。
- [SeaDoc 文档格式](https://haiwen.github.io/seadoc-specification/)与[部署说明](https://manual.seafile.com/13.0/extension/setup_seadoc/)：正文结构与服务地址配置。
- [Seahub 白板接口](https://github.com/haiwen/seahub/blob/master/seahub/exdraw/apis.py)、[白板保存实现](https://github.com/haiwen/sdoc-server/blob/main/src/modules/exdraw/managers/excalidraw-manager.js)与[白板嵌入节点](https://github.com/haiwen/seadoc-editor/blob/main/packages/sdoc-editor/src/extension/plugins/whiteboard/helper.js)：授权、版本检查、落盘和嵌入契约。

源码链接指向上游当前分支；本站可用性以本页记录的实际请求结果为准。
