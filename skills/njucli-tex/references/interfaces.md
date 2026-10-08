# TeX 写作接口

## TeX

[南大 TeX 控制台](https://tex.nju.edu.cn/console)使用 TeXPage。查询使用 HTTP 会话，编辑、上传和编译使用可见 Chrome；统一认证说明见[认证 Skill](https://github.com/MarcWebber/njucli/blob/main/skills/njucli-auth/SKILL.md)。

JSON 响应为 `{status: {code}, result}`：`1` 成功、`1003` 登录失效、`1010` 二次验证。以下路径相对 `https://tex.nju.edu.cn`，来自官方前端及实网核对。

### 项目与文件

| 动作 | 请求 | 契约 |
| --- | --- | --- |
| 模板目录 | `GET /zh/template?page=...` | HTML 中 `a[href^="/zh/template/"] h2` 提供标识和名称，下一页按 href 判断 |
| 项目列表 | `GET /api/project` | query：`page/projectName/sortBy=updateAt/getType=all`；结果：`list/pinnedList/hasMore` |
| 空白创建 | `POST /api/project` | JSON `{projectName}`，返回 `projectKey` |
| 模板创建 | `POST /api/project/byTemplate` | JSON `{key, isGuide:false}`，返回 `projectKey/versionNo` |
| 重命名 | `PUT /api/project/rename` | JSON `{projectKey, projectName}` |
| 文件列表 | `GET /api/project/files` | query：`projectKey/versionNo`；`result` 为数组，字段 `fileKey/filePath/isDir/fileType` |
| 文件原文 | `GET /api/project/file` | query：`projectKey/versionNo/fileKey`；重定向至 `latex-file.texpageusercontent.com`，返回原始字节 |
| 源码 ZIP | `GET /api/project/download` | query：`projectKey/versionNo`；返回 ZIP |

编辑地址为 `/project/user/<projectKey>/<versionNo>`。正文按 UTF-8 解码，签名下载地址保留在请求内部。

### 文本保存与上传

`write` 通过官方编辑器的 `.cm-content[contenteditable="true"]` 保存已有文本文件，协作协议由编辑器处理。修改前核对项目、版本和文件路径，并要求自动同步模式；完成后读取服务器正文核对。

`upload` 使用原生上传控件，支持根目录单个非隐藏文件，大小须小于 50 MiB。同名文件点击原生覆盖按钮；同名目录拒绝。登记请求为 `POST /api/project/file`，关键字段为 `addType:"upload"`、`projectKey/versionNo/fileName/parentKey/overwrite`，根目录 `parentKey="0"`。登记响应匹配目标后，再下载文件逐字节核对。

### 编译与日志

原生编译通过 Socket.IO `request` 发送 `action:"get:/api/project/compile"`，按 `requestId` 匹配 `response`。CLI 点击编辑器编译按钮并读取本次结果。

| 读取 | 契约 |
| --- | --- |
| 最近结果 | `GET /api/project/compileResult/pdf?projectKey=...&versionNo=...`；含 `pdfUrl/pdfSize/logUrl/blgUrl` |
| PDF | `GET /api/project/pdf/download?projectKey=...&versionNo=...` |
| 日志 | 读取结果的 `logUrl`，返回文本 |

编译失败时接口仍可能返回 `code=1` 和旧 PDF，因此下载前检查本次日志。错误匹配 `!` 或文件名加行号，排除 `ignored error`，并拒绝 `No pages of output.`；通过后才下载并校验 `%PDF-`。

### 验证范围

CLI 已实网完成空白/模板创建、重命名、正文保存及回读、源码下载、编译、PDF/日志读取和新文件上传；编译失败阻止旧 PDF 下载已验证。MCP 的项目、文件、正文、日志和模板读取已通过安装产物核对。同名上传替换待实网验收。
