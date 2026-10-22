# 研修间接口

[官方系统](https://ytj.nju.edu.cn/)当前要求校园 VPN。业务复用当前统一认证和官方 WebVPN 会话，从本站 localStorage 取得 `accessToken/userId`，核对 `userData.sysNumber` 与当前认证账号相同。请求携带本站 `Authorization`。

路径均相对 `/api/studyroom/`。

| 动作 | 路径 | 请求 |
| --- | --- | --- |
| 开放日期 | `v1/room/reservationDate` | GET |
| 房间 | `v1/room/mRooms` | GET `roomType/date` |
| 房间时段 | `v1/room/reservation` | GET `roomId/date`；时段状态 `0` 可用 |
| 预约用途 | `v1/dict/type` | GET `type=RESERVATION_USE` |
| 本人预约 | `v1/reservation/pageByUserId` | POST JSON `userId/page/size` |
| 预约条件校验 | `v1/room/verifyRoomPloy` | GET `userId/roomId` |
| 同行人校验 | `v1/reservation/reservationUserJudge` | GET `userId/memberIds/startTime` |
| 创建 | `v1.1/reservation/reservation` | POST 查询参数 `userId/memberIds/roomId/startTime/endTime/dictId/behaviorMode=4/mobile/remark/filePath`；成功为文本响应 |
| 取消 | `v1/reservation/cancelReservation` | POST 查询参数 `reservationId/cancelType=1` |

时间字符串为 `YYYY-MM-DD HH:mm:ss`。创建后以本人列表中新 ID、房间和开始/结束时刻回读；取消后确认记录消失或 `reservationStatus=61`。房间时段输出不包含其他预约人的个人资料。

正式 CLI 已创建并从本人列表回读；stdio MCP 已取消，最后回读状态 `61`，本次活动验证预约数为 0。结果见[验证报告](../../../docs/reports/2026-10-22-library-atomic.md)。
