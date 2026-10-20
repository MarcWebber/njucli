# 空闲教室与镜像实网验证

验证日期：2026-10-20，Asia/Shanghai。Agent 通过终端实际运行构建后的统一 CLI、独立 Skill 和 stdio MCP，使用当前账号的有效 EHall 会话执行只读查询。请求通过 HTTP 完成；验证期间没有启动浏览器或提交业务写入。

## 执行证据

- [CLI 执行日志](assets/2026-10-20-mirrors-classrooms/cli.jsonl)：命令参数、执行时间、退出码、标准输出和标准错误。每行对应一次实际执行；首次校区查询失败也保留在日志中。
- [MCP 执行日志](assets/2026-10-20-mirrors-classrooms/mcp.jsonl)：实际启动命令、`tools/call` 参数与完整响应。
- [HTTP 请求摘要](assets/2026-10-20-mirrors-classrooms/http.json)：真实 client 的请求路径、表单参数、HTTP 状态、业务码与返回数量；附分页及楼栋参数的实测摘要。
- [本地检查日志](assets/2026-10-20-mirrors-classrooms/checks.log)：类型检查、构建及真实本地运行检查。

附件保留公开教室信息、应用目录与镜像结果。个人业务输出保留在本机；附件省略登录页正文、Cookie、认证请求头、学号及凭据。

## 空闲教室结果

下表命令均以 `node dist/cli.js` 开头，并带 `--format json`。结果是执行时的快照，后续查询以学校实时返回为准。

| 命令参数 | 实际结果 |
| --- | --- |
| `ehall classroom-campuses` | 返回鼓楼、浦口、仙林、苏州 4 个校区 |
| `ehall classroom-buildings 3` | 返回仙林 7 个教学楼目录项 |
| `ehall classrooms 2026-10-20 --campus 3 --period 5-8` | 返回 69 间，时间均为第 5–8 节对应的 14:00–18:00 四个课时 |
| `ehall classrooms 2026-10-20 --campus 3 --period 5-8 --building 11` | 返回仙Ⅰ区 18 间 |
| `ehall classrooms 2026-10-20 --campus 3 --period 5-8 --building 111` | 返回环科楼 B-105、B-106、B-108，共 3 间 |
| `ehall classrooms 2026-10-20 --campus 3 --period 5-8 --building 15` | 返回真实空结果，`total=0`、`items=[]` |
| `ehall classrooms tomorrow --campus 3 --period 1-2` | 日期解析为 2026-10-21，返回 163 间 |
| `ehall classrooms today --campus 1 --period 5` | 鼓楼返回 71 间，空闲时间为 14:00–14:50 |
| `ehall classrooms today --campus 2 --period 5-8` | 浦口返回 10 间 |
| `ehall classrooms today --campus 4 --period 5-8` | 苏州返回 25 间 |

独立入口 `node skills/njucli-ehall/scripts/run.mjs ehall classrooms 2026-10-20 --campus 3 --period 5-8 --building 111 --format json` 返回相同的 3 间环科楼教室。统一 MCP 的校区、楼栋、教室工具均执行了真实请求；统一与独立 MCP 的环科楼查询均返回 3 间，楼栋代码全部为 `111`。

实网修正：

1. 认证：首次直接访问应用首页后，业务请求返回 HTTP 403，CLI 错报为未登录。经官方 `appShow?appId=4768402106681759` 入口建立应用权限后，三个业务接口均返回 HTTP 200、`code=0`。client 每次调用均先经过该入口；HTTP 403 按实际 HTTP 错误报告。
2. 分页：同一条件下，`pageNumber=1/2`、`pageSize=3` 均返回完整的 69 间。CLI、MCP 和请求体已移除分页参数，一次返回全部匹配结果。
3. 楼栋：上游 `JXLDM=111` 返回 21 间，混有代码 `11` 的 18 间。client 按响应中的 `JXLDM` 精确筛选，并按筛选结果计算总数；实际 CLI 和 MCP 均确认结果为环科楼的 3 间。

## 服务搜索与镜像

| 入口与参数 | 实际结果 |
| --- | --- |
| 统一 CLI `ehall services "空闲教室"` | 返回空闲教室、教室资源管理、教室借用 3 个相关应用 |
| 统一 CLI `ehall services "成绩"` | 返回我的成绩、成绩认定申请 2 项 |
| 统一 CLI `ehall services "食堂"` | 返回“食堂餐饮”，应用 ID 为 `6940550212445446` |
| 统一 CLI `ehall services` | 返回当前账号默认目录 11 项 |
| 独立 Skill `ehall services "空闲教室"` | 返回同样 3 项 |
| 统一 MCP `ehall_services`，关键词“空闲教室” | 返回同样 3 项 |
| 独立 MCP `ehall_services`，关键词“食堂” | 返回“食堂餐饮” |
| 统一 CLI `campus mirrors ubuntu` | 读取真实公开 JSON，返回 8 项 |
| 独立 Skill `campus mirrors pypi` | 返回 3 项 |
| 统一 MCP `campus_mirrors`，关键词 `anaconda` | 返回 1 项 |

关键词搜索使用官网 `/jsonp/ywtb/searchAppAndService?searchKey=...` 的 `data.appList`。默认目录继续读取 `/jsonp/ywtb/onlineYwtbApps`。食堂餐饮的应用入口实际跳转到[官方介绍图片](https://ehall.nju.edu.cn/ywtb-portal/stcy.png)，本次验证范围为入口发现与访问。

同时实际执行 `ehall tasks --kind todo`、`ehall tasks --kind done`、`ehall applications --state active`，均成功返回当前账号的空列表。该结果仅验证本次空列表响应。

## 本地检查与后续验证

`pnpm lint`、`pnpm test` 通过。后者执行 TypeScript 构建、真实子进程文件锁检查，以及 18 个独立 Skill 的入口、声明依赖和 MCP 契约检查。远端业务结果以上面的实际请求日志为准。`npm pack --dry-run` 通过；实际 tarball 安装到临时目录后，安装产物的空闲教室查询返回环科楼 3 间，服务搜索也执行了真实请求。

研究生选课、宿舍绑定和青年平台能力的进一步实际请求结果见[选课、宿舍与青年平台验证](2026-10-20-selection-dorm-youth.md)。
