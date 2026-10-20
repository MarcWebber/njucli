# NJU Mirror 镜像查询

来源：[镜像站](https://mirror.nju.edu.cn/)及其[前端源码](https://github.com/nju-lug/Mira)。公开接口均使用 HTTP GET，无需认证。

| 地址 | 字段与用途 |
| --- | --- |
| [/configs/tunasync.json](https://mirror.nju.edu.cn/configs/tunasync.json) | `name`、`status`：同步镜像列表，默认路径为 `/{name}/` |
| [/configs/addition.json](https://mirror.nju.edu.cn/configs/addition.json) | `name`、`path`、`status`、`inherit`：覆盖同名条目、增加别名或代理镜像；继承源提供状态，`inherit` 可缺省或为 null |
| [/configs/documentations/index.json](https://mirror.nju.edu.cn/configs/documentations/index.json) | `name`、`redirect`：按名称关联帮助；有 redirect 时返回该地址，否则使用官网 `/help/{name}` |

名称采用忽略大小写的子串匹配，结果按名称排序。同步状态沿用官网字符串；帮助索引未收录的条目返回 `helpUrl: null`。当前查询范围为镜像仓库目录，具体版本由镜像目录提供。

公开实网已核对三份 JSON，以及构建后的 CLI 与独立 Skill 镜像查询命令。
