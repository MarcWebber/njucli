---
name: njucli-box
description: 操作南京大学云盘 (NJU Box)，创建和更新 SeaDoc 文档、Excalidraw 白板和数据图表，将图形嵌入文档，管理文件、分享链接与协作权限。用户涉及校内文档写作、画图、南大云盘或 njucli box 时使用。
---

# 南大云盘

首次使用需登录云盘：`njucli auth login box`。

## 查找与浏览

```bash
njucli box repos --format json
njucli box list REPO / --format json
njucli box scan REPO --path /课程 --format json
njucli box search "关键词" --repo REPO --format json
njucli box detail REPO /课程/资料.pdf --format json
njucli box link REPO /课程/资料.pdf --format json
```

`REPO` 来自 `repos` 的 `id`，云盘中的绝对路径来自 `list`、`scan` 或 `search`。`scan` 列出文件并统计数量与大小；省略资料库时扫描全盘，跳过加密资料库。

`link` 返回内部链接，访问者需要已有权限。存储用量用 `box info` 查询。

## 在线文档

将报告、方案或总结保存为用户可以继续编辑的 SeaDoc 文档。先复制并填写[正文示例](templates/report.json)，再创建：

```bash
njucli box doc-create REPO /课程项目周报.sdoc --input ./report.json --format json
njucli box doc-read REPO /课程项目周报.sdoc --output ./original.json --format json
cp original.json edited.json
# 编辑 edited.json 中的 elements，保留用户已有内容和节点 id。
njucli box doc-update REPO /课程项目周报.sdoc --input ./edited.json --base ./original.json --format json
```

`original.json` 保持原样，更新前会对比当前文档的标识、版本与正文；变化时重新读取并合并。支持标题、二级标题、段落和白板块，使用原生 SeaDoc JSON；已有其他内容可保持原样。`doc-read --output` 覆盖指定本地文件。

创建和更新成功后给用户返回的 `url`，访问沿用云盘权限。整篇更新后，已打开的网页需要刷新。并发修改、格式要求和失败后的处理见 [SeaDoc 文档说明](references/documents.md)。MCP 提供只读 `box_doc_read`，写入使用 CLI。

从协同表格生成周报时，先用 `table rows` 读取指定视图，再整理正文并创建或更新文档，最后用 `table update` 将返回的链接填写到指定行。具体步骤见[表格到在线报告](references/documents.md#表格到在线报告)。

## 白板与图表

```bash
njucli box whiteboard-create REPO /项目架构.exdraw --input ./drawing.excalidraw --format json
njucli box chart-create REPO /项目进度.exdraw --input ./chart.json --format json
njucli box doc-read REPO /课程项目周报.sdoc --output ./original.json --format json
njucli box doc-embed-whiteboard REPO /课程项目周报.sdoc REPO /项目架构.exdraw --base ./original.json --format json
```

白板输入可由 Agent 或 Excalidraw Skill 生成，参照[原生图形示例](templates/whiteboard.excalidraw)；省略 `--input` 创建空画布。图表参照[数据示例](templates/chart.json)，`kind` 支持 `bar`、`line`，`labels` 对应每组 `series[].values`。图表也是可编辑的白板，可调整文字、颜色、形状和连线。

`doc-embed-whiteboard` 默认追加到文末；`--after 块ID` 指定插入位置。每次插入前重新保存文档快照。文档内可预览、全屏查看，双击进入白板编辑；刷新文档后展示更新后的图形。

继续编辑白板：先 `whiteboard-read REPO /项目架构.exdraw --output board-original.json`，复制修改后执行 `whiteboard-update REPO /项目架构.exdraw --input board-edited.json --base board-original.json`。修改已有元素时递增其 `version`，保留其他元素。MCP 提供 `box_whiteboard_read`。

白板格式、保存契约、开源工具选择和架构见[图文能力说明](references/documents.md#白板与图表接口)。

## 上传、下载与分享

```bash
njucli box upload REPO ./资料.pdf --parent /课程 --format json
njucli box upload REPO ./本地目录 --parent / --format json
njucli box download REPO /课程/资料.pdf --output ./资料.pdf --format json
njucli box share REPO /课程/资料.pdf --expire-days 7 --format json
njucli box upload-link REPO /作业收集 --expire-days 7 --format json
```

上传和下载均支持文件或目录，并保留目录层级。上传同名文件默认自动改名，用户要求覆盖时加 `--replace`；下载会覆盖本地指定文件。

分享可加 `--password "密码"` 或 `--preview-only`（仅预览）。把返回的 `url` 作为可点击链接交给用户，并附有效期和设置的密码；省略有效期时采用学校设置。`upload-link` 生成用于收集文件的链接。

用 `shares REPO` 或 `upload-links REPO` 查看已有链接，再用结果的 `id` 执行 `unshare ID` 或 `revoke-upload-link ID`，这些命令都接在 `njucli box` 后。

## 文件管理与协作

```bash
njucli box mkdir REPO /课程/新课件 --format json
njucli box move REPO /课程/旧资料 REPO /归档 --format json
njucli box history REPO --page 1 --format json
njucli box restore REPO /课程/资料.pdf COMMIT_ID --format json
```

其他管理命令接在 `njucli` 后：

- 创建与改名：`box mkdir REPO 路径`、`box rename REPO 路径 新名称`
- 复制与移动：`box copy REPO 原路径 目标REPO 目标目录`、`box move REPO 原路径 目标REPO 目标目录`（目标目录须已存在）
- 收藏与锁定：`box star/unstar REPO 路径`、`box lock/unlock REPO 路径`
- 版本与回收站：`box history REPO` 查看版本，`box restore REPO 路径 COMMIT_ID` 恢复（恢复目录须加 `--directory`）；`box trash REPO` 查看回收站
- 共享权限：`box share-to REPO 路径 用户账号 --type user --permission r`；`r` 为只读，`rw` 为读写。共享给群组时，将用户账号换成 `box groups` 返回的群组 ID，类型改为 `--type group`

`COMMIT_ID` 来自 `history` 或 `trash` 的 `commitId`。回收站用返回的 `cursor` 传给 `--cursor` 翻页；恢复可能替换当前文件。

目录操作部分失败或写入结果不明时，先用 `list` 或 `scan` 核对已完成内容。资料库管理等命令见 `njucli box --help`，接口字段见[接口说明](references/interfaces.md)。
