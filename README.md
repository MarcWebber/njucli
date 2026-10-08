# NjuCLI

[![CI](https://github.com/MarcWebber/njucli/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/MarcWebber/njucli/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-5FA04E?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License: Personal Use](https://img.shields.io/badge/License-Personal_Use-blue)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/MarcWebber/njucli?style=flat)](https://github.com/MarcWebber/njucli/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/MarcWebber/njucli?style=flat)](https://github.com/MarcWebber/njucli/forks)

南京大学校园服务工具，让 AI 帮你查课表、收邮件、管理云盘和处理校园事务。

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

## 只安装一个 Skill

例如，只安装南大云盘：

```bash
curl -fsSL https://raw.githubusercontent.com/MarcWebber/njucli/main/scripts/install.sh | bash -s -- --skill box
```

将 `box` 换成 `mail`、`tex` 等名称即可安装其他 Skill。再次运行同一命令即可更新。

## 现有 Skills

点击名称查看使用方法。

| Skill | 服务 |
| --- | --- |
| [njucli-auth](skills/njucli-auth/SKILL.md) | 统一认证与会话维护 |
| [njucli-campus](skills/njucli-campus/SKILL.md) | 校园信息 |
| [njucli-academic](skills/njucli-academic/SKILL.md) | 研究生教务 |
| [njucli-course](skills/njucli-course/SKILL.md) | 课表与选课 |
| [njucli-ehall](skills/njucli-ehall/SKILL.md) | 办事大厅与行程登记 |
| [njucli-library](skills/njucli-library/SKILL.md) | 图书馆 |
| [njucli-sports](skills/njucli-sports/SKILL.md) | 体育场馆 |
| [njucli-softse](skills/njucli-softse/SKILL.md) | 软件学院课程平台 |
| [njucli-tex](skills/njucli-tex/SKILL.md) | TeX 写作 |
| [njucli-mail](skills/njucli-mail/SKILL.md) | 校园邮箱 |
| [njucli-software](skills/njucli-software/SKILL.md) | 正版软件 |
| [njucli-box](skills/njucli-box/SKILL.md) | 南大云盘 |
| [njucli-youth](skills/njucli-youth/SKILL.md) | 青年平台 |
| [njucli-table](skills/njucli-table/SKILL.md) | 协同表格 |
| [njucli-today](skills/njucli-today/SKILL.md) | 今日汇总 |
| [njucli-doctor](skills/njucli-doctor/SKILL.md) | 服务检查 |

完整命令通过 `njucli --help` 和 `njucli <domain> --help` 查看。

## 文档

[Skills](skills/) · [AI 客户端接入](docs/ai-plugin.md) · [贡献指南](CONTRIBUTING.md) · [问题反馈](https://github.com/MarcWebber/njucli/issues)

## 许可证

[个人使用许可证](LICENSE)：允许非商业个人学习和本人校园事务使用；学校、机构及商业用途须另获书面授权。
