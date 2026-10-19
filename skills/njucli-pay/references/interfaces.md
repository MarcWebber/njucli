# 校园卡查询接口

[校园卡充值页](https://epay.nju.edu.cn/epay/h5/recharge)、[交易记录页](https://epay.nju.edu.cn/epay/h5/nju/bills)。以下路径均相对 `https://epay.nju.edu.cn`。

## 会话与请求

业务请求复用同一次 SSO 会话。GET 业务页面完成站点会话交接，返回路径与目标页面一致后解析。交易页的 `meta[name=_csrf_header]` 和 `meta[name=_csrf]` 提供后续 POST 所需的请求头名称和值。

| 请求 | 契约 |
| --- | --- |
| `GET /epay/h5/recharge` | 从“校园卡余额：”段落的 `span` 读取元余额；缺少余额或格式变化时报错 |
| `GET /epay/h5/nju/bills` | 获取交易页面及 CSRF 字段 |
| `POST /epay/h5/getBills.json` | URL 编码表单：`starttime/endtime` 为 `YYYYMMDD000000`，`pageno` 从 1 开始，`pagesize=200` 与官方页面一致 |

交易响应有两层业务状态：外层 `retcode` 与 `data.retcode` 均为 `0` 时才解析 `data.data`。其中 `list` 为记录，`pageno/pagesize/totalcnt` 为分页数据。任一业务状态失败均返回远端错误，缺失列表或分页字段按契约变化报告。

前端展示字段为 `transdate`（YYYYMMDD）、`transtime`（HHMMSS）、`transname`（交易性质）、`termname`（地点）、`amount`（带符号金额）和 `balance`（余额）。`transname` 同时含“微信”和“消费”时，官方页面隐藏余额，CLI/MCP 输出 `null`。

日期区间沿用官方请求的零点边界，`to` 不含当日。CLI/MCP 在入口校验日期和页码，远端响应由 client 校验。无自动翻页或业务重试。

## 实网范围

已核对统一认证到业务页面的跳转、页面余额、CSRF、两层成功状态，以及空列表和 `pageno/pagesize/totalcnt`。非空交易记录的字段来自官方页面展示逻辑，实际非空记录与后续页仍待核对。较大日期区间可返回业务错误，CLI 保留该错误。
