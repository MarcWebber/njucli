---
name: njucli-dorm
description: 管理南京大学宿舍电费房间绑定，查询电费充值记录。涉及宿舍电费绑定或充值记录时使用。
---

# 宿舍服务

管理电费房间绑定，查询电费充值记录。

在本 Skill 目录运行以下命令，统一 CLI 将 `node scripts/run.mjs` 换成 `njucli`。命令复用当前账号的统一认证会话，由本 Skill 完成业务站点的会话交接。

## 电费房间绑定

```bash
node scripts/run.mjs dorm bindings --format json
node scripts/run.mjs dorm campuses --format json
node scripts/run.mjs dorm buildings CAMPUS_ID --format json
node scripts/run.mjs dorm rooms CAMPUS_ID BUILDING_ID --format json
node scripts/run.mjs dorm bind CAMPUS_ID BUILDING_ID ROOM_ID --format json
node scripts/run.mjs dorm bind CAMPUS_ID BUILDING_ID ROOM_ID --replace BINDING_ID --format json
node scripts/run.mjs dorm unbind BINDING_ID --format json
```

`bindings` 返回当前账号在[电费系统](https://epay.nju.edu.cn/epay/h5/nju/electric/index)保存的房间及绑定 ID。电费绑定用于选择缴费目标。

新增绑定时，依次从 `campuses`、`buildings`、`rooms` 取得校区、楼栋与房间 ID。房间 ID 可能与显示名称不同，使用目录返回值。`bind --replace` 修改已有绑定，`unbind` 解除绑定；两者的绑定 ID 均来自 `bindings`。

执行绑定、修改或解绑前，确认用户指定的目标。命令提交后回读绑定列表；回读确认目标房间或记录已删除后报告成功。若提交后发生异常，先用 `bindings` 核对当前状态。

## 电费充值记录

```bash
node scripts/run.mjs dorm bills --format json
node scripts/run.mjs dorm bills --from 2026-08-01 --to 2026-10-16 --format json
```

`bills` 查询当前账号的电费充值记录，默认从本月往前两个自然月的第一天到今天。返回日期范围及记录；记录包含校区、楼栋、房间、支付时间、金额、状态和原始状态码。指定 `--to` 时，默认开始日期按该结束日期所在月份计算。

## MCP

只读工具为 `dorm_bindings`、`dorm_campuses`、`dorm_buildings`、`dorm_rooms`、`dorm_bills`。统一 CLI 与独立 Skill 使用相同方法和账号会话。绑定、修改与解绑通过 CLI 执行。

接口和实网范围见[接口记录](references/interfaces.md)。
