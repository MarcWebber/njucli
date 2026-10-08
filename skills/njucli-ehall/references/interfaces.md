# 网上办事与行程填报接口

## 网上办事大厅

以下路径相对 `https://ehall.nju.edu.cn`。

| 方法 | 路径 | 契约 |
| --- | --- | --- |
| GET | `/jsonp/ywtb/onlineYwtbApps?searchKeyword=...&labels=` | `result=success`；`data` 为应用数组，取 `appId/appName/hasPermission` |
| POST | `/taskcenterapp/sys/taskCenter/taskNew/getTaskRestful.do` | `flag=1/2/3` 分别为待办、已办、我发起 |
| POST | `/taskcenterapp/sys/taskCenter/taskNew/queryProcessTrack.do` | `state=1/2/3` 分别为进行中、已完成、已撤销 |

服务入口使用 `/appShow?appId=...`，结果中省略含会话参数的内部表单链接。

## 研究生节假日行程登记

[官方入口](https://ehall.nju.edu.cn/appShow?appId=6092355728536569)，业务根路径为 `https://ehallapp.nju.edu.cn/xxfw/sys/yjsjjrlfxappnju/`。以下接口均为 POST，采用表单编码。

### 查询

页面 `pageMeta.params.userId` 提供当前身份；应用初始化后设置当前角色。所有个人记录按该身份核对。

| 路径 | 参数与结果 |
| --- | --- |
| `modules/apply/getStuIndexPage.do` | `data={}`；`PAGE=WDJ/YDJ/WXDJ` 对应待填报、已登记、无需登记；`SZOBJ` 为假期，`SQOBJ.WID` 为当前记录 |
| `modules/register.do` | `*json=1`，取得表单模型和字典 URL |
| `modules/register/cxxsjbxxdz.do` | 按 `XSBH` 读取本人基本信息 |
| `modules/register/xsdjlsjlbg.do` | `pageNumber/pageSize` 分页，按 `DJRQ` 取最近登记 |
| `modules/apply/getCurStuApply.do` | `data={WID}`，返回登记详情 |
| `modules/register/cxxsdjjjrbddz.do` | 按本人、假期、学年读取主记录 `WID/DJBH`、日期和交通信息 |

`data` 参数使用 JSON 字符串。假期字段为 `JJRDM/JJRMC/XN/JJRKSRQ/JJRJSRQ/DJJSRQ`；交通方式和目的地字典分别取表单 `xsdjqxmxbd` 控件的 `BY1/BY3`，字典地址位于本站 `/xxfw/code/`。目的地接受城市及下级地区名称或代码，须唯一匹配。

### 提交

| 输入 | 远端字段 |
| --- | --- |
| 全程留校 `stayOnCampus` | `YL2` |
| `phone/emergencyContact/emergencyPhone` | `YL3/JJLXR/JJLXRDH` |
| 目前住校 `onCampus`、居住地址 `residence` | `YL5/YL6` |
| 假期和学年 | `JJRDM/DJXN` |
| 离校日期、返校日期、返校交通 | `YL1/YJFXRQ/YL4` |
| 每站日期、目的地、地址、交通、班次 | `KSRQ/JSRQ/BY3/XXDZ/BY1/BY2` |

每次离返校由 `commoncall/callQuery/zdscwid-MINE-QUERY.do` 生成 `DJBH`。明细保存至 `commoncall/call/T_JJR_DJ_MX-DATAMODEL-ADD.do`，参数为 `requestParams=JSON.stringify(明细)`、`actionType=DATAMODEL`、`actionName=T_JJR_DJ_MX`、`dataModelAction=ADD`；成功码为 `resultCode=00000`。按 `DJBH` 从 `commoncall/callQuery/xsdjqxmxbd-MINE-QUERY.do` 回读后，总登记提交至 `modules/holiday/SaveRegister.do`，参数为 `data=JSON.stringify({data: parents})`。

总登记 `code=0` 后核对已登记状态、本人、当前假期及对应主记录和明细。明细保存立即生效；中途失败返回 `stage/registrationIds` 供核查，提交不自动重放。

### 联系资料

当前账号的 `ehall.json` 保存 `{userId, contacts}`，权限 0600；仅在身份一致时复用。当前官方资料优先，其次缓存，缺失时读取最近本人登记。该文件只保存联系方式和住宿资料；本次行程由输入提供。`--dry-run` 校验并返回计划，保留原有联系人默认值。

### 验证范围

公开目录、登录后查询和预览已验证；2026-10-03 通过 CLI 完成单次离返校、单站行程正式提交及逐项回读。留校、多次离返校、多站行程和失败不重试由本地集成覆盖，对应实网提交待验收。
