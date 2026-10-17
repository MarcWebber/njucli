# 宿舍接口

[电费入口](https://epay.nju.edu.cn/epay/h5/nju/electric/index)

## 电费认证

站点为 `https://epay.nju.edu.cn`。本 Skill 复用 SSO 会话，GET `/epay/h5/nju/electric/edit` 完成电费站点会话交接，读取 `_csrf_header` 与 `_csrf` meta，后续 POST 携带对应 CSRF 请求头 `X-CSRF-TOKEN`。

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

## 接入范围

- 校区、仙林楼栋与房间目录、充值记录空列表已通过实网查询；非空充值记录和苏州西区房间待实网核对。
- 余额页面 `/epay/h5/nju/electric/charge?id=...` 需要绑定记录 ID，余额读取契约待补充。
- `addRoom.json`、`updateRoom.json`、`delRoom.json` 为地址写入操作，连同充值提交留待后续接入。

## 住宿申请

[宿舍申办](https://ehall.nju.edu.cn/appShow?appId=4618295887225301)用于查询分配结果和住宿费用。应用 ID 为 `4618295887225301`，业务根路径为 `https://ehallapp.nju.edu.cn/xsfw/sys/xszsapp/`。个人查询需要统一认证，开放范围以学校通知及账号权限为准。

## 宿舍报修

[官方上线说明](https://itsc.nju.edu.cn/0c/27/c21558a724007/pagem.htm)列出仙林、鼓楼、浦口的宿舍和公房报修，以及新增、二次维修和评价流程。公开表单截图包含手机号、报修类型、报修区域、详细地点、上门起止时间、问题描述、备注、故障图片。

官方导航为“生活服务 → 宿舍报修”，专用 H5 地址、认证交接及业务响应待补充。EHall 搜索“报修”关联的“意见反馈”与宿舍报修的关系仍待确认。

后续抓包从进入“生活服务 → 宿舍报修”前开始，保留页面、列表与分类加载请求。提示“未分配宿舍”的响应也可用于确认身份检查和业务路径。提供首个 H5 地址或 HAR，保留方法、路径、参数结构和响应字段，脱敏会话及个人字段值即可。
