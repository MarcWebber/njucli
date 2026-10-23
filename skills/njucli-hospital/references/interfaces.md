# 校医院接口

官方业务入口为 [校医院自助服务](https://ndyy.nju.edu.cn/zzfw/)。[体检报告通知](https://hospital.nju.edu.cn/xwgg/ggtz/20260904/i415602.html)和[大学生医保办理说明](https://hospital.nju.edu.cn/xwgg/ggtz/20260824/i414194.html)确认学校统一认证及个人业务入口。

## 会话与请求

本 Skill 使用公共 SSO 会话，GET `/zzfw/asLogin.aspx` 建立医院本站 Cookie，以 `/zzfw/Pages/Default.Aspx` 的实际最终页面确认本站身份。业务 Cookie、SSO 和文件下载使用同次 `BrowserSession`。本站已有会话可以直接探测复用。

以下路径相对 `/zzfw/Ashx/`。官方 `Assets/layui-module/HA/HACode.js` 使用表单 POST `{params: 字符串}`；业务成功条件为 `code=0`，错误内容为 `msg`。`data` 可能是 JSON 字符串或已解析数组，本实现只按 JSON 读取，不执行远端 JavaScript。分页表格使用 GET 查询参数 `params/page/limit`。

| Handler / action | params | 返回字段 |
| --- | --- | --- |
| `API_Appointment/selectTaskData` | 类别 ID | 任务 ID/名称、预约 ID、校区、日期、时段、状态、执行时间、费用说明 |
| `API_Appointment/selectTaskXq` | 项目 ID | `校区` |
| `API_Appointment/selectTaskRq` | `项目ID^校区` | `日期/可预约人数/备注` |
| `API_Appointment/selectTaskSjd` | `项目ID^校区^日期` | `时间段/可预约人数` |
| `API_Appointment/insertUserYy` | `项目ID^校区^日期^时段^12` | 创建后从该类别项目列表回读本人预约 |
| `API_Appointment/deleteUserYy` | 本人预约 ID | 取消后从该类别项目列表回读 |
| `API_Report/MyHealthReportList` | 空；分页 GET | `ID/体检名称/体检日期/总检时间/生成状态`；`count` 为总数 |
| `API_Report/HepatitisBReportList` | 空；分页 GET | `ID/年度/批次/HBSAG/HBSAB/医生建议` |
| `API_SIStudent/selectMyInfo` | 空 | 本人身份、联系方式和医保证件资料 |
| `API_SIStudent/selectZD` | `户口性质` | `值名称` |
| `API_Common/selectZD` | `^证件类型^^^1^^^` | 证件目录的 `值` |
| `API_SIStudent/selectMySI` | `0`；分页 GET | 本人参保记录及缴费、生效、办理状态 |
| `API_SIStudent/CheckSITime` | 空 | `年度/开放时间/截止时间/开放说明` |

预约类别从 `/zzfw/ashx/PageInit.ashx` 的菜单 URL `MKID` 动态读取。预约界面的请求定义来自 `Pages/SelfHelp/AppointmentTask.Aspx`、`Appointment.aspx`；医保查询字段来自 `Pages/SI/MyInfo.aspx`、`MySI.aspx`。

## PDF 下载

下载动作先从本人报告列表确认 ID 与生成状态，再从 `Pages/SelfHelp/HealthReport.aspx` 读取当前用户的 `UID`，请求 `API_ReportFileOtherDown.ashx?USID=UID&ID=报告ID`。UID 只用于同次下载请求，不出现在结果或日志。响应必须以 `%PDF-` 开头，使用公共 `saveFile` 保存。

## 真实验证范围

- 正式 CLI 已读取 5 个预约类别、4 个疫苗项目、校区、可预约日期及 6 个时段。
- 已通过正式 CLI 创建一次用户授权的临时预约，回读确认后取消，再次回读恢复原有的无预约状态。
- 本人报告列表返回 2 份已生成报告；已下载 11,851 字节的原 PDF。乙肝查询返回真实空列表。
- 医保资料、户籍性质/证件目录、本人空参保记录及当前开放信息已通过真实 CLI；MCP 另行完成类别、项目、报告和医保目录的真实读取。
- 医保范围为资料、参保与缴费状态查询，不提供本轮未完成真实验证的医保资料修改、参保新增或删除入口。

