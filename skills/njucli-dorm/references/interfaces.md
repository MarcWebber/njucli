# 宿舍接口记录

核对日期：2026-10-16。来源为用户提供的 [epay 电费页面](https://epay.nju.edu.cn/epay/h5/nju/electric/index)、该页面的前端请求与当次授权的只读响应。

## 电费认证

站点为 `https://epay.nju.edu.cn`，认证能力 `epay` 依赖 `sso`。GET `/epay/h5/nju/electric/edit` 经统一认证回到本站“编辑地址”页面，读取 `_csrf_header` 与 `_csrf` meta，后续 POST 携带对应 CSRF 请求头。本轮头名为 `X-CSRF-TOKEN`。

会话检查与业务复用同一次 `BrowserSession`，CSRF 仅存在当次 client 内存。接口与输出不包含服务端配置、会话令牌或内部电控地址。

## 已接入请求

以下路径相对 `/epay/h5/`，均为只读 POST。成功条件为 `retcode` 数字 `0` 或字符串 `"0"`，失败信息为 `retmsg`，目录和记录取 `list`。

| 请求 | 编码与参数 | 使用的返回字段 |
| --- | --- | --- |
| `getelesys.json` | JSON `{}` | `elcsysid` 数字、`elcname` 字符串；按官方页面筛选电控系统，名称中的“电控”显示为“校区” |
| `getbuild.json` | form：`sysid`、`areaid=0`、`districtid=0` | `buiId`、`buiName` 字符串 |
| `getroom.json` | form：`sysid`、`areaid=0`、`districtid=0`、`buildid`、`floorid=0` | `roomId`、`roomName` 字符串 |
| `getElecOrWaterDtl.json` | form：`startdate=YYYYMMDD`、`enddata=YYYYMMDD`、`name=电控` | `elcname/build_name/elecroomno/paytime` 为字符串，`amount` 为数字，`issend` 为数字或字符串；非空记录字段依据官方页面，实网映射待核对 |

结束日期字段的实际拼写是 `enddata`。充值状态由官方页面映射：`issend=0` 处理中、`issend=1` 交易成功，其余值保留状态码。该状态表示充值处理状态，不能用来推断当前剩余电量。

官方编辑页对 `buildid` 以 `west` 开头的楼栋使用 `sysid=9` 查询房间；这些楼栋从苏州电控系统进入。该分支已按页面实现，苏州西区的实际响应待核对。

## 实网范围

- 已取得 4 个电控校区（鼓楼、仙林、苏州、浦口）；同一上游还列出 3 个水表系统，当前命令仅返回电控校区。
- 仙林返回 36 栋楼，首栋返回 537 个房间，房间 ID 与显示名称分别解析。
- 统一 CLI 的 `dorm campuses` 已取得上述校区；`dorm bills` 查询 2026-08-01 至 2026-10-16，成功返回空列表。非空充值记录和苏州西区房间待实网核对。
- 授权会话的宿舍绑定列表为空。余额页面 `/epay/h5/nju/electric/charge?id=...` 需要绑定记录 ID，余额读取契约待补充。
- 本轮只读。官方页面中的 `addRoom.json`、`updateRoom.json`、`delRoom.json` 地址写入操作及充值提交留待后续接入。

## 宿舍报修

[官方上线说明](https://itsc.nju.edu.cn/0c/27/c21558a724007/pagem.htm)列出仙林、鼓楼、浦口的宿舍和公房报修，以及新增、二次维修和评价流程。公开表单截图包含手机号、报修类型、报修区域、详细地点、上门起止时间、问题描述、备注、故障图片。

截至 2026-10-17，已确认官方导航为“生活服务 → 宿舍报修”，专用 H5 地址、认证交接及业务响应待补充。已检查的入口如下：

| 来源 | 结果 |
| --- | --- |
| EHall 公开搜索及登录后的 `/jsonp/ywtb/service/getServices` 目录 | 可见 144 项服务；搜索“报修”命中“故障报修”关联的“意见反馈”，与宿舍报修的关联待确认 |
| [官方 APP 下载说明](https://itsc.nju.edu.cn/21607/listm.htm)及其安装包 | 下载页为 `https://static.campushoy.com/apps/landingPage/prod/index.html#/nju`；加固包的可读资源未提供报修地址 |
| 已登录的 `https://app.nju.edu.cn/wui/index.html` 及 `/api/portal/menu/getFrontEndMenu?withPortal=1&isLoadAll=1` | 已取得门户导航；移动 APP 的服务目录和报修入口仍待定位 |

后续抓包从进入“生活服务 → 宿舍报修”前开始，保留页面、列表与分类加载请求。提示“未分配宿舍”的响应也可用于确认身份检查和业务路径。提供首个 H5 地址或 HAR，保留方法、路径、参数结构和响应字段，脱敏会话及个人字段值即可。
