# NjuCLI

[![CI](https://github.com/MarcWebber/njucli/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/MarcWebber/njucli/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-5FA04E?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License: Personal Use](https://img.shields.io/badge/License-Personal_Use-blue)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/MarcWebber/njucli?style=flat)](https://github.com/MarcWebber/njucli/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/MarcWebber/njucli?style=flat)](https://github.com/MarcWebber/njucli/forks)

南京大学校园服务工具，让 AI 帮你查课表、收邮件、管理云盘和处理校园事务。

## 用户群

扫码或[点击链接加入飞书用户群](https://applink.feishu.cn/client/chat/chatter/add_by_link?link_token=dc4hab18-9c9e-4ca7-bdf0-dde104e2552c)，交流使用方法、反馈问题与获取项目更新。

<img src="docs/assets/njucli-user-group.png" alt="NjuCLI 飞书用户群二维码" width="320" />

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
| [njucli-itxia](skills/njucli-itxia/SKILL.md) | IT 侠维修预约、进度查询与取消 |
| [njucli-institution](skills/njucli-institution/SKILL.md) | 学院简介、教师基础信息与后勤电话；本地检索、官网读取与导出 |

```bash
njucli ehall schedule
njucli ehall grades
njucli se assignments --pending
njucli campus today
```

完整命令通过 `njucli --help` 和 `njucli <domain> --help` 查看。

查找学院、研究方向或后勤联系方式，无需校园账号：

```bash
njucli institution show public
njucli institution teachers 社会保障 --institution public
njucli institution search 人工智能 --kind teacher
njucli institution teacher software/李宣东
njucli institution services 水电 --live
njucli institution dump --output ./nju-knowledge
rg -n '公共政策' ./nju-knowledge/institutions
```

支持按姓名、职称/身份、分类、单位及联系方式（电话、邮箱、办公地点）等检索已收录的机构与教师基础资料。提供指定来源的官网实时核对功能，并支持将整个本地资料库导出为按学院分类的中文 Markdown 文件。收录范围详见 [资料范围](skills/njucli-institution/references/coverage.md)，跨院兼任按官网标注保留。

IT 侠支持 `njucli itxia create --input order.json --agree-terms` 提交维修预约，`njucli itxia status ORDER_ID` 查询状态与回复、`njucli itxia open ORDER_ID` 获取预约单页面打开方法，以及 `njucli itxia cancel ORDER_ID --yes` 取消预约。也可通过 `status --name "预约姓名" --phone "预约手机号"` 找回当前预约；字段和服务条款见 [IT 侠 Skill](skills/njucli-itxia/SKILL.md)。

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
