# 统一认证接口

## 统一身份认证

登录、凭据和会话恢复集中在 `src/auth/`。业务通过 `AuthCoordinator.ensureSession` 检查当前账号，认证与业务共用当次会话。

| 能力 | 登录入口或依赖 | 会话检查 |
| --- | --- | --- |
| `sso` | `https://authserver.nju.edu.cn/authserver/login` | CAS 返回 EHall 首页 |
| `ehall` | `sso` → `https://ehall.nju.edu.cn/login` | 门户用户信息 |
| `timetable` | `ehall` | 当前学期查询 |
| `softse` | `sso` → `/login/index.php?authCAS=CAS` | `/my/` 的退出链接 |
| `tex` | `sso` → `/oauth/login` | `/api/user/info` |
| `sports` | `sso` | CAS 票据换取本次请求的业务令牌 |
| `youth` | `sso` → 青年平台 | 平台用户信息 |
| `table` | `sso` → 协同表格 | 首页的 `csrfToken` 和 `username` |
| `vpn` | `sso` → WebVPN | 测试页可访问 |
| `opac` | `vpn` → 图书馆读者登录 | 借阅查询 |
| `selection` | 研究生选课站登录页 | `loadPublicInfo_course.do` |
| `box` | 云盘 `/accounts/login/` | `/api2/account/info/` |

`auth.json` 保存 `username/password`，用于 authserver 和云盘官方表单。邮箱的专用密码、绑定校验和网页向导由 `src/auth/mail-bind.ts` 接入。操作步骤见[使用说明](usage.md)。

## 会话管理

- HTTP 查询直接使用保存的 Cookie，需要页面时再启动 Chrome。结束时保存全部 Cookie，包含持久 Cookie。
- 同一账号通过进程锁串行读写；取得锁后读取最新会话，退出后释放，持有进程崩溃后可恢复。
- SSO、SoftSE、TeX 状态检查使用 HTTP，不读取密码或提交授权。TeX 主动登录可提交官方 `user_profile` 授权；编辑和编译使用可见页面。
- `auth maintain` 检查 SSO，失效时使用已存凭据登录，成功后记录执行时间和动作。登录失败及登录后的复核失败保持 `expired`。
- 官方滑块最多尝试三张，依据官方验证响应判断结果。业务写入保持一次提交。

## 验证范围

本地集成覆盖 Cookie 跨调用保存、账号互斥与崩溃恢复、维护命令、HTTP 状态检查、TeX OAuth 授权和登录失败状态。当前各站点实网结果见所属 Skill 的接口资料。

2026-10-07 实网核对：SSO、TeX、SoftSE、青年平台的已有会话均为 `valid`；`auth maintain` 返回 `kept-alive/valid`。自然失效后的后台恢复与跨期限持续性待实网核对。

`kept-alive` 表示本次 CAS 访问成功，`restored` 表示重新建立会话。
