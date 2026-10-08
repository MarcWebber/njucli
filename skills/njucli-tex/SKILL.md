---
name: njucli-tex
description: 管理南京大学 TeXPage 项目，撰写和修改 LaTeX 论文、上传插图与参考文献、编译并读取错误日志。适用于 tex.nju.edu.cn 或将论文保存到南大 TeX 平台的任务。
---

# TeX 写作

将 `SKILL_DIR` 设为本 Skill 目录的绝对路径。准备本机 Google Chrome，首次运行 `node "$SKILL_DIR/scripts/run.mjs" auth login tex`；同一账号串行执行命令。

## 项目与模板

```bash
node "$SKILL_DIR/scripts/run.mjs" tex projects --format json
node "$SKILL_DIR/scripts/run.mjs" tex templates --format json
node "$SKILL_DIR/scripts/run.mjs" tex create "论文标题" --format json
node "$SKILL_DIR/scripts/run.mjs" tex from-template TEMPLATE_KEY --format json
```

从 `projects` 的 `data.items` 取得 `projectKey/versionNo`，从 `templates` 取得模板 `key`。新建结果在 `data` 中返回标识。论文模板按用户的学位和院系要求选择；平台模板目录与学校论文规范分别核对。

## 修改与编译

```bash
node "$SKILL_DIR/scripts/run.mjs" tex files PROJECT --version VERSION --format json
node "$SKILL_DIR/scripts/run.mjs" tex read PROJECT FILE_KEY --version VERSION --format json
node "$SKILL_DIR/scripts/run.mjs" tex write PROJECT main.tex --version VERSION --input ./main.tex --format json
node "$SKILL_DIR/scripts/run.mjs" tex upload PROJECT ./references.bib --version VERSION --format json
node "$SKILL_DIR/scripts/run.mjs" tex compile PROJECT main.tex --version VERSION --output ./paper.pdf --format json
node "$SKILL_DIR/scripts/run.mjs" tex log PROJECT --version VERSION --format json
```

`files` 返回 `path/fileKey`：读取使用 `fileKey`，写入和编译使用路径。先读原文，在本地修改 UTF-8 正文，再用 `write` 替换整个文件；保留任务之外的内容。编辑器需处于自动同步模式，命令会核对保存后的正文。

`upload` 支持根目录单个非隐藏文件，须小于 50 MiB；同名文件直接替换，支持文本和二进制。插图可用 PNG/JPEG、矢量 PDF 或 TikZ；服务器 Inkscape 环境待确认，SVG 可先在本地转为 PDF。使用用户材料和已核实的引用。

编译失败时读 `log` 定位错误，修正后再编译。`compile` 只在本次编译成功后保存 PDF；完成后检查排版。已提交而回读失败时先查询文件状态。

## 下载与交付

```bash
node "$SKILL_DIR/scripts/run.mjs" tex download PROJECT --version VERSION --output ./source.zip --format json
node "$SKILL_DIR/scripts/run.mjs" tex pdf PROJECT --version VERSION --output ./latest.pdf --format json
node "$SKILL_DIR/scripts/run.mjs" tex rename PROJECT "新标题" --format json
```

`pdf` 下载最近已有的编译结果。交付实际项目链接、修改文件、编译结果和本地 PDF 路径，并说明 PDF 检查结果。项目、编辑及编译协议与验证范围见[接口说明](references/interfaces.md)。
