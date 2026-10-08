# 正版软件接口

## 正版软件下载

| 来源 | 解析范围 |
| --- | --- |
| [南大软件目录](https://itsc.nju.edu.cn/zbrj/list.htm) | `.wp_listcolumn > .wp_column > a` 软件栏目 |
| [Adobe](https://itsc.nju.edu.cn/adobe/list.htm)及[离线下载页](https://itsc.nju.edu.cn/0e/53/c50138a593491/page.htm) | `.wp_articlecontent` 内的下载链接 |
| [Adobe CC 直接下载](https://helpx.adobe.com/cn/download-install/apps/download-install-apps/creative-cloud-apps/download-creative-cloud-desktop-app-using-direct-links.html) | `table.dexter-Table a[href]`，按系统及架构选择 |
| [WPS 365](https://itsc.nju.edu.cn/WPS365/list.htm)、[MathType](https://itsc.nju.edu.cn/MathType/list.htm)、[Origin](https://itsc.nju.edu.cn/Origin_56479/list.htm) | 正文内的安装包链接 |

`list` 返回学校栏目及 `adobe-cc`；`show` 返回说明链接和安装包。`files[].id` 使用 URL 最后两段，保留平台路径；同一 URL 去重。下载主机限定为页面提供的 `download.nju.edu.cn`、`ccmdl.adobe.com`、`ccmdls.adobe.com`，使用 HTTPS。

验证范围：软件目录和下载链接已实网读取；源码与安装后的 CLI 均完成 Adobe CC macarm64 安装包下载，文件为 311,485,111 字节。校内服务器完整下载待校园网或 VPN 验收。本地集成覆盖架构 ID、链接去重、流式下载、覆盖输出及 HTML 响应拒绝。
