---
name: njucli-software
description: 查询并下载南京大学提供的正版软件安装包，包括 Adobe Creative Cloud、WPS、MathType、Origin 等校园授权软件。用户涉及校园正版软件下载时使用。
---

# 正版软件

以下命令在本 Skill 目录运行。
校内安装包下载需要连接校园网或官方 VPN；Adobe CC 在线安装器支持公网直连下载。

## 查询与下载

```bash
node scripts/run.mjs software list --format json
node scripts/run.mjs software show adobe-cc --format json
node scripts/run.mjs software download adobe-cc FILE_ID --output ./CreativeCloud.dmg --format json
```

软件 ID 取自 `list`（如 `adobe-cc`、`adobe`、`wps-365`、`mathtype`、`origin`）。

按用户的系统和架构选包，`FILE_ID` 使用 `show` 返回的完整 `files[].id`。Adobe CC 的 ID 中，`macarm64` 表示 Apple Silicon，`osx10` 表示 Intel Mac，`win64`、`winarm64` 表示对应的 Windows 架构。

下载保存到 `--output` 指定位置，同名文件直接覆盖；完成后交付文件绝对路径与大小。

## 登录与授权说明

Adobe CC 安装器使用“学工号@nju.edu.cn”登录南大统一认证，再选择所需产品。`adobe` 是学校提供的离线包目录；WPS、Origin、MathType 等软件按学校说明安装和激活。
