---
name: njucli-ehall
description: 使用 NjuCLI 查询并填报南京大学 e-Hall 研究生节假日离返校登记。用户要求填报假期行程、留校或离返校安排时使用，一次收齐必要信息并完成登记。
---

# 行程填报

## 前置条件

首次保存账号按[认证 Skill](../njucli-auth/SKILL.md)操作；已配置后直接执行行程命令，CLI 自动检查、复用或恢复 `ehall` 会话，并处理同一账号的并发调用。

本能力对应研究生节假日离返校登记，应用 ID 为 `6092355728536569`。

## 最少交互

先运行：

```bash
njucli ehall trip --format json
```

从 `data` 读取当前 `holiday`、`defaults`、`missing`、`transportOptions` 和 `records`。`status` 为 `open` 时可填报；`submitted` 表示当期已有登记，返回现状并停止新建；`closed` 表示当前无需登记。

将用户已给出的行程与 `missing` 对照，只把尚缺内容合成一次询问，不逐字段反复提问。例如缺行程而联系方式齐全时，可问：“这次假期全程留校，还是外出？外出请一起说离返校日期、目的地和详细地址、交通方式；有多个停留地时，再说明各地的起止日期。”若用户说全程留校，无须再问出行信息。联系方式不全时，将缺少的手机号、紧急联系人或紧急联系电话并入同一问题；缺少住宿信息时一起询问是否住校、校外居住地址。

用户已经提供完整行程并要求填报时直接执行，不增加重复确认。复用 `defaults` 中本人已有的联系方式和住宿信息；用户本次提供的值优先。日期、目的地、交通方式、详细地址以及“全程留校”须来自用户表述，不复制历史行程、不代为假设。相对日期结合当前假期和北京时间转成具体日期；不明确的信息在同一次询问中补齐。

## 直接提交

全程留校执行：

```bash
njucli ehall trip-submit --stay --format json
```

外出直接传入用户提供的日期、目的地、详细地址和交通方式：

```bash
njucli ehall trip-submit --from YYYY-MM-DD --to YYYY-MM-DD --destination 市或区县 --address "详细地址" --transport "交通方式" --format json
```

将示例中的值替换为用户本次材料。默认采用当前开放假期；需要指定时使用 `--holiday <id>`，ID 来自 `data.holiday.id`。可选 `--service-number` 填写班次，`--return-transport` 填写返校交通方式，用户未提供时省略，不为选填字段额外提问。

目的地使用规范市名或区县名（如“南京市”），须能在官方地区字典中唯一匹配；已能定位城市时不再追问区县。交通方式取 `transportOptions`。用户表述“国庆 2 号去上海、7 号回、火车、住家里”，已有联系方式齐全时，只补问家里的详细地址，不重复询问日期或假定返程交通。

联系方式和住宿信息默认复用；用户需要更新时使用 `--phone`、`--emergency-contact`、`--emergency-phone`、`--on-campus` 或 `--off-campus`、`--residence`。`--stay` 指假期全程留校；`--on-campus/--off-campus` 指目前是否住校，假期“住家里”不自动改变这项资料。

CLI 在当前账号目录的 `ehall.json` 中以 0600 权限保存 `{userId, contacts}`。缓存须匹配本次验证的本人 `userId`；当前官方资料优先、缓存补齐，仍有缺失才读取最近本人历史登记。正常查询同步真实默认值，显式联系人覆盖值在校验通过后、实际提交前保存。只保存联系方式与住宿资料，不保存历史行程，AI 无需另建联系人文件。

用户要求正式填报且材料完整时直接提交一次。`--dry-run` 完全可选，仅在用户要求检查或预览时添加，返回 `submitted: false` 和完整 `plan`；不保存登记，也不把输入中的联系人覆盖值保存为默认值。正常提交不需要预览、二次确认或额外的确认参数。

成功须为 `ok: true` 且 `data.submitted: true`，此时 CLI 已回读本人、假期、登记编号和填报字段。向用户简短说明登记结果与 `recordId`。

明细保存会立即写入，随后才提交总登记。若错误提示可能已有数据保存，保留错误中的 `stage`、`registrationIds` 并先运行 `ehall trip` 核对，不重试提交。未关联的明细可能不显示在总登记中，按返回编号在官方页面或由管理员核查，不能把查询为未登记当作可以直接重放的证明。

## 多段复杂行程

多次离返校或多地停留时，可由 AI 整理 JSON 并使用 `--input <file>`，不与上述直接填写的业务参数混用。输入结构如下：

| 字段 | 填写规则 |
| --- | --- |
| `holidayId` | 可省略，默认当前开放假期；指定时取 `data.holiday.id` |
| `stayOnCampus` | 必填布尔值，表示是否全程留校 |
| `phone`、`emergencyContact`、`emergencyPhone` | 可省略，依次复用本人手机号、紧急联系人和紧急联系电话 |
| `onCampus`、`residence` | 可省略，复用是否住校和目前居住具体地址；不住校时须有地址 |
| `trips` | 全程留校时省略或填 `[]`；外出时至少一项，每项表示一次离返校，含 `stops` 和可选 `returnTransport` |
| `trips[].stops[]` | 至少一站；每站含 `from`、`to`（`YYYY-MM-DD`）、`destination`（目的地市或区县的中文名称或官方代码）、`address`（详细地址至门牌号）、`transport`（官方交通选项名称或代码） |
| `trips[].stops[].serviceNumber` | 可选车次、班次或航班号；用户提供时填写 |
| `trips[].returnTransport` | 可选返校交通方式，使用官方选项名称或代码 |

同一次离返校内的站点、不同次离返校之间的日期均不能重叠；CLI 按首站开始日期和末站结束日期生成离校及返校日期。不要额外要求用户重复填写这两个日期。

```bash
njucli ehall trip-submit --input /path/to/trip.json --format json
```

临时输入文件以 0600 权限保存，完成或明确终止后删除；用户无须编写 JSON。联系方式和行程材料不放入仓库。

MCP 的 `ehall_trip` 仅查询，提交使用 CLI。接口与验证范围见[接口证据](https://github.com/MarcWebber/njucli/blob/main/docs/interface-evidence.md#研究生节假日行程登记2026-10-02)。
