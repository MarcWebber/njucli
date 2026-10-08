---
name: njucli-box
description: 操作南京大学云盘 NJU Box，查询和扫描资料库、上传下载文件、生成分享链接，以及管理文件、版本和成员协作。
---

# 南大云盘

将 `SKILL_DIR` 设为本 Skill 目录的绝对路径。`box` 也可写作 `njubox`；首次登录运行 `node "$SKILL_DIR/scripts/run.mjs" auth login box`。

## 查找文件

```bash
node "$SKILL_DIR/scripts/run.mjs" box repos --format json
node "$SKILL_DIR/scripts/run.mjs" box list REPO / --format json
node "$SKILL_DIR/scripts/run.mjs" box scan --format json
node "$SKILL_DIR/scripts/run.mjs" box scan REPO --path /课程 --format json
node "$SKILL_DIR/scripts/run.mjs" box search "关键词" --repo REPO --page 1 --page-size 25 --format json
node "$SKILL_DIR/scripts/run.mjs" box detail REPO /课程/资料.pdf --format json
node "$SKILL_DIR/scripts/run.mjs" box link REPO /课程/资料.pdf --format json
```

`REPO` 来自 `repos` 的 `id`，绝对路径来自 `list/scan/search`。`scan` 返回文件、目录、字节数及跳过项；全盘扫描跳过加密资料库。`link` 返回供已有权限用户预览或编辑的内部链接，存储用量用 `box info` 查询。

## 上传下载与分享

```bash
node "$SKILL_DIR/scripts/run.mjs" box upload REPO ./资料.pdf --parent /课程 --format json
node "$SKILL_DIR/scripts/run.mjs" box upload REPO ./课程目录 --parent / --format json
node "$SKILL_DIR/scripts/run.mjs" box download REPO /课程 --output ./课程备份 --format json
node "$SKILL_DIR/scripts/run.mjs" box share REPO /课程/资料.pdf --expire-days 7 --format json
node "$SKILL_DIR/scripts/run.mjs" box share REPO /课程 --password "用户指定密码" --preview-only --format json
node "$SKILL_DIR/scripts/run.mjs" box upload-link REPO /收集目录 --expire-days 7 --format json
```

上传和下载均支持文件或目录，目录保留层级。上传默认同名自动改名，用户要求覆盖时加 `--replace`；下载覆盖指定本地文件。目录操作部分失败时先 `scan` 核对已完成内容。

分享和上传链接的结果含 `url/id/repoId/path/expires/protected`。把实际 `url` 作为 Markdown 链接交付，附上有效期和用户指定的密码。`--preview-only` 关闭分享下载权限；`upload-link` 用于收集文件。省略有效期时采用学校设置。用 `shares REPO` 或 `upload-links REPO` 查询链接，再以结果的 `id` 执行 `unshare ID` 或 `revoke-upload-link ID`。

## 管理与协作

下表命令均接在 `node "$SKILL_DIR/scripts/run.mjs" box` 后，可加 `--format json`。

| 任务 | 命令 |
| --- | --- |
| 创建、改名资料库 | `create-repo "名称"`、`rename-repo REPO "新名称"` |
| 创建目录、改名 | `mkdir REPO /课程/资料`、`rename REPO /课程/资料.pdf 新名称.pdf` |
| 复制、移动 | `copy REPO PATH DEST_REPO DEST_DIR`、`move REPO PATH DEST_REPO DEST_DIR` |
| 收藏 | `star REPO PATH`、`starred`、`unstar REPO PATH` |
| 文件锁定 | `lock REPO PATH`、`unlock REPO PATH` |
| 版本与回收站 | `history REPO --page 1`、`trash REPO` |
| 恢复文件或目录 | `restore REPO PATH COMMIT_ID`；目录加 `--directory` |
| 删除文件或资料库 | `remove REPO PATH`、`remove-repo REPO` |
| 恢复资料库 | `deleted-repos`、`restore-repo REPO` |
| 查询群组与权限 | `groups`、`collaborators REPO --path /课程 --type user` |
| 分享给成员 | `share-to REPO /课程 RECIPIENT --type user --permission r` |
| 分享给群组 | `share-to REPO /课程 GROUP_ID --type group --permission rw` |
| 撤销成员共享 | `unshare-to REPO /课程 RECIPIENT --type user` |

复制、移动的目标是已存在目录，同名时选择新名称或位置。`COMMIT_ID` 来自 `history/trash`，回收站下一页使用返回的 `cursor`；恢复可能替换当前版本。成员使用站内账号标识，群组 ID 来自 `groups`；`r/rw` 分别为只读、读写。

写入按用户指定目标提交一次并回读。提交或回读失败时先查询目标状态；完成后报告实际路径或链接。核对远端字段及验证范围时读取[接口说明](references/interfaces.md)。
