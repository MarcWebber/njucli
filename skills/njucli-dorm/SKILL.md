---
name: njucli-dorm
description: 查询南京大学宿舍电费系统的校区、楼栋、房间目录与本人电费充值记录。涉及宿舍电费、房间目录或充值记录时使用。
---

# 宿舍服务

本 Skill 统一承接电量、住宿与报修。当前已接入电费目录和充值记录；其余能力按实际接口逐步补充到本组。

在本 Skill 目录运行以下命令，统一 CLI 将 `node scripts/run.mjs` 换成 `njucli`。业务通过当前账号自动恢复 `epay` 会话；[官方电费入口](https://epay.nju.edu.cn/epay/h5/nju/electric/index)。

## 电费查询

```bash
node scripts/run.mjs dorm campuses --format json
node scripts/run.mjs dorm buildings CAMPUS_ID --format json
node scripts/run.mjs dorm rooms CAMPUS_ID BUILDING_ID --format json
node scripts/run.mjs dorm bills --format json
node scripts/run.mjs dorm bills --from 2026-08-01 --to 2026-10-16 --format json
```

先从 `campuses` 取得校区 ID，再从 `buildings` 取得楼栋 ID。房间的 `id` 与展示名称可能不同，后续选择以接口返回值为准。目录为空时依照官方页面的房间填写方式处理。

`bills` 查询当前账号的电费充值记录，默认从本月往前两个自然月的第一天到今天。返回日期范围及记录；记录包含校区、楼栋、房间、支付时间、金额、状态和原始状态码。指定 `--to` 时，默认开始日期按该结束日期所在月份计算。

现有命令提供目录与充值记录查询。剩余电量、地址绑定和缴费在官方电费页面办理；余额页面需要账号已有宿舍绑定，当前尚未封装余额接口。

## 住宿与报修入口

通过统一 CLI 或 `njucli-ehall` 检索官方办事指南：

```bash
njucli ehall guides 宿舍 --format json
njucli ehall link 4618295887225301 --format json
```

“宿舍申办”用于查询分配结果和住宿费用，具体开放范围以学校通知及账号权限为准。

[宿舍报修说明](https://itsc.nju.edu.cn/0c/27/c21558a724007/pagem.htm)提供南京大学信息门户、南京大学 APP 的“生活服务 → 宿舍报修”入口，支持新增报修、二次维修和评价。当前 CLI 尚未接入报修业务。

## MCP

只读工具为 `dorm_campuses`、`dorm_buildings`、`dorm_rooms`、`dorm_bills`。统一 CLI 与独立 Skill 使用相同方法和账号会话。

接口和实网范围见[接口记录](references/interfaces.md)。
