# 行程填报

## 查询

准备 Google Chrome，选择本人账号；需要登录时执行 `node "$SKILL_DIR/scripts/run.mjs" auth login ehall`。同一账号串行执行命令。

```bash
node "$SKILL_DIR/scripts/run.mjs" ehall trip --format json
```

从 `data` 读取 `holiday/defaults/missing/transportOptions/records`。`status` 为 `open` 时可填报，`submitted` 表示当期已有登记，`closed` 表示无需登记。

复用本人 `defaults`，将缺少的必填信息合为一次询问。本次留校选择、日期、目的地、详细地址和交通方式由用户提供；相对日期结合当前假期和北京时间确定。材料齐全且用户已要求填报时直接提交。

## 直接提交

```bash
node "$SKILL_DIR/scripts/run.mjs" ehall trip-submit --stay --format json
node "$SKILL_DIR/scripts/run.mjs" ehall trip-submit --from YYYY-MM-DD --to YYYY-MM-DD --destination 市或区县 --address "详细地址" --transport "交通方式" --format json
```

第一条用于全程留校；第二条用于单次离返校、单个目的地。默认采用当前开放假期，指定假期时用 `--holiday <data.holiday.id>`。目的地须在官方地区字典中唯一匹配，城市级名称即可；交通方式取 `transportOptions`。用户提供班次或返校交通时，分别加 `--service-number`、`--return-transport`。

联系方式和住宿信息默认复用，更新时使用 `--phone`、`--emergency-contact`、`--emergency-phone`、`--on-campus/--off-campus`、`--residence`。`--stay` 表示假期全程留校，`--on-campus/--off-campus` 表示目前是否住校。

用户要求预览时加 `--dry-run`，结果含 `submitted: false` 和完整 `plan`，保留联系人默认值。正常提交成功为 `ok: true` 且 `data.submitted: true`，向用户返回登记结果和 `recordId`。

明细保存立即生效。失败时保留 `stage/registrationIds`，先用 `ehall trip` 核查；未关联明细可能尚未出现在总登记中，需按编号到官方页面核对后再处理。

## 多段行程

多次离返校或多地停留时，由 AI 整理 JSON，以 `--input <file>` 提交；该选项与直接填写参数互斥。

| 字段 | 填写规则 |
| --- | --- |
| `holidayId` | 可省略，默认当前开放假期 |
| `stayOnCampus` | 必填布尔值，表示是否全程留校 |
| `phone/emergencyContact/emergencyPhone` | 可省略，复用本人联系方式 |
| `onCampus/residence` | 可省略，复用目前住宿资料；不住校时须有地址 |
| `trips` | 留校时省略或为 `[]`；外出时每项表示一次离返校，含 `stops` 和可选 `returnTransport` |
| `trips[].stops[]` | 至少一站；含 `from/to`（`YYYY-MM-DD`）、`destination`（市或区县名称或代码）、`address`（详细地址）、`transport`（官方选项名称或代码） |
| `trips[].stops[].serviceNumber` | 可选车次、班次或航班号 |
| `trips[].returnTransport` | 可选返校交通方式 |

站点及不同次离返校的日期均不得重叠；离校和返校日期由首站开始、末站结束日期生成。

```bash
node "$SKILL_DIR/scripts/run.mjs" ehall trip-submit --input /path/to/trip.json --format json
```

临时输入文件以 0600 权限保存，完成后清理。联系人由 CLI 按账号保存和复用。只读 MCP 使用 `ehall_trip`；[接口说明](interfaces.md#研究生节假日行程登记)包含字段和验证范围。
