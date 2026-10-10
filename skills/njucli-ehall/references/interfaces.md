# EHall 接口

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

## 研究生教务

应用由 [EHall 服务目录](https://ehall.nju.edu.cn/) 进入。请求前访问对应 `appShow?appId=...` 和应用首页，以下根路径均位于 `https://ehallapp.nju.edu.cn/gsapp/sys/`。

| 能力 | appId | 根路径 |
| --- | --- | --- |
| 成绩 | `5094115980385668` | `wdcjapp/` |
| 考试 | `5051542166524964` | `wdksapp/` |
| 课表 | `4979568947762216` | `wdkbapp/` |
| 培养方案 | `5006012186614764` | `wdpyfaapp/` |

### 成绩与考试

| 方法 | 相对应用根路径 | 用途 |
| --- | --- | --- |
| POST | `modules/wdcj/xscjcx.do` | 成绩 |
| GET | `modules/ksxxck/getXnxqList.do` | 考试学期 |
| POST | `modules/ksxxck/wdksxxcx.do` | 考试安排 |
| POST | `modules/ksxxck/wdkckcxxcx.do` | 考查安排 |

成绩映射 `XNXQDM_DISPLAY/KCDM/KCMC/KCLBMC/XF/CJXSZ/SFJG`。考试按学期、当前学号和 `SFFBKSAP=1` 查询；考试与考查分别使用 `KSAPWID` 非空和为空条件。

### 课表与培养方案

| 方法 | 相对应用根路径 | 用途 |
| --- | --- | --- |
| POST | `modules/xskcb/kfdxnxqcx.do` | 可查课表学期 |
| GET | `wdkcb/initXsxx.do?XH=` | 当前学号，供考试与培养方案查询 |
| POST | `modules/xskcb/xspkjgcx.do` | 课表，参数 `XNXQDM/XH` |
| POST | `modules/pyfaxq/gjxhcxdyfadm.do` | 由学号取得 `FADM` |
| POST | `modules/pyfaxq/facx.do` | 方案详情 |
| POST | `modules/pyfaxq/wdFacxPyfakclbxfyqcx.do` | 分类学分要求 |
| POST | `modules/pyfaxq/pyfakcxxcx.do` | 方案课程 |

课表使用 `KCDM/KCMC/BJMC/JSXM/XQ/KSJCDM/PKSJDD/JASMC/XQDM_DISPLAY`，保留学校返回的节次和地点。培养方案学分要求取响应首项的 `falxdykclbxfyqResults`，字段为 `KCLBDM_DISPLAY/ZDXF/ZGXF`；其余列表取 `datas.<action>.rows`。

验证范围：已核对官方页面和登录后的查询接口；完整 CLI 实网结果待核对。

## 本科个人课表

入口为 `https://ehall.nju.edu.cn/appShow?appId=4770397878132218`，随后访问课表 index 和 `changeAppRole/wdkb/20230211151103310.do`。以下路径相对 `https://ehallapp.nju.edu.cn/jwapp/sys/wdkb/modules/`。

| 查询 | 请求 | 响应数据键 |
| --- | --- | --- |
| 学期列表 | `POST jshkcb/xnxqcx.do` | `datas.xnxqcx.rows` |
| 当前学期 | `POST jshkcb/dqxnxq.do` | `datas.dqxnxq.rows` |
| 学期开始日期 | `GET jshkcb/cxjcs.do` | `datas.cxjcs.rows` |
| 结构化课表 | `POST xskcb/cxxszhxqkb.do` | `datas.cxxszhxqkb.rows` |

响应 `code=0` 表示成功。课表参数为 `XNXQDM`、`pageSize`、`pageNumber`；学期列表按 `*order=-DM` 排序。URL 与响应键集中定义在 `scripts/timetable-contract.ts`。

| 字段 | 含义 |
| --- | --- |
| `DM / MC` | 学期 ID / 名称 |
| `XN / XQ / XQKSRQ` | 学年 / 学期 / 开始日期 |
| `JXBID / KCM / SKJS` | 教学班 ID / 课程名 / 教师 |
| `KSJC / JSJC / SKXQ` | 开始节次 / 结束节次 / 星期 |
| `SKZC` | 教学周位图，`1` 表示该周有课 |
| `JASMC / XXXQDM_DISPLAY` | 地点 / 校区 |

接口与响应键参考 `nju-cli/nju-cli`，当前定义见 [课表请求契约](../scripts/timetable-contract.ts)。节次钟点参考 [nju-schedule-ics](https://github.com/SuperKenVery/nju-schedule-ics)。课表查询与钟点仍待南大实网逐项核对。

## 研究生选课

[官方入口](https://yjsxk.nju.edu.cn/yjsxkapp/sys/xsxkapp/course_nju.html)。以下路径相对 `https://yjsxk.nju.edu.cn/yjsxkapp/sys/xsxkapp/`。

| 动作 | 请求 | 参数或结果 |
| --- | --- | --- |
| 会话 | `GET xsxkHome/loadPublicInfo_course.do` | `loginUserId / csrfToken` |
| 方案内课程 | `POST xsxkCourse/loadFanCourseInfo.do` | `kind=plan` |
| 公选课程 | `POST xsxkCourse/loadGxkCourseInfo.do` | `kind=public` |
| 已选课程 | `GET xsxkCourse/loadStdCourseInfo.do` | 课程数组 |
| 选课 | `POST xsxkCourse/choiceCourse.do` | `bjdm / lx / csrfToken`；plan 为 `lx=2`，public 为 `lx=1` |
| 选课结果 | `POST xsxkCourse/loadXkjgRes.do` | 查询本次事务结果 |
| 退课 | `POST xsxkCourse/cancelCourse.do` | `bjdm / csrfToken`；`code=1` 成功 |

课程筛选使用 `query_*` 字段，`query_sfym=0` 只查未满课程；分页使用 `pageIndex / pageSize`。

| 字段 | 含义 |
| --- | --- |
| `BJDM / BJMC` | 教学班 ID / 名称 |
| `KCDM / KCMC` | 课程代码 / 名称 |
| `RKJS / KCKKDWMC` | 教师 / 院系 |
| `XQMC / SKYYMC` | 校区 / 授课语言 |
| `XF / PKSJDDMS` | 学分 / 时间地点 |
| `DQRS / KXRS / IS_CONFLICT` | 已选人数 / 容量 / 冲突标记 |

接口来自选课站官方前端。已验证方案内、公选课和已选课程查询；真实选课、退课待验证。
