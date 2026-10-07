# NjuCLI

[![CI](https://github.com/MarcWebber/njucli/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/MarcWebber/njucli/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-5FA04E?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License: Personal Use](https://img.shields.io/badge/License-Personal_Use-blue)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/MarcWebber/njucli?style=flat)](https://github.com/MarcWebber/njucli/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/MarcWebber/njucli?style=flat)](https://github.com/MarcWebber/njucli/forks)

南京大学校园服务的命令行工具，配套 Skills 供 AI 助手调用。

## 安装

需要 Node.js 20+、Git 和 curl。网页登录需要 Google Chrome，目前主要在 macOS 上验证。

```bash
curl -fsSL https://raw.githubusercontent.com/MarcWebber/njucli/main/scripts/install.sh | bash
```

同时安装全局 `njucli` 和 Codex Skills。

升级：

```bash
njucli upgrade
```

## 现有 Skills

安装时注册以下 8 个 Skill；点击名称查看操作步骤与命令参数。

| Skill | 服务 |
| --- | --- |
| [njucli-auth](skills/njucli-auth/SKILL.md) | 统一认证 |
| [njucli-mail](skills/njucli-mail/SKILL.md) | 校园邮箱 |
| [njucli-softse](skills/njucli-softse/SKILL.md) | 软件学院课程平台 |
| [njucli-software](skills/njucli-software/SKILL.md) | 正版软件 |
| [njucli-tex](skills/njucli-tex/SKILL.md) | TeX 写作 |
| [njucli-ehall](skills/njucli-ehall/SKILL.md) | 研究生行程登记 |
| [njucli-table](skills/njucli-table/SKILL.md) | 协同表格 |
| [njucli-youth](skills/njucli-youth/SKILL.md) | 青年平台 |

完整命令通过 `njucli --help` 和 `njucli <domain> --help` 查看。

## 文档

[AI 客户端接入](docs/ai-plugin.md) · [接口与验证记录](docs/interface-evidence.md) · [贡献指南](CONTRIBUTING.md) · [问题反馈](https://github.com/MarcWebber/njucli/issues)

## 许可证

[个人使用许可证](LICENSE)：允许非商业个人学习和本人校园事务使用；学校、机构及商业用途须另获书面授权。
