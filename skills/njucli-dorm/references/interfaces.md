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

结束日期字段的实际拼写是 `enddata`。充值状态由官方页面映射：`issend=0` 处理中、`issend=1` 交易成功，其余值保留状态码。该状态表示充值处理状态。

官方编辑页对 `buildid` 以 `west` 开头的楼栋使用 `sysid=9` 查询房间；这些楼栋从苏州电控系统进入。已通过真实请求确认苏州西区房间目录及绑定回读的 `sysId=9`。

## 电费绑定管理

GET `/epay/h5/nju/electric/index` 的内联 `initList` 将当前账号绑定记录赋给 `let list`。以 JSON 解析该数组，读取 `id/type/sysId/sysName/buildId/buildName/roomId/roomName`；页面脚本不执行。`id` 为绑定记录 ID，`roomId` 为电控房间 ID，两者用途不同。

以下写请求相对 `/epay/h5/`，均为携带 CSRF 的 form POST；成功条件同查询请求。

| 请求 | 参数 | 回读条件 |
| --- | --- | --- |
| `addRoom.json` | `type=elec`、`areaId=0`、`areaName=0`、`districtId/districtName` 为空，`sysId/sysName`、`buildId/buildName`、`roomId/roomName` | 绑定列表出现本次新增的记录 ID，校区、楼栋及房间 ID 与目标一致 |
| `updateRoom.json` | 同新增，增加已有绑定的 `id` | 该绑定 ID 的校区、楼栋及房间 ID 与目标一致 |
| `delRoom.json` | `id`、`type=elec` | 绑定列表已无该 ID |

参数和回读页面来自[编辑页](https://epay.nju.edu.cn/epay/h5/nju/electric/edit)与电费首页。提交前从官方目录解析名称，校验校区、楼栋和房间的从属关系；`sysName` 按页面显示名提交，已实际验证仙林新增、修改为苏州西区及解绑后的回读。苏州西区楼栋提交 `sysId=9`。修改与解绑限定当前账号绑定列表中的 ID。一次调用内完成会话交接、提交和回读，写操作不自动重试。

## 验证范围

- 实际查询校区、仙林及苏州楼栋、仙林与苏州西区房间目录。
- 通过统一 CLI 新增仙林房间绑定、将同一绑定修改为苏州西区房间，再解除绑定。每步均完成回读，最后恢复调用前的空列表。
- 充值记录已验证当前账号的空列表响应，非空记录映射待核对。
