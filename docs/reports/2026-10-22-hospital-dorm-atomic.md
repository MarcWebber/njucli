# 校医院与宿舍原子能力实网记录

日期：2026-10-22，Asia/Shanghai。使用用户当次明确指定的校园账号和独立执行容器，CLI 为当前源码的转译产物。记录只包含命令、字段、数量和状态；身份、证件、医疗结果、Cookie 和文件下载标识未保存到报告或附件。

CLI 原始脱敏执行摘要：[cli-summary.json](assets/2026-10-22-hospital-dorm-atomic/cli-summary.json)。MCP 实际调用摘要：[mcp-summary.json](assets/2026-10-22-hospital-dorm-atomic/mcp-summary.json)。

## 校医院 CLI

以下入口均通过正式 `njucli hospital` 命令执行；远端 ID 在日志中替换为 `<remote-id>`。

| 命令 | 实际结果 |
| --- | --- |
| `kinds` | 5 类：体检、疫苗、急救课程、活动、结核筛查 |
| `projects --kind 2` | 返回 4 个项目；执行前本人已预约数为 0 |
| `campuses <project-id>` | 返回鼓楼和仙林 2 个校区 |
| `dates <project-id> 仙林校区` | 返回 1 个有余量的日期 |
| `slots <project-id> 仙林校区 <date>` | 返回 6 个有余量的时段 |
| `reports` | 本人报告总数 2，两份 PDF 均已生成 |
| `report-download <report-id> /tmp/njucli-hospital-report.pdf` | 下载原 PDF，11,851 字节，文件头 `%PDF-`；未读取或公开医疗内容 |
| `hepatitis-reports` | 成功，当前账号为真实空列表 |
| `insurance-info` | 成功，返回当前账号资料；日志只保存字段名及缺失字段名 |
| `insurance-fields` | 3 种户籍性质、6 种证件类型 |
| `insurance-records` | 成功，当前账号参保记录为真实空列表 |
| `insurance-opening` | 返回 1 条当前参保开放设置，年度 2027 |
| `book <project-id> --kind 2 --campus 仙林校区 --date <date> --slot <slot>` | 成功创建本次临时预约，命令内部从项目列表确认预约 ID 和目标时段；外部再次调用 `projects` 确认本次记录存在 |
| `cancel <booking-id> --kind 2` | 成功取消本次预约，命令内部回读确认；外部再次调用 `projects` 确认预约数恢复为 0 |

预约创建与取消由同一个实际执行脚本串行完成，清理位于 `finally`。取消只针对执行前不存在的本次目标预约，原有记录保持不变。实际院内服务及支付均未执行。

## MCP

实际 stdio MCP 客户端连接当前 `njucli mcp`，以下调用均返回成功：

| 工具 | 参数 | 实际结果 |
| --- | --- | --- |
| `hospital_kinds` | `{}` | 5 个类别 |
| `hospital_projects` | `{"kind":2}` | 4 个项目 |
| `hospital_reports` | `{"page":1,"size":20}` | 总数 2、本页 2 |
| `hospital_insurance_fields` | `{}` | 户籍性质与证件类型两个目录 |

CLI 与 MCP 调用同一份 `HospitalClient` 和账号会话；本次 MCP 的成功范围为上述四个查询，预约成功写入的证据来自 CLI。

随后把新增的 `HospitalClient` 类及 `client.ts` 收敛为 `hospital.ts` 的函数实现，统一 CLI/MCP 保持相同原子操作。正式 CLI 再次成功读取目录、项目、校区、日期、时段、报告、原 PDF、医保资料及记录，并完成预约创建、本人回读、取消和最终无预约回读。函数化复验中医保开放信息出现局部变量与 `rows` 函数同名的问题，已更名修正，正式 CLI 单独回读当前参保年度 2027 成功。此次未运行类型检查或测试套件。

函数化复验日志：[正式 CLI 记录](assets/2026-10-22-hospital-dorm-atomic/function-cli-summary.json)，其中保留最初的同名变量错误，后续修复回读见本文说明；最终正式 MCP 也成功读取本人空参保记录。

## 医保资料与写入边界

已读取官方 `MyInfo.aspx`、`MySI.aspx` 和 `MySIAdd.aspx` 的真实前端及 Handler 响应。本轮按用户最后范围保留本人医保资料、参保与缴费状态查询，移除了尚未验证的资料更新、参保创建和申请删除入口。

