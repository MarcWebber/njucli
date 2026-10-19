---
name: njucli-pay
description: 查询南京大学校园卡余额及消费、充值记录。涉及校园消费卡余额、账单或个人支付记录时使用。
---

# 校园卡与个人支付

查询本人校园卡余额和交易记录，复用当前账号的统一认证会话。

在本 Skill 目录运行以下命令，统一 CLI 将 `node scripts/run.mjs` 换成 `njucli`。

```bash
node scripts/run.mjs pay balance --format json
node scripts/run.mjs pay bills --format json
node scripts/run.mjs pay bills --from 2026-10-01 --to 2026-10-15 --page 1 --format json
```

`balance` 返回校园卡余额及币种 `CNY`，金额单位为元。

`bills` 同时查询消费和充值，默认最近 30 天，每页 200 条。`--from` 包含当日，`--to` 截止到指定日期的零点，不包含当日；示例查询 10 月 1 日至 14 日。默认截止日期为明天，可查询到今天的交易。通过 `--page` 翻页，返回日期范围、页码、总条数和本页记录。

每条交易包含日期、时间、交易性质、地点、金额及余额。金额保留远端正负号；微信消费的校园卡余额按官方页面处理为 `null`。空列表表示本页无记录，结合 `total` 判断整个日期区间的记录数。查询失败按远端错误报告，可根据错误缩短查询区间。

## MCP

只读工具为 `pay_balance`、`pay_bills`，与 CLI 使用相同方法和账号会话。

接口与实网范围见[接口说明](references/interfaces.md)。
