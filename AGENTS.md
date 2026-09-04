# NjuCLI 开发指南

## 仓库架构

NjuCLI 面向人和 AI 提供南京大学校园服务。没有远端契约或验证证据的能力，不得用空命令、猜测接口或伪成功占位。运行时要求 Node.js 20+，依赖统一使用仓库锁定的 pnpm 版本。

```text
src/
├── cli.ts              # 进程入口
├── commands/           # 命令注册、参数校验、文本展示
├── mcp/                # 只读 MCP，共用 NjuServices
├── app/                # service 接口与唯一生产装配点
├── auth/               # capability、会话、刷新、浏览器登录
├── domains/
│   ├── campus/         # 公开信息与 HTML 契约
│   ├── course/         # EHall 课表、日期展开与 ICS
│   ├── library/        # OPAC 查询契约
│   └── sports/         # 体育接口、签名与解析
└── core/               # 无领域含义的基础能力

tests/                  # 单元、fixture、fake session、路由回归
docs/                   # 产品边界与远端接口证据
```

固定链路：`CLI / MCP -> leaf command -> NjuServices -> auth gate -> one client -> parser -> DTO -> output`。`commands` 不请求远端，`mcp` 不复制业务逻辑，领域 client 不渲染输出，生产依赖只在 `src/app/production.ts` 组合。

## 开发规范

- 命令保持 `njucli <domain> <command> [target] [options]`；每个 leaf 显式绑定一个 service 方法，不增加字符串总分派或根级 action flag。
- JSON 只使用 leaf 的 `--format json` 或 `NJUCLI_FORMAT=json`；不要增加根级 `--json`、`--profile`、`--account`。
- 每个远端契约只保留一个 client 和一条请求序列，不轮询备用 endpoint、跨站补数或把错误改成空结果。
- 新 Adapter、Provider 或抽象层必须有至少两个生产调用方，并能删除真实重复代码；不为未来能力预留空壳。
- 跨领域且语义一致的能力放入 `core`；名称相同但规则、错误或契约不同的逻辑留在领域内。
- capability 只有在依赖图和生产 driver 都存在时才能注册；业务域 `course` 使用 `timetable`，不是独立认证节点。
- 远端响应先按固定契约解析。类型错误返回 `REMOTE_SCHEMA_CHANGED`，不以默认值吞掉；字段别名必须有脱敏 fixture 和 `docs/interface-evidence.md` 证据。
- 远端认证失效时最多刷新并重放同一幂等读取一次；未验证的写 endpoint 不发送、不重放，也不切换接口。
- 新增 mutation 必须有显式确认、唯一提交和 readback；验证码、支付及未验证写接口不注册空壳命令。
- 不读取日常浏览器 Cookie，不接收命令行密码，不记录姓名、学号、Cookie、JWT、ticket 或验证码。
- TypeScript 必须通过 strict、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noUnusedLocals` 和 `noUnusedParameters`。
- 修改远端能力时同步更新契约、fixture、设计文档和接口证据。

## 测试流程

默认测试必须离线、确定且不依赖真实账号：纯函数直接测试；client 使用脱敏 fixture 和 fake fetch；认证使用 fake browser session；CLI/MCP 通过共享 service spy 验证路由。同一不变量的不同输入写成一条表驱动测试，不复制 harness；不同错误语义保持独立用例。

```bash
pnpm lint
pnpm test
pnpm test:coverage
pnpm build
node dist/cli.js --help
node dist/cli.js campus sources --format json
npm pack --dry-run
```

验收分为源码/构建、离线回归、公开实网、认证实网四层，不能互相替代。受保护能力只有在校园网或 WebVPN 下取得非空真实数据后，才能标记为“南大实网可用”；实网会话和个人数据不得进入 CI 或 fixture。

## 上线步骤

1. 更新版本、用户说明、设计文档和受影响的接口证据，确认没有未接线命令、capability 或错误码。
2. 在 Node.js 20+ 下执行 `pnpm install --frozen-lockfile` 和全部测试命令；`pnpm build` 会先清理生成目录 `dist`。
3. 使用 `node dist/cli.js` 验证编译产物的帮助、JSON envelope 和公开信息；涉及远端或认证变更时完成相应实网 smoke。
4. 用 `npm pack --dry-run` 检查清单，再将实际 tarball 安装到临时目录验证 `njucli --help`。
5. 只有全部门禁通过且维护者明确授权后，才能发布 npm 包、Git tag 和 release notes；发布后从 registry 重装并复验。

测试、fixture 或本地 HTTP 成功都不能单独作为上线完成的证据。
