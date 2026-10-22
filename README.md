<p align="center">
  <img src="docs/assets/logo.svg" alt="NjuCLI Logo" width="88" />
</p>

# NjuCLI

**让 AI 帮你处理南大校园日常。**

[![CI](https://github.com/MarcWebber/njucli/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/MarcWebber/njucli/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-5FA04E?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License: Personal Use](https://img.shields.io/badge/License-Personal_Use-blue)](LICENSE)

南京大学校园服务套件，提供原子 CLI 命令与 MCP 工具，由 AI 选择动作、填写参数并组合使用。覆盖教务、邮件、云盘、表格、论文和校园个人事务。

## 一键安装

准备 Node.js 20+（含 npm）、Git、curl 和 Bash，在终端运行：

```bash
curl -fsSL https://raw.githubusercontent.com/MarcWebber/njucli/main/scripts/install.sh | bash
```

**一次安装整个 Skills 套件。** `njucli` 注册为全局命令，全部业务 Skill 一起安装到 `~/.codex/skills/njucli/`；设置 `CODEX_HOME` 时使用其 `skills/njucli/`。每个 Skill 保留自己的 `SKILL.md` 和能力说明，AI 按任务选择。后续用 `njucli upgrade` 一起更新。

## 让 AI 帮你安装

把下面这段话发给能执行本机终端命令的 AI 助手：

```text
请帮我安装 NjuCLI，仓库地址：
https://github.com/MarcWebber/njucli

先阅读仓库 README，检查安装环境，按一键安装方式全局安装 NjuCLI 和完整的 Skills 套件。
完成后确认 njucli 命令可用、全局 skills/njucli/ 下各业务的 SKILL.md 可读取，并做一次公开镜像查询验证。告诉我安装位置和验证结果。
```

安装后，重新打开 AI 会话即可读取套件。首次使用个人校园服务时，按[认证说明](skills/njucli-auth/SKILL.md)完成本人登录；公开镜像和机构目录可直接查询。

## 可以做什么

| 场景 | 你可以交给 AI 的任务 |
| --- | --- |
| 上课与教务 | [查课表、成绩、考试和空闲教室](skills/njucli-ehall/SKILL.md)，查看[软件学院](skills/njucli-se/SKILL.md)和[智汇南雍](skills/njucli-lms/SKILL.md)的课程与作业 |
| 邮件与文件 | [收发邮件与附件](skills/njucli-mail/SKILL.md)，[管理云盘、在线文档与白板](skills/njucli-box/SKILL.md)，[填写协同表格](skills/njucli-table/SKILL.md) |
| 学习与写作 | [图书检索、借阅和请求管理](skills/njucli-library/SKILL.md)，[研修间预约与取消](skills/njucli-library-room/SKILL.md)，[撰写与编译 LaTeX](skills/njucli-tex/SKILL.md)，[查找校园正版软件](skills/njucli-software/SKILL.md) |
| 校园生活 | [看通知、食堂信息、查镜像](skills/njucli-campus/SKILL.md)，[查体育场馆](skills/njucli-sports/SKILL.md)，查看[校园卡](skills/njucli-pay/SKILL.md)和[宿舍电费](skills/njucli-dorm/SKILL.md) |
| 就医与医保 | [预约与取消医院项目、查询及下载体检报告、查询医保资料和参保记录](skills/njucli-hospital/SKILL.md) |
| 校园事务 | [查青年平台活动](skills/njucli-youth/SKILL.md)，[申请成绩单与证明](skills/njucli-self-service/SKILL.md)，[预约 IT 侠维修](skills/njucli-itxia/SKILL.md)，[查教师与后勤联系方式](skills/njucli-institution/SKILL.md) |

全部业务见 [Skills 目录](skills/)。使用条件和验证范围随各 Skill 维护。

## 接入与文档

支持读取本地 Skill 并执行命令的 AI 助手，可使用完整套件；支持本地 stdio MCP 的客户端，可调用查询与写入工具。

[AI 客户端接入](docs/ai-plugin.md) · [WorkBuddy 教程](docs/workbuddy.md) · [安装与维护](docs/installation.md) · [贡献指南](CONTRIBUTING.md) · [问题反馈](https://github.com/MarcWebber/njucli/issues)

## 用户群

[点击加入飞书用户群](https://applink.feishu.cn/client/chat/chatter/add_by_link?link_token=dc4hab18-9c9e-4ca7-bdf0-dde104e2552c)，交流用法、反馈问题和获取更新。

<img src="docs/assets/njucli-user-group.png" alt="NjuCLI 用户群二维码" width="200" />

扫码加入 NjuCLI 用户群，也可使用上方链接。

## 许可证

[个人使用许可证](LICENSE)：允许非商业个人学习和本人校园事务使用；学校、机构及商业用途须另获书面授权。

## 关联项目

- [NJUWeb](https://github.com/MarcWebber/njuweb)：网页入口，提供用户登录、任务管理与成果交付。
- [NJURunner](https://github.com/MarcWebber/njurunner)：执行节点，在 Docker 沙箱中运行校园任务并返回结果。
