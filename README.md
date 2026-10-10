# NjuCLI

[![CI](https://github.com/MarcWebber/njucli/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/MarcWebber/njucli/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-5FA04E?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License: Personal Use](https://img.shields.io/badge/License-Personal_Use-blue)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/MarcWebber/njucli?style=flat)](https://github.com/MarcWebber/njucli/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/MarcWebber/njucli?style=flat)](https://github.com/MarcWebber/njucli/forks)

南京大学校园服务工具，让 AI 帮你查课表、收邮件、管理云盘和处理校园事务。

## 安装

需要 Node.js 20+、Git、curl 和 Bash。网页登录及页面操作使用本机浏览器，运行前提见[认证 Skill](skills/njucli-auth/SKILL.md#运行前提)。

```bash
curl -fsSL https://raw.githubusercontent.com/MarcWebber/njucli/main/scripts/install.sh | bash
```

同时安装全局 `njucli` 和 Skills。Skill 默认注册到 `${CODEX_HOME:-~/.codex}/skills/`，可通过 `NJUCLI_SKILLS_DIR` 指定其他客户端的目录。使用 `NJUCLI_INSTALL_PREFIX` 指定 CLI 安装前缀时，将其 `bin` 目录加入 PATH。

升级：

```bash
njucli upgrade
```

## 只安装一个 Skill

例如，只安装教务与办事大厅：

```bash
curl -fsSL https://raw.githubusercontent.com/MarcWebber/njucli/main/scripts/install.sh | bash -s -- --skill ehall
```

将 `ehall` 换成 `se`、`box`、`mail` 等名称即可安装其他 Skill。再次运行同一命令即可更新。

## 现有 Skills

点击名称查看使用方法。

| Skill | 服务 |
| --- | --- |
| [njucli-auth](skills/njucli-auth/SKILL.md) | 统一认证与会话维护 |
| [njucli-campus](skills/njucli-campus/SKILL.md) | 校园信息与今日汇总 |
| [njucli-ehall](skills/njucli-ehall/SKILL.md) | 课表、选课、成绩、考试、培养方案与办事大厅 |
| [njucli-library](skills/njucli-library/SKILL.md) | 图书馆 |
| [njucli-sports](skills/njucli-sports/SKILL.md) | 体育场馆 |
| [njucli-se](skills/njucli-se/SKILL.md) | 软件学院课程平台 |
| [njucli-tex](skills/njucli-tex/SKILL.md) | TeX 写作 |
| [njucli-mail](skills/njucli-mail/SKILL.md) | 校园邮箱 |
| [njucli-software](skills/njucli-software/SKILL.md) | 正版软件 |
| [njucli-box](skills/njucli-box/SKILL.md) | 南大云盘 |
| [njucli-youth](skills/njucli-youth/SKILL.md) | 青年平台 |
| [njucli-table](skills/njucli-table/SKILL.md) | 协同表格 |

```bash
njucli ehall schedule
njucli ehall grades
njucli se assignments --pending
njucli campus today
```

完整命令通过 `njucli --help` 和 `njucli <domain> --help` 查看。

业务命令按需恢复校园登录。`njucli auth maintain` 执行一次统一认证与 EHall 会话维护；周期维护和登录状态核对见[认证 Skill](skills/njucli-auth/SKILL.md#会话维护)。

保存统一认证凭据后，可启动 CLI 后台保活进程：

```bash
njucli auth daemon start
njucli auth daemon status --format json
njucli auth daemon stop
```

常驻 CLI 进程默认每轮结束后等待 10 分钟，`start --interval 300` 可设为五分钟。退出终端后继续运行，状态返回进程 PID；运行前提、启动与停止方式见[后台保活](skills/njucli-auth/SKILL.md#后台保活)。

## 文档

[校园网验证与校医院接入评估](docs/reports/2026-10-10-intranet.md) · [Skills](skills/) · [AI 客户端接入](docs/ai-plugin.md) · [贡献指南](CONTRIBUTING.md) · [问题反馈](https://github.com/MarcWebber/njucli/issues)

## 许可证

[个人使用许可证](LICENSE)：允许非商业个人学习和本人校园事务使用；学校、机构及商业用途须另获书面授权。
