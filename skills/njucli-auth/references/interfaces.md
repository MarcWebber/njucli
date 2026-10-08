# 统一认证接口

## 统一身份认证

登录、凭据和会话恢复集中在 `src/auth/`。业务通过 `AuthCoordinator.ensureSession` 使用当前账号的 CLI 专用 Chrome；会话 Cookie 保存在账号目录，认证和业务共用同一 context。

| 能力 | 登录入口或依赖 | 会话检查 |
| --- | --- | --- |
| `sso` | `https://authserver.nju.edu.cn/authserver/login` | CAS 返回 EHall 首页 |
| `ehall` | `sso` → `https://ehall.nju.edu.cn/login` | 门户用户信息 |
| `timetable` | `ehall` | 当前学期查询 |
| `softse` | `sso` → `/login/index.php?authCAS=CAS` | `/my/` 的退出链接 |
| `tex` | `sso` → `/oauth/login` | 控制台和 `/api/user/info` |
| `sports` | `sso` | CAS 票据换取本次请求的业务令牌 |
| `vpn` | `sso` → WebVPN | 测试页可访问 |
| `opac` | `vpn` → 图书馆读者登录 | 借阅查询 |
| `selection` | 研究生选课站登录页 | `loadPublicInfo_course.do` |
| `box` | 云盘 `/accounts/login/` | `/api2/account/info/` |

`auth.json` 保存 `username/password`，用于 authserver 和云盘官方表单。邮箱的专用密码、绑定校验和网页向导由 `src/auth/mail-bind.ts` 接入。操作步骤见[使用说明](usage.md)。

## 会话与票据

`CASTGC` 和 ST 按 CAS 会话与服务票据处理，不作为 JWT 或 OAuth `refresh_token`。`service` 是票据绑定的业务地址；`renew=true` 要求重新提供主认证凭据，不代表延长现有会话。协议见 [Apereo CAS](https://apereo.github.io/cas/7.3.x/protocol/CAS-Protocol-Specification.html)。

个人中心 `GET /personalInfo/UserOnline/user/queryUserOnline` 返回 `datas.userOnline / userOnlineRememberMe`，没有剩余有效期字段。JSON 请求使用 `REFERERCE_TOKEN → refererToken` 和 `XSRF-TOKEN → X-XSRF-TOKEN`。会话持续可用的时长与服务端续期分别验证。

## OAuth 续期

[厂商接口](https://openapi.wisedu.com/openapi/auth/protocol/oauth/api/refreshToken.html)为 `POST /authserver/oauthApi/token/refresh`，表单传 `refresh_token`，成功返回 `access_token / refresh_token / token_type / expires_in`。南大地址用无效占位令牌查询返回 `invalid_refreshToken`。

实际接入需要获准的 `client_id / client_secret / redirect_uri` 和初始授权令牌；学校接入渠道见[统一认证服务](https://oi.nju.edu.cn/21440/list.htm)。OAuth 令牌刷新与 CAS Cookie 有效期分别验证。

## 验证范围

- SSO、SoftSE、TeX、云盘登录与跨进程会话读取已验证；各站点自然过期后的自动恢复仍待逐项验证。
- 个人中心和 EHall 均可取得 ST；`/authserver/serviceValidate` 携带 `pgtUrl` 时曾返回 `INVALID_PROXY_CALLBACK`，尚未取得 PGT 或 PT。
- OAuth 令牌刷新成功和 CAS 会话续期尚未验证。
