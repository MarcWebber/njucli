# 宿舍接口

[电费入口](https://epay.nju.edu.cn/epay/h5/nju/electric/index)

## 电费认证

站点为 `https://epay.nju.edu.cn`。本 Skill 复用 SSO 会话，GET `/epay/h5/nju/electric/edit` 完成电费站点会话交接，读取 `_csrf_header` 与 `_csrf` meta，后续 POST 携带对应 CSRF 请求头 `X-CSRF-TOKEN`。

会话检查与业务复用同一次 `BrowserSession`，CSRF 仅存在当次 client 内存。接口与输出不包含服务端配置、会话令牌或内部电控地址。

## 电费查询请求

以下路径相对 `/epay/h5/`，均为只读 POST。成功条件为 `retcode` 数字 `0` 或字符串 `"0"`，失败信息为 `retmsg`，目录和记录取 `list`。

| 请求 | 编码与参数 | 使用的返回字段 |
| --- | --- | --- |
| `getelesys.json` | JSON `{}` | `elcsysid` 数字、`elcname` 字符串；按官方页面筛选电控系统，名称中的“电控”显示为“校区” |
| `getbuild.json` | form：`sysid`、`areaid=0`、`districtid=0` | `buiId`、`buiName` 字符串 |
| `getroom.json` | form：`sysid`、`areaid=0`、`districtid=0`、`buildid`、`floorid=0` | `roomId`、`roomName` 字符串 |
| `getElecOrWaterDtl.json` | form：`startdate=YYYYMMDD`、`enddata=YYYYMMDD`、`name=电控` | `elcname/build_name/elecroomno/paytime` 为字符串，`amount` 为数字，`issend` 为数字或字符串；非空记录字段依据官方页面，实网映射待核对 |

结束日期字段的实际拼写是 `enddata`。充值状态由官方页面映射：`issend=0` 处理中、`issend=1` 交易成功，其余值保留状态码。该状态表示充值处理状态，不能用来推断当前剩余电量。

官方编辑页对 `buildid` 以 `west` 开头的楼栋使用 `sysid=9` 查询房间；这些楼栋从苏州电控系统进入。该分支已按页面实现，苏州西区的实际响应待核对。

## 电费绑定管理

GET `/epay/h5/nju/electric/index` 的内联 `initList` 将当前账号绑定记录赋给 `let list`。以 JSON 解析该数组，读取 `id/type/sysId/sysName/buildId/buildName/roomId/roomName`；页面脚本不执行。`id` 为绑定记录 ID，`roomId` 为电控房间 ID，两者用途不同。

以下写请求相对 `/epay/h5/`，均为携带 CSRF 的 form POST；成功条件同查询请求。

| 请求 | 参数 | 回读条件 |
| --- | --- | --- |
| `addRoom.json` | `type=elec`、`areaId=0`、`areaName=0`、`districtId/districtName` 为空，`sysId/sysName`、`buildId/buildName`、`roomId/roomName` | 绑定列表出现本次新增的记录 ID，校区、楼栋及房间 ID 与目标一致 |
| `updateRoom.json` | 同新增，增加已有绑定的 `id` | 该绑定 ID 的校区、楼栋及房间 ID 与目标一致 |
| `delRoom.json` | `id`、`type=elec` | 绑定列表已无该 ID |

参数和回读页面来自[编辑页](https://epay.nju.edu.cn/epay/h5/nju/electric/edit)与电费首页。提交前从官方目录解析名称，校验校区、楼栋和房间的从属关系；`sysName` 与官方前端一致使用校区显示名。苏州西区楼栋提交 `sysId=9`。修改与解绑限定当前账号绑定列表中的 ID。一次调用内完成会话交接、提交和回读，写操作不自动重试。

## 住宿查询

[宿舍申办](https://ehall.nju.edu.cn/appShow?appId=4618295887225301)的业务根路径为 `https://ehallapp.nju.edu.cn/xsfw/sys/xszsapp/`。复用 SSO 后 GET 应用入口，回跳 `*default/index.do` 建立业务会话；后续请求使用同一会话。

以下路径相对业务根路径，均为只读 form POST，表单 `data` 的值为 JSON 字符串 `{}`。响应 `code="0"` 表示成功，消息取 `msg`，记录取 `data` 数组。账号由服务端会话确定。

| 请求 | 使用的字段 | 命令 |
| --- | --- | --- |
| `modules/studentApplyDorm/getStudentAddress.do` | `ZSDZ` 住宿地址 | `dorm housing` |
| `modules/studentApplyDorm/getDormApplyInfo.do` | `WID`、`SQLB/SQLB_DISPLAY`、`SQRQ`、`SHZT/SHZT_DISPLAY` | `dorm applications` |

契约见官方前端 [xsDormApply.js](https://ehallapp.nju.edu.cn/xsfw/sys/xszsapp/modules/xsDormApply/xsDormApply.js)、[myDormApplyBs.js](https://ehallapp.nju.edu.cn/xsfw/sys/xszsapp/modules/myDormApply/myDormApplyBs.js) 和[申请列表模板](https://ehallapp.nju.edu.cn/xsfw/sys/xszsapp/modules/myDormApply/myDormApplyIndexPage.html)。类别与状态使用服务端显示字段，同时保留原始码。

## 验证范围

- 校区、仙林楼栋与房间目录、充值记录空列表已有实网响应依据。
- 电费绑定列表、本人住宿地址与住宿申请列表已取得当前账号的空列表响应。
- 非空绑定、住宿地址与住宿申请字段依据官方前端；写入、写后回读、非空充值记录及苏州西区房间待实网核对。
- 余额页面 `/epay/h5/nju/electric/charge?id=...` 需要绑定记录 ID，余额读取与充值提交契约待补充。

## 宿舍报修

[官方上线说明](https://itsc.nju.edu.cn/0c/27/c21558a724007/pagem.htm)列出仙林、鼓楼、浦口的宿舍和公房报修，以及新增、二次维修和评价流程。公开表单截图包含手机号、报修类型、报修区域、详细地点、上门起止时间、问题描述、备注、故障图片。

官方导航为“生活服务 → 宿舍报修”，专用 H5 地址、认证交接及业务响应待补充。EHall 搜索“报修”关联的“意见反馈”与宿舍报修的关系仍待确认。

后续抓包从进入“生活服务 → 宿舍报修”前开始，保留页面、列表与分类加载请求。提示“未分配宿舍”的响应也可用于确认身份检查和业务路径。提供首个 H5 地址或 HAR，保留方法、路径、参数结构和响应字段，脱敏会话及个人字段值即可。
