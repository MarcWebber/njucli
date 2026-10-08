# 体育场馆接口

## 体育场馆

[体育场馆系统](https://ggtypt.nju.edu.cn/venue/)的 EHall 应用 ID 为 `6600339867991076`，API 基址为 `https://ggtypt.nju.edu.cn/venue-server`。

请求头包含 `app-key/timestamp/sign/cgAuthorization`。签名按 path、排序后的非空参数、毫秒时间戳和公开客户端常量计算 MD5；规则及字段参考 [nju-cli 场馆实现](https://github.com/nju-cli/nju-cli/blob/df8716a4ee202ed8f7967b3732c8b2e53c961063/crates/cli/src/venue.rs)。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/reservation/campus/venue/info` | 校区与场馆 |
| GET | `/api/front/website/venue_sites/{venueSiteId}` | 场地详情 |
| GET | `/api/reservation/day/info?venueSiteId=...&searchDate=...&hasReserveInfo=1` | 指定日期的时段和场地余量 |
| GET | `/api/orders/mine?page=...&size=...` | 我的预约 |
| GET | `/api/orders/{orderId}` | 预约详情 |

余量按具体 space 的 `available` 状态统计；预约中的 `reservationDateDetail` 映射为 `reservationDetail`。

官方前端路由提供两个操作入口：`reserve-link` 返回 `/venue/venue-reservation/{venueSiteId}`，日期在页面选择；`cancel-link` 返回 `/venue/orders` 并附目标订单 ID。

验证范围：已有登录后接口探测和官方路由核对，CLI 链接输出已验证；CLI 的登录角色、实时余量与订单查询待完整实网验收。
