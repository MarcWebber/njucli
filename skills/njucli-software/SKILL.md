---
name: njucli-software
description: 使用 NjuCLI 查找南京大学正版软件、选择对应系统的官方安装包并下载到本地。适用于 Adobe、WPS、MathType、Origin 等校园软件下载需求。
---

# 正版软件

将 `SKILL_DIR` 设为本 Skill 目录的绝对路径。

```bash
node "$SKILL_DIR/scripts/run.mjs" software list --format json
node "$SKILL_DIR/scripts/run.mjs" software show adobe-cc --format json
node "$SKILL_DIR/scripts/run.mjs" software download adobe-cc FILE_ID --output ./CreativeCloud.dmg --format json
```

软件 ID 来自 `list`，安装包 ID 使用 `show` 返回的 `files[].id`。按用户系统选取原始 ID：Adobe CC 的 `macarm64` 为 Apple Silicon、`osx10` 为 Intel Mac，`win64/winarm64` 为相应 Windows 架构。下载到指定位置，已有输出文件会被覆盖；交付返回的绝对路径和字节数。

`adobe-cc` 提供 Adobe 官方在线安装器；安装后以“学工号@nju.edu.cn”进入南大统一认证，再安装所需产品。`adobe` 为学校离线包目录；`wps-365/mathtype/origin` 使用学校提供的安装包。校内下载服务器需要校园网或官方 VPN，安装和激活按用户指定的操作办理。

来源：[南大正版软件目录](https://itsc.nju.edu.cn/zbrj/list.htm)、[Adobe 离线包](https://itsc.nju.edu.cn/0e/53/c50138a593491/page.htm)、[Adobe CC 直接下载页](https://helpx.adobe.com/cn/download-install/apps/download-install-apps/creative-cloud-apps/download-creative-cloud-desktop-app-using-direct-links.html)。目录、链接及 Adobe CC macarm64 下载已实网验证；校内安装包完整下载待校园网验收。
