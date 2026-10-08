# 协同表格接口

[南大协同表格](https://table.nju.edu.cn/)使用 SeaTable，校内说明见[南大文档](https://doc.nju.edu.cn/books/18d80/page/6f3ef)。接口依据官方前端与实网请求核对，并参考 [SeaTable API Gateway](https://github.com/seatable/seatable-api-python/blob/master/seatable_api/api_gateway.py)。

## 工作区与模板

以下路径相对 `https://table.nju.edu.cn`。

| 方法 | 路径 | 参数与结果 |
| --- | --- | --- |
| GET | `/api/v2.1/workspaces/?detail=true` | `workspace_list`；表格来自 `table_list/shared_table_list/group_shared_dtables`，标识为 `uuid` |
| GET | `/api/v2.1/templates/` | `template_list`，字段 `name/display_name/description/category/link/card_image_url` |
| POST | `/api/v2.1/dtables/` | 表单 `name/owner`，返回 `{table}` |
| POST | `/api/v2.1/dtable-external-link/dtable-copy/` | 表单 `link/dst_workspace_id`，返回 `{dtable}` |
| PUT | `/api/v2.1/workspace/{workspace}/dtable/` | 表单 `name/new_name` |
| GET | `/api/v2.1/workspace/{workspace}/dtable/{name}/access-token/` | `access_token/dtable_uuid`，供该表格的 Gateway 请求使用 |

## 工作表与数据

以下路径位于 `/api-gateway/api/v2/dtables/{uuid}/`，使用 Bearer 令牌和 JSON 请求体。

| 动作 | 请求与关键字段 | 回读 |
| --- | --- | --- |
| 结构读取 | `GET metadata/`，返回 `metadata.tables` | 工作表 `_id/name/columns/views` |
| 工作表创建 | `POST tables/`，`table_name/lang/columns` | metadata 按 `_id` 核对 |
| 默认表整理 | `PUT/DELETE tables/`，`table_name/new_table_name` | 仅整理本次新建表格的默认工作表 |
| 字段新增 | `POST columns/`，`table_name/column_name/column_type/column_data` | metadata 按 `key` 核对 |
| 视图创建、更新 | `POST views/?table_name=...`；`PUT views/{name}/?table_name=...` | `GET` 同名视图 |
| 行读取 | `GET rows/?table_name=&convert_keys=true&start=&limit=&view_name=` | 字段名作键，`_id` 标识行 |
| 行新增 | `POST rows/`，`{table_name,rows}` | `inserted_row_count/row_ids:[{_id}]`，逐行读取 |
| 行修改 | `PUT rows/`，`{table_name,updates:[{row_id,row}]}` | `GET rows/{id}/?table_name=&convert_keys=true` |

视图排序和分组使用 `column_key/sort_type`，筛选使用 `column_key/filter_predicate/filter_term`；输入字段名称由 metadata 转成 key。分页默认100行、最多1000行，满页提供 `nextPage`。新增和修改每批1–1000行。

## 公式与登分模板

工作表先创建原始数据列，再按定义顺序增加公式列，以生成完整依赖。条件公式在空表可能被推断为字符串；登分模板使用 `value({总评})` 参与等级比较，并以隐藏数值列“排序分”排序。缺分时总评留空，零分正常参与计算。30%/20%/50%的权重及等级阈值均为可修改的示例规则。

## 验证范围

2026-10-07：查询、建表、模板复制、改名、字段和视图设置、行新增与修改已实网验证。登分样例覆盖普通成绩、满分、零分和缺分，公式与视图回读匹配。群组工作区写入、其他复杂字段及模板内应用复制待实网验收。
