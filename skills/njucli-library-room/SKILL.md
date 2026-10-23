---
name: njucli-library-room
description: 查询南京大学图书馆研修间、可预约日期和时段，创建本人指定的预约，查询及取消本人预约。
---

# 图书馆研修间

使用当前账号连接[研修间系统](https://ytj.nju.edu.cn/)。校外访问使用已登录的南大 VPN；本站统一认证沿用当前账号会话。

| 命令 | 原子动作 |
| --- | --- |
| `njucli library-room dates` | 查询可预约日期 |
| `njucli library-room rooms DATE` | 查询房间、容量、开放时间与最短/最长预约时长 |
| `njucli library-room slots ROOM_ID DATE` | 查询房间各时段状态，状态 `0` 为可用 |
| `njucli library-room purposes` | 查询预约用途编号 |
| `njucli library-room bookings --page 1 --size 10` | 查询本人预约 |
| `njucli library-room book --input booking.json` | 创建指定预约并回读 |
| `njucli library-room cancel ID` | 取消本人预约并回读 |

所有命令支持 `--format json`，MCP 提供对应 `library_room_` 工具，调用同一业务方法。

`booking.json` 使用接口返回的房间和用途编号、可用日期与时段，以及本人的真实手机号。`members` 仅填写本人以外的实际同行人编号；单人房间使用空数组。日期为 `YYYY-MM-DD`，开始和结束时间为 `HH:mm`。

`mobile` 优先由 AI 使用宿主已注入的 `profile.phone` 填写；NJUWeb/Runner 按账号维护该资料，已有值时直接使用，缺失时才询问用户。

```json
{
  "roomId": 1,
  "date": "2026-10-23",
  "startTime": "08:00",
  "endTime": "08:30",
  "purposeId": 1,
  "mobile": "本人手机号",
  "description": "自习",
  "members": []
}
```

创建结果不明确时，先查询本人预约确认，避免重复提交。取消只能针对本人预约列表中的编号。

请求契约和真实创建、取消范围见[接口说明](references/interfaces.md)。
