---
name: njucli-hospital
description: 查询南京大学校医院预约项目、校区、日期和时段，创建或取消本人预约，查询和下载体检报告、读取乙肝结果，以及查询本人医保参保和缴费状态。
---

# 校医院

各命令提供一个独立校园动作，使用当前账号的统一认证会话连接[校医院自助平台](https://ndyy.nju.edu.cn/zzfw/)。只有命令提示认证失效时才运行 `njucli auth login sso`。

## 医院预约

| 命令 | 原子能力 |
| --- | --- |
| `njucli hospital kinds` | 读取当前开放的预约类别及 ID |
| `njucli hospital projects --kind KIND` | 读取该类别项目和本人的预约状态 |
| `njucli hospital campuses PROJECT_ID` | 读取项目可预约校区 |
| `njucli hospital dates PROJECT_ID CAMPUS` | 读取指定校区的日期及剩余人数 |
| `njucli hospital slots PROJECT_ID CAMPUS DATE` | 读取指定日期的时段及剩余人数 |
| `njucli hospital book PROJECT_ID --kind KIND --campus CAMPUS --date DATE --slot SLOT` | 预约用户指定的项目与时段，回读返回预约 ID |
| `njucli hospital cancel BOOKING_ID --kind KIND` | 取消本人的指定预约并回读 |

`KIND` 来自 `kinds`，省略时默认 `2`（疫苗）。`PROJECT_ID` 来自 `projects` 的 `id`；`BOOKING_ID` 来自同一结果的 `bookingId`。校区名称、日期和时段使用各目录接口的真实返回值；日期为 `YYYY-MM-DD`。查询输出中的 `fees` 为官方费用说明。预约只创建预约记录，现场服务和缴费遵循医院要求。

`projects` 的 `state` 保留远端状态码：`0` 未预约、`1` 已预约、`2` 已执行。提交结果不明确时，使用同类别的 `projects` 核对目标，避免重复创建。

## 报告

```bash
njucli hospital reports --page 1 --size 20 --format json
njucli hospital report-download REPORT_ID ./report.pdf --format json
njucli hospital hepatitis-reports --format json
```

`reports` 返回本人的报告 ID、名称、日期和 PDF 生成状态；下载限定本人报告且要求 `ready=true`。`report-download` 保存原始 PDF，同名文件覆盖，新文件权限为 0600。乙肝结果按官方字段提供检验结果与医生建议。

## 大学生医保

| 命令 | 原子能力 |
| --- | --- |
| `njucli hospital insurance-info` | 读取本人医保资料 |
| `njucli hospital insurance-fields` | 读取户籍性质与证件类型目录 |
| `njucli hospital insurance-records --page 1 --size 20` | 读取参保、缴费、办理及生效状态 |
| `njucli hospital insurance-opening` | 读取当前参保年度、开放时间和说明 |

`insurance-records` 返回本人参保年度、年数、应缴金额、缴费与生效状态。

## CLI 与 MCP

全部命令支持 `--format json`。MCP 提供同名 `hospital_` 工具，连字符改为下划线；CLI 和 MCP 复用相同业务方法与账号会话。接口、文件下载及写入验收范围见[接口说明](references/interfaces.md)。