当前真实资料缺少以下字段：`residenceType`、`email`、`insuranceDocumentType`、`insuranceDocumentNumber`。官方 `API_SIStudent.ashx?action=checkSIAdd` 真实返回业务码 `1` 和“请先补充基本信息后再进行参保申请”。没有虚构证件、户籍或联系资料补齐。

初版实网脚本包含参保创建而未包含该动作的删除清理，自动审批审核因可能遗留真实医保申请而拒绝执行。该脚本未执行写入；随后安全替代脚本移除了参保创建，完成了本报告中的查询、PDF 下载和可取消预约。医保资料更新、参保创建、参保删除没有成功写入证据，不能计为已验收。

## 宿舍与后勤入口探索

### 电费绑定与剩余电量

通过现有 `DormClient` 读取官方目录，以本次新增临时房间绑定进入 `/epay/h5/nju/electric/charge`，读取官方前端后在 `finally` 解除本次绑定。清理后绑定 ID 集合与执行前相同。

当前官方充值页面的业务请求为 `/epay/h5/elecPayInit.json`，参数为 `sysid/buildid/roomid/amount`；本次只读取页面，没有调用该支付初始化接口、充值或支付。该页面未提供剩余电量的查询请求。

[后勤旧版须知](https://hqjt.nju.edu.cn/dlzx/8b/d5/c1400a297941/page.htm)所列仙林 `172.27.2.95:8899/query/Default.aspx` 本次直连为 `socket hang up`；现有校园代理只支持学校域名 HTTPS，对该 HTTP IP 请求返回 403。不能据此编造一个剩余电量 API，当前没有新增可用的电量查询命令。

### 宿舍报修

[官方宿舍报修指南](https://oi.nju.edu.cn/0c/27/c21558a724007/page.htm)确认学校提供新增报修、二次维修和维修评价，并指向南京大学 APP 与办事大厅入口。

本次使用已登录账号查询 eHall 目录和“报修”“维修”“宿舍”三个关键词：

- “宿舍”下实际有权使用的应用为“宿舍申办”，appId `4618295887225301`；已读取其实际配置，确认为住宿申请，未将其冒充报修。
- “报修”返回信息化“故障报修”服务，关联 Campusphere 的“意见反馈”，appId `5917771565241315`；当前结果没有宿舍报修应用。
- 当前账号 `onlineYwtbApps` 返回 11 个应用，没有宿舍报修。
- [后勤服务反馈平台](https://hqfk.nju.edu.cn/hqfk/)公开前端可读取，其功能和请求 `wyfk/fk/save`、`wyfk/fk/info` 为意见反馈；未将后勤反馈声称为宿舍维修接口。

另从官方 PC 前端确认移动大厅为 `/ywtb-mobile/index.html`，读取其实际使用的 `/jsonp/ywtb/service/getMobileServices`。当前移动目录里的“后勤服务”和“后勤服务反馈”均指向 `hqfk.nju.edu.cn`，仍未找到独立宿舍报修应用。已通过 SSO 进入后勤平台，仅读取当前账号获授菜单与表单目录；反馈类型实际为咨询、建议、投诉、表扬，校区为鼓楼、仙林、浦口和苏州。没有提交后勤反馈，也没有以该平台代替宿舍报修。

宿舍报修仍缺少当前可访问的实际应用入口及业务请求契约，因此本次没有创建报修单，也没有实现猜测的请求。取得当前南京大学 APP 的实际宿舍报修链接后可继续探查。

随后通过当前官方 PC 前端确认的 `/jsonp/ywtb/service/getServices`、旧版 `/jsonp/serviceCenterApp.json` 与 `/jsonp/serviceCenterData.json` 再次核对服务及分类应用，结果仍只有后勤反馈、宿舍申办和电话指引等相关入口。“其他后勤服务” appId `7186848311648985` 实际打开 `/ywtb-portal/qthqfw.png` 静态服务指引图，没有维修业务接口。新增目录证据：[当前目录](assets/2026-10-22-hospital-dorm-atomic/repair-current-catalog.json)、[旧版目录](assets/2026-10-22-hospital-dorm-atomic/repair-legacy-catalog.json)。

## 网络说明

执行初期校园代理的 `/health` 实际返回 `active=63/maxConnections=64`，多站点经代理立即返回空正文 HTTP 503。独立执行容器直连医院可返回 HTTP 200；本报告的成功请求均在本次命令中清空 `NJUCLI_PROXY_URL` 后执行，没有修改生产代理或其他用户配置。
