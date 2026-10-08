# 图书馆接口

## 图书馆 OPAC

[图书馆官网](https://lib.nju.edu.cn/)的纸本检索和“我的图书馆”使用 `https://opac.nju.edu.cn/`。直连遇到学校 VPN 提示时返回 `VPN_REQUIRED`；查询使用 WebVPN，借阅查询还需读者登录。

| 方法 | 路径 | 返回字段 |
| --- | --- | --- |
| POST | `/meta-local/opac/search/` | `data.actualTotal`、`dataList`；书目含 `bibId/title/author/callno/itemCount/circCount` |
| GET | `/meta-local/opac/bibs/{bibId}/infos` | `baseInfo` 中的题名与作者 |
| GET | `/meta-local/opac/bibs/{bibId}/holdings` | `data.holdings` 为 JSON 字符串；解析 `callNo/library/location/shelfMark/status/itemsAvailable` |
| GET | `/meta-local/opac/users/loans?page=...&pageSize=...` | 题名、应还日和逾期状态 |

接口形态参考 [WUST Library Mini Program](https://github.com/LingHangStudio/wust-library-mini-program) 对应的汇文实例。已验证同产品接口；南大部署的读者登录、四项查询及字段仍待校园网实测。
