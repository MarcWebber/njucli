# 南大云盘接口

站点：`https://box.nju.edu.cn`。接口依据本站前端和 [Seafile API](https://cloud.seafile.com/published/web-api/v2.1/libraries.md)；以下路径均相对此站点。

| 动作 | 请求 | 主要参数或字段 |
| --- | --- | --- |
| 用量 | `GET /api2/account/info/` | `name / usage / total / space_usage` |
| 资料库 | `GET/POST /api2/repos/` | 创建：`name`；结果：`id / name / size / permission / encrypted` |
| 资料库改名、删除 | `POST /api2/repos/{id}/?op=rename`；`DELETE /api/v2.1/repos/{id}/` | `repo_name` |
| 已删除资料库、恢复 | `GET/POST /api/v2.1/deleted-repos/` | `repo_id` |
| 目录、扫描 | `GET /api2/repos/{id}/dir/` | `p / recursive=1`；递归项含 `parent_dir` |
| 搜索 | `GET /api2/search/` | `q / search_repo / page / per_page` |
| 下载 | `GET /api2/repos/{id}/file/` | `p / reuse=1`；返回短期传输地址 |
| 上传 | `GET /api2/repos/{id}/upload-link/`，再向返回地址 POST | `p / from=web`；multipart：`file / parent_dir / replace`；`ret-json=1` |
| 创建、改名目录 | `POST /api2/repos/{id}/dir/` | `p`；`operation=mkdir / create_parents=true` 或 `operation=rename / newname` |
| 文件改名 | `POST /api/v2.1/repos/{id}/file/` | `p / operation=rename / newname` |
| 删除文件或目录 | `DELETE /api/v2.1/repos/{id}/{file或dir}/` | `p` |
| 复制、移动 | `POST /api/v2.1/repos/{sync或async}-batch-{copy或move}-item/` | `src_repo_id / src_parent_dir / src_dirents / dst_repo_id / dst_parent_dir` |
| 分享 | `GET/POST /api/v2.1/share-links/`；`GET/DELETE /api/v2.1/share-links/{id}/` | `repo_id / path / password / expiration_time / permissions`；结果 `token → id`，`link → url` |
| 上传链接 | `GET/POST /api/v2.1/upload-links/`；`DELETE /api/v2.1/upload-links/{id}/` | `repo_id / path / password / expiration_time` |
| 内部链接 | `GET /api/v2.1/smart-link/` | `repo_id / path / is_dir`；结果 `smart_link` |
| 收藏 | `GET/POST/DELETE /api/v2.1/starred-items/` | `repo_id / path`；列表 `starred_item_list` |
| 文件锁定 | `PUT /api/v2.1/repos/{id}/file/` | `p / operation=lock或unlock`；结果 `is_locked` |
| 历史 | `GET /api/v2.1/repos/{id}/history/` | `page / per_page`；结果 `data / more` |
| 回收站 | `GET /api/v2.1/repos/{id}/trash/` | `path / scan_stat`；结果 `data / more / scan_stat` |
| 文件、目录恢复 | `PUT /api2/repos/{id}/{file或dir}/revert/` | `p / commit_id` |
| 群组 | `GET /api/v2.1/shareable-groups/` | `id / name` |
| 协作权限 | `GET/PUT/DELETE /api2/repos/{id}/dir/shared_items/` | `p / share_type / username或group_id / permission=r或rw` |

跨库复制移动按 `task_id` 查询 `query-copy-move-progress`。目录创建与改名接口可能返回 301 JSON。写请求的 CSRF 头为 `X-CSRFToken`，取自 `sfcsrftoken` Cookie。

## 验证范围

2026-10-08：查询、扫描、已有链接读取和文件下载已实网验证。上传、创建分享及其他管理写入已通过本地集成，实网写入待验证。
