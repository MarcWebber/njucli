# LMS 会话恢复与本科课表权限验证

本次使用用户已授权的实际校园账号，读取课程、待办和课表。没有新增测试、模拟接口、替身服务或校园写操作。身份、Cookie、CAS 票据和课程明细未写入报告。

## 故障与修复

LMS 入口先跳至 `lms-identity.nju.edu.cn/auth/realms/nju/protocol/cas/login`，随后返回 HTTP 的本站回调。原来的自动跟随请求收到 403，用户截图另有登录检查 HTTP 400。修复在 LMS client 内逐跳处理认证，只将 LMS 本站回调升级为 HTTPS，保留同一认证会话和票据参数。

本科课表应用入口的 403 原来被归为 `AUTH_REQUIRED`，使 Agent 引导用户反复登录。现在返回 `PERMISSION_DENIED`，提示按学籍选择课表入口，不附登录命令。

## 实际入口与结果

在部署容器内移除该账号仅属于 LMS 的 Cookie，保留 SSO 会话，运行实际 `LmsClient.restoreSession()` 和业务查询。脱敏命令输出如下：

```text
https://lms.nju.edu.cn/user/index                              302
https://lms-identity.nju.edu.cn/auth/realms/nju/protocol/cas/login 302
https://lms.nju.edu.cn/user/index                              302
https://lms.nju.edu.cn/user/index                              200
freshLmsSession: true
POST https://lms.nju.edu.cn/api/my-courses                     200
GET  https://lms.nju.edu.cn/api/todos                          200
courses: 20, total: 24, todos: 0
```

重建部署后，经 Web 使用的 `runNjucli` 调用实际 CLI：

| 入口 | 实际结果 |
| --- | --- |
| `njucli lms courses --format json` | 成功；第一页 20 门，总计 24 门 |
| `njucli lms todos --format json` | 成功；0 条待办 |
| `njucli ehall tasks --format json` | 成功；0 条待办 |
| `njucli ehall graduate-schedule --format json` | 成功；当前学期 0 门课程 |
| `njucli ehall today --format json` | `PERMISSION_DENIED`；此账号无本科课表应用权限 |

网页中的 Gemini Flash 随后通过正式 Runner 沙箱完成 `lms courses`、`lms courses --page 2`、`lms todos`，返回完整 24 门课程及空待办，无 `connect_campus` 中断。

## 构建与范围

TypeScript 编译和 CLI 构建成功；Web、Runner Docker 镜像均构建成功，部署已更新。此次验证覆盖 LMS 会话恢复和课程/待办查询、eHall 待办与课表入口；其他校园系统和写操作未计入本次结论。
