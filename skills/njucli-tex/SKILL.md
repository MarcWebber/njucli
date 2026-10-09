---
name: njucli-tex
description: 管理南京大学 TeXPage 项目，撰写与修改 LaTeX 论文、上传插图与参考文献、编译并读取错误日志。用户涉及南大在线 LaTeX 平台 (tex.nju.edu.cn) 时使用。
---

# TeX 写作

以下命令在本 Skill 目录运行。
首次使用需登录：`node scripts/run.mjs auth login tex`（需要本机安装 Google Chrome）。同一账号请串行执行写操作命令。

## 项目与模板

```bash
node scripts/run.mjs tex projects --format json
node scripts/run.mjs tex templates --format json
node scripts/run.mjs tex create "论文标题" --format json
node scripts/run.mjs tex from-template TEMPLATE_KEY --format json
```

`projects` 查看项目列表，取得项目标识 `PROJECT`（对应 `projectKey`）和版本号 `VERSION`（对应 `versionNo`）。
`templates` 返回模板的 `key`，选择时核对用户的学位和院系要求。列表的 `hasMore` 为 `true` 时，用 `--page` 查询下一页。

## 查看、修改与上传

```bash
node scripts/run.mjs tex files PROJECT --version VERSION --format json
node scripts/run.mjs tex read PROJECT FILE_KEY --version VERSION --format json
node scripts/run.mjs tex write PROJECT main.tex --version VERSION --input ./main.tex --format json
node scripts/run.mjs tex upload PROJECT ./references.bib --version VERSION --format json
```

`files` 列出项目文件，返回 `path` 与 `fileKey`。
读取使用 `fileKey`；写入正文使用相对路径。

编辑器需要处于自动同步模式。`tex write` 用本地输入替换远端全文。修改前先读取原文，在本地修改并保留任务之外的内容，再提交。结果不明确时，先用 `tex read` 核对。

`upload` 每次上传一个非隐藏文件到根目录，文件须小于 50 MiB，同名文件直接替换。插图可用 PNG、JPEG 或 PDF；SVG 先在本地转成 PDF。

## 编译、排错与下载

```bash
node scripts/run.mjs tex compile PROJECT main.tex --version VERSION --output ./paper.pdf --format json
node scripts/run.mjs tex log PROJECT --version VERSION --format json
node scripts/run.mjs tex pdf PROJECT --version VERSION --output ./latest.pdf --format json
node scripts/run.mjs tex download PROJECT --version VERSION --output ./source.zip --format json
node scripts/run.mjs tex rename PROJECT "新论文标题" --format json
```

`compile` 触发云端编译，仅在本次编译成功后保存 PDF 到 `--output` 指定路径。
若编译失败，运行 `tex log` 查看日志，修正后再编译。

`pdf` 下载最近一次已有编译的 PDF；`download` 下载完整项目源码包。
检查生成的 PDF 排版，再提供项目链接、本地 PDF 路径和编译结果。接口字段见[接口说明](references/interfaces.md)。
