# Skill 组织与独立运行

业务按 Skill 组织，认证集中在 `src/auth/`。统一 CLI、独立 Skill 和 MCP 调用同一份业务实现。

## 归属

| 位置 | 内容 |
| --- | --- |
| `skills/njucli-*/SKILL.md` | 触发条件、运行方法和常用操作 |
| `skills/njucli-*/scripts/` | client、命令、展示、业务方法、MCP 和独立入口 |
| `skills/njucli-*/references/` | 较长流程、参数表和接口资料，按需设置 |
| `src/auth/` | 凭据、站点登录、会话探测与恢复 |
| `src/account/`、`src/core/` | 账号隔离、文件、日期、输入、输出等共用能力 |
| `src/app/`、`src/commands/`、`src/mcp/` | 共享运行环境、统一入口与协议处理 |
| `scripts/` | 构建、安装和 Skill 注册 |

现有 12 个 Skill：auth、campus、ehall、library、sports、se、tex、mail、software、box、youth、table。课表、选课、成绩、考试、培养方案和办事大厅归 `ehall`；`campus today` 复用课表、借阅和预约业务。组合所需的代码由构建打入独立入口。

认证、校园信息、图书馆、体育、软件学院课程、邮箱和正版软件的说明直接放在 `SKILL.md`。云盘、协同表格、TeX、青年平台另保留接口资料；教务与办事大厅另保留接口和行程填报说明，由入口链接按需读取。[接口索引](interface-evidence.md)指向各业务的说明。

业务类型从 client 或生产装配推导；CLI 与 MCP 复用参数枚举。需要认证的业务通过共享运行环境调用 `AuthCoordinator`，在同一会话中完成认证和请求。

## 结构参考

| 项目 | 可采用的组织方式 |
| --- | --- |
| [Anthropic Skills](https://github.com/anthropics/skills/tree/main/skills/pdf) | 每个 Skill 携带脚本和参考资料，入口说明指导按需读取 |
| [Superpowers](https://github.com/obra/superpowers/tree/main/skills/systematic-debugging) | 流程类 Skill 直接保存操作步骤和排查资料 |
| [Vercel Agent Skills](https://github.com/vercel-labs/agent-skills#skill-structure) | 共享构建工具留在仓库外层，按 Skill 生成交付产物 |

[Agent Skills 规范](https://agentskills.io/specification#optional-directories)将可执行代码放在 `scripts/`，参考资料放在可选的 `references/`。NjuCLI 采用这一归属，并保留一份认证源码。

## 独立安装

```bash
curl -fsSL https://raw.githubusercontent.com/MarcWebber/njucli/main/scripts/install.sh | bash -s -- --skill ehall
```

将 `ehall` 换成所需 Skill，例如 `se`。安装脚本构建并安装所选 Skill 的依赖，注册到宿主 Skill 目录；再次执行即可更新。完整安装省略 `--skill`。

11 个业务 Skill 各自提供只读 MCP，合计 91 项工具。

## 源码开发

```bash
pnpm install --frozen-lockfile
pnpm build
node skills/njucli-ehall/scripts/run.mjs ehall --help
```

构建为各 Skill 生成 `scripts/run.mjs` 与依赖清单 `package.json`。共享源码打入运行入口；运行依赖根据构建结果声明。修改认证源码后重新构建全部 Skill，用户重新安装即可更新。

## 验证

2026-10-08 本地验证：

| 检查 | 结果 |
| --- | --- |
| 类型与构建 | `pnpm lint` 通过，生成 12 个独立入口 |
| 本地集成 | 32 项测试通过，覆盖教务命令、校园汇总、会话迁移和旧入口清理 |
| 独立运行 | 12 个 Skill 在隔离目录启动，仅使用声明的依赖 |
| MCP | 11 个独立服务合计 91 项工具，与统一服务的名称和 schema 一致 |
| 安装 | 临时目录实装 `ehall`、`se` 和完整包通过；升级后的 12 个入口可用 |
| 文档 | 12 个 Skill 格式校验通过，78 个本地链接有效 |

学校接口的实网范围见[验收记录](design-v1.md#验收记录)。
