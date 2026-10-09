---
name: njucli-box
description: 操作南京大学云盘 (NJU Box)，查询与扫描资料库、上传下载文件、管理分享链接、收集链接与协作权限。用户涉及南大云盘或 njucli box 时使用。
---

# 南大云盘

以下命令在本 Skill 目录运行。首次使用需登录云盘：`node scripts/run.mjs auth login box`。

## 查找与浏览

```bash
node scripts/run.mjs box repos --format json
node scripts/run.mjs box list REPO / --format json
node scripts/run.mjs box scan REPO --path /课程 --format json
node scripts/run.mjs box search "关键词" --repo REPO --format json
node scripts/run.mjs box detail REPO /课程/资料.pdf --format json
node scripts/run.mjs box link REPO /课程/资料.pdf --format json
```

`REPO` 来自 `repos` 的 `id`，云盘中的绝对路径来自 `list`、`scan` 或 `search`。`scan` 列出文件并统计数量与大小；省略资料库时扫描全盘，跳过加密资料库。

`link` 返回内部链接，访问者需要已有权限。存储用量用 `box info` 查询。

## 上传、下载与分享

```bash
node scripts/run.mjs box upload REPO ./资料.pdf --parent /课程 --format json
node scripts/run.mjs box upload REPO ./本地目录 --parent / --format json
node scripts/run.mjs box download REPO /课程/资料.pdf --output ./资料.pdf --format json
node scripts/run.mjs box share REPO /课程/资料.pdf --expire-days 7 --format json
node scripts/run.mjs box upload-link REPO /作业收集 --expire-days 7 --format json
```

上传和下载均支持文件或目录，并保留目录层级。上传同名文件默认自动改名，用户要求覆盖时加 `--replace`；下载会覆盖本地指定文件。

分享可加 `--password "密码"` 或 `--preview-only`（仅预览）。把返回的 `url` 作为可点击链接交给用户，并附有效期和设置的密码；省略有效期时采用学校设置。`upload-link` 生成用于收集文件的链接。

用 `shares REPO` 或 `upload-links REPO` 查看已有链接，再用结果的 `id` 执行 `unshare ID` 或 `revoke-upload-link ID`，这些命令都接在 `node scripts/run.mjs box` 后。

## 文件管理与协作

```bash
node scripts/run.mjs box mkdir REPO /课程/新课件 --format json
node scripts/run.mjs box move REPO /课程/旧资料 REPO /归档 --format json
node scripts/run.mjs box history REPO --page 1 --format json
node scripts/run.mjs box restore REPO /课程/资料.pdf COMMIT_ID --format json
```

其他管理命令接在 `node scripts/run.mjs` 后：

- 创建与改名：`box mkdir REPO 路径`、`box rename REPO 路径 新名称`
- 复制与移动：`box copy REPO 原路径 目标REPO 目标目录`、`box move REPO 原路径 目标REPO 目标目录`（目标目录须已存在）
- 收藏与锁定：`box star/unstar REPO 路径`、`box lock/unlock REPO 路径`
- 版本与回收站：`box history REPO` 查看版本，`box restore REPO 路径 COMMIT_ID` 恢复（恢复目录须加 `--directory`）；`box trash REPO` 查看回收站
- 共享权限：`box share-to REPO 路径 用户账号 --type user --permission r`；`r` 为只读，`rw` 为读写。共享给群组时，将用户账号换成 `box groups` 返回的群组 ID，类型改为 `--type group`

`COMMIT_ID` 来自 `history` 或 `trash` 的 `commitId`。回收站用返回的 `cursor` 传给 `--cursor` 翻页；恢复可能替换当前文件。

目录操作部分失败或写入结果不明时，先用 `list` 或 `scan` 核对已完成内容。资料库管理等命令见 `node scripts/run.mjs box --help`，接口字段见[接口说明](references/interfaces.md)。
