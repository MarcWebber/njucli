# 访客预约接口探索

核对日期：2026-10-16。已读取官方公开前端和用户提供入口的匿名应用元数据；未提交访客申请、实名核验或通知请求。本文为接入依据，当前 CLI 尚未提供访客提交命令。

## 功能归属

访客预约与校友身份服务归 `njucli-campus`，通过组内子命令扩展。

## 入口与公开资源

官方办理说明：[校外访客进出校](https://itsc.nju.edu.cn/36/a0/c21500a472736/page.htm)。该说明发表于 2020 年，旧健康材料要求不直接用于当前表单；字段以当前页面为准。

入口属于 `https://app.nju.edu.cn` 的移动建模应用，`appid=1501`，初始页面 `page_3502`，元数据返回应用名“访客预约”。入口中的 `mToken` 用于匿名访问，由官方页面提供。

| GET 路径 | 已确认用途 |
| --- | --- |
| `/mobilemode/mobile/dist/js/loader.js` | 初始化脚本，给出元数据接口和静态资源路径 |
| `/mobilemode/mobile/server.jsp` | 参数 `invoker=base64(com.api.mobilemode.web.mobile.service.MobileEntranceAction)`、`action=meta`、`appid=1501`、`appHomepageId`、`mTokenFrom`、`mToken`、`_ec_ismobile=true`、`timeZoneOffset=-480`；返回 `status=1` 与 `data.appid/appname/resourceVersion/sessionKey` |
| `/mobilemode/mobile/page/app1501/js/frame/index.js` | 页面、组件和主页定义 |
| `/mobilemode/mobile/page/app1501/js/page/page3502.js` | 普通访客预约字段、选择项及事件代码 |
| `/mobilemode/mobile/page/app1501/js/page/page44501.js` | 鼓楼南园车辆预约页面；已从普通预约页确认链接，字段待核对 |
| `/mobilemode/mobile/page/app1501/js/page/page50003.js` | 车辆收费规则页面 |
| `/mobilemode/mobile/page/app1501/js/page/page49501.js` | 鼓楼南园实时剩余车位页面 |

元数据请求已成功；个人记录和业务接口的访问权限待核对。

## 当前表单

表单组件 `fc092a9428aa4a87867553b1fbfcf132`，`modeid=2004`、`formid=-17`。以下字段来自 `page3502.js`；动态显示、结束日期选项和附加校验由页面事件决定。

| 内容 | 字段 |
| --- | --- |
| 审核人单位、姓名及内部标识 | `SHRDW / SHRXSM / SHRXM` |
| 访客姓名、证件类型、证件号码 | `FKXM / ZJLX / ZJHM` |
| 访客电话、单位 | `FKDH / FKDW` |
| 到访校区 | `DFDD1`，允许多选：`0` 仙林、`1` 鼓楼、`2` 浦口、`3` 苏州 |
| 访问开始、结束日期 | `FWKSSJ / FWJSSJ` |
| 随行车牌 | `ZRCPH` |
| 校内联系人、到访事宜 | `XNLXR / DFSY` |
| 是否学生家长、学生学号、姓名、院系 | `SFXSJC / XSXH / XSXM / XSYX` |
| 健康信息、附件与承诺 | `SFFR / SFYX / FJ / CNXX` |
| 微信身份 | `OPENID`，来自微信运行环境 |

`ZJLX` 选项：`0` 中国居民身份证、`1` 护照、`2` 港澳居民来往内地通行证、`3` 台湾居民来往大陆通行证、`4` 港澳台居民居住证、`5` 外国人永久居留身份证。

页面对证件类型 `0/4/5` 调用实名核验；非身份证类型有上传证件照的提示。车牌填写后显示驾驶须知，需要阅读并勾选确认。普通页面说明随行车辆适用仙林和苏州，鼓楼车辆另走南园车辆预约。实际条件应随当前页面核对，不把静态 `required` 属性直接作为完整提交规则。

## 前端调用链

下表仅为静态代码证据，业务成功响应尚未核对。

| 调用 | 参数或作用 |
| --- | --- |
| `POST /interface/fkxt/IdentityVerify.jsp` | `identity/name`；前端接受 `code="0"` 或 `result="success"`，核验失败时阻止提交 |
| `Mobile_NS.SQL` | 页面预置查询标识及参数，用于按姓名和单位解析审核人、检查同日期重复申请；不开放任意查询 |
| `Mobile_NS.formSubmit` | 保存指定表单组件，回调返回正数办件 ID；底层请求编码与回读契约仍待确认 |
| `POST /interface/fkxt/Kkmessage.jsp` | 保存成功后传 `billid/type/sfjsdx/shrxm/shrgh/shrxsm/shrbm` 触发通知 |
| `POST /interface/fkxt/MonitorMessage.jsp` | 保存成功后传 `fkxm/zjhm/fwkssj/fwjssj/dfxq/shrxm/shrdw` |
| 页面 `3514` | 保存后携带 `billid` 跳转确认页 |
| 页面 `5001` | 当前预约入口；按本人微信身份查询的约束仍待确认 |
| `GET /interface/carWhiteList/querySycws.jsp` | 车位页读取 `data` 显示余位；本轮无会话和匿名元数据会话均返回登录跳转脚本，尚未取得车位数 |

预约保存与通知属于多个请求，后续接入需要确认办件回读及通知失败后的处理方式。

## 南大人校友卡

[南京大学公共管理学院校友服务目录](https://publicxyw.nju.edu.cn/xyfw/list.htm)列有电子校友卡申领、海外校友申领和 2025 年使用指南；[校友总会说明](https://alumni.nju.edu.cn/f2/63/c21693a520803/page.htm)确认“南大人”为校友云服务平台，包含实名认证与校友身份认证。

小程序短链接需要微信解析，具体申领页面、登录交换及申请状态接口待取得。校友身份与电子校友卡归 `campus`，校园消费卡归 `pay`。
