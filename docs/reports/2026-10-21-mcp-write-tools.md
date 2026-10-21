# MCP 全量工具与邮件发送验证

基于 `main` 提交 `0528b7c4ad33b9d18daaf99897d2b16e7ed5b01a`，分支为 `feat/mcp-write-tools`。CLI 与 MCP 共用业务方法、账号会话和输入定义，保留统一安装的完整 Skills 套件。

## 检查结果

| 检查 | 入口与结果 |
| --- | --- |
| 类型检查 | `pnpm lint` 通过 |
| 构建与安装 | `pnpm test` 通过；两项用例分别运行真实子进程锁检查和 npm tarball 全局安装检查 |
| 全量 MCP 注册 | 安装后的 `njucli mcp` 提供 245 个工具，包含 158 个查询和 87 个写操作；244 个公开 CLI 动作全部有对应入口 |
| 套件与依赖 | 实际 tarball 安装后，18 个业务 Skill、全局命令、模板及 MCP 查询可用 |
| 公开实网 | MCP `campus_mirrors` 传入 `{"query":"ubuntu"}`，返回 8 条镜像记录；Ubuntu 地址为 `https://mirror.nju.edu.cn/ubuntu/` |
| SMTP 公开协议 | `smtp.exmail.qq.com:465` TLS 证书验证通过；真实 EHLO 响应声明 `AUTH LOGIN PLAIN` |

原始结果见[工具覆盖](assets/2026-10-21-mcp-write-tools/tool-coverage.json)、[构建与实际安装日志](assets/2026-10-21-mcp-write-tools/checks.txt)、[公开 MCP 调用结果](assets/2026-10-21-mcp-write-tools/public-mcp-result.json)和[SMTP 握手](assets/2026-10-21-mcp-write-tools/smtp-handshake.json)。

## 业务范围

MCP 注册已有的云盘上传下载、在线文档与白板编辑、表格创建与填写、表单提交、TeX 编辑与编译、选退课、个人资料维护、行程提交、报名取消、宿舍绑定与解绑、账号认证和升级操作。校园卡、空闲教室与公共镜像等主分支能力保持可用。

`mail send` 与 `mail_send` 调用同一份 `MailClient.send`，支持文本或 HTML 正文、抄送、密送、本地附件和回复线程。发件人取当前绑定邮箱；SMTP 接收全部目标收件人后返回成功，部分拒收保留已接收与拒收地址。

本次实网检查限于公开镜像及 SMTP TLS/EHLO，认证与投递保持待验。真实邮件发送、收件箱最终投递和其他认证写操作的实际业务结果，随用户明确指定的业务目标与材料核对。体育预约及取消返回官网办理链接；奖学金保存草稿后从核对链接继续提交。
