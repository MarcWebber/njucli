# 协同表格接口

[南大协同表格](https://table.nju.edu.cn/)使用 SeaTable，校内说明见[南大文档](https://doc.nju.edu.cn/books/18d80/page/6f3ef)。接口依据官方前端与实网请求核对，并参考 [SeaTable API Gateway](https://github.com/seatable/seatable-api-python/blob/master/seatable_api/api_gateway.py)。

## 外部应用表单

外部应用使用 `/external-apps/{appUuid}/` 入口及独立的应用权限。入口 HTML 的 `window.shared.pageOptions` 提供 `appUuid`、`accessToken`、`appConfig`、`userIdInOrg`，`window.app.pageOptions` 提供 `csrfToken`、`name`。字符串按页面的 Unicode 转义解码，应用配置再按 JSON 解析。

HTTP 会话缺失时，读取 `/accounts/login/?next=/external-apps/{appUuid}/` 的 `csrfmiddlewaretoken`，向同一 URL 提交表单 `login/password/csrfmiddlewaretoken/next`。成功响应须回到指定应用入口。登录与后续请求使用同一 Cookie 会话；应用请求携带 `Authorization: Token {accessToken}`、`X-CSRFToken` 和应用入口 Referer。

以下路径相对 `/api/v2.1/universal-apps/{appUuid}/`：

| 方法 | 路径 | 参数与结果 |
| --- | --- | --- |
| GET | `metadata/` | `tables`，工作表 `_id/name/columns`，列 `key/name/type/data` |
| GET | `rows/?page_id={id}&start={offset}&limit={size}` | `success/error_message/metadata/results`；结果以列 key 为键，`_id` 标识行 |
| POST | `form-submit/` | JSON `{app_page_id,row_data,new_linked_rows:[],link_rows:[]}`；`row_data` 以字段名为键；返回 `success/success_message` |

`appConfig.settings.pages` 包含 `id/type/table_id`。表单页 `columns` 提供 `key/is_required/enable_fill_default_value/default_value/enable_not_change_default_value`；表格页 `shown_column_keys` 决定可回读字段。固定的 `{creator.id}`、`{creator.name}` 默认值从当前应用身份解析。日期列使用 `data.format=YYYY-MM-DD`，回读可返回带时区的 ISO 时间，比较其日期部分。

提交响应只包含成功标记。CLI 在提交前记录回读页的全部行 ID，提交后分页读取同一页面，仅接受一条新增且字段匹配的记录；旧记录、零条匹配和多条匹配均返回待确认结果。表单提交、认证和回读复用同一次会话；错误交由调用方处理。

接口证据：一次用户授权的实际填报已通过 HTTP 完成登录、元数据读取、表单提交和新增记录回读。应用内表格编辑权限与表单新增权限分别生效，填报使用 `form-submit/`。

独立 Skill 检查核对帮助与只读 MCP 契约。新增 CLI 的认证实网执行待后续实际业务任务核对。当前提交支持文本及日期，复杂字段、关联行与附件待确认对应契约。

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
