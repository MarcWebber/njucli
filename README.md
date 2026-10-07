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

## 登录

首次登录可保存统一认证凭据，后续业务会在使用前检查会话，过期时调用官方登录流程：

```bash
njucli auth login --credentials ./auth-credentials.json
njucli auth status sso --format json
```

凭据文件包含 `username` 和 `password`。CLI 自动填写官方账号表单、识别拼图并执行滑块拖动，以学校验证通过和实际回跳为准；扫码由本人完成。普通查询通过 HTTP 复用已保存 Cookie，`auth status` 只检查和恢复已有会话，不提交密码；业务会话失效时才重新登录。TeX 登录会完成其官方基本信息授权。登录步骤见[认证 Skill](skills/njucli-auth/SKILL.md)。

保存凭据后，统一认证在后台恢复，无需每次打开窗口操作。滑块被拒绝时自动等待官方换图，最多尝试三张；账号密码错误直接返回学校提示。同一账号的 CLI 和 MCP 调用自动排队并读取最新 Cookie，进程意外退出后下一次调用可恢复。TeX 编辑等需要页面的操作仍打开可见浏览器。

持续维护登录态时，定时运行 `NJUCLI_ACCOUNT=default njucli auth maintain --format json`。该命令用现有会话访问 CAS 根认证，过期时自动使用本地凭据恢复，并保存 Cookie 和最近维护记录；建议每两小时执行。详见[自动维护步骤](skills/njucli-auth/SKILL.md#自动维护会话)。`kept-alive` 表示本次访问成功，`restored` 表示已自动重建会话，具体过期时间仍由学校控制。

## 行程填报

支持 e-Hall 的研究生节假日离返校登记。直接告诉 AI 本次行程即可；AI 先读取当前假期和已有联系方式，再一次性询问缺少的信息，整理表单并提交核对。已提供完整行程时直接办理，无需手写 JSON。

```bash
njucli ehall trip --format json
njucli ehall trip-submit --stay
njucli ehall trip-submit --from YYYY-MM-DD --to YYYY-MM-DD --destination 市或区县 --address "详细地址" --transport "交通方式"
```

全程留校用 `--stay`，外出填写日期、地点、地址和交通方式，默认使用当前开放假期。联系方式按账号保存并自动复用。`--dry-run` 是可选预览；多段复杂行程可选用 `--input`。参数和交互流程见[行程填报 Skill](skills/njucli-ehall/SKILL.md)；当前实网已核对查询与表单契约，真实行程提交尚待验收。

## 青年平台

接入 [学生第二课堂平台](https://youth.nju.edu.cn/tw/)，复用本地统一认证账号和会话：

```bash
njucli youth hours
njucli youth years
njucli youth hours --year 2025-2026 --format json
njucli youth activities --mine
njucli youth activities --state all
njucli youth categories --format json
njucli youth clubs --mine
```

支持志愿活动与培训、服务组织、第二课堂申请与成绩单、青马课程、社会实践、社团、实习岗位、学生骨干招募、票券、评选和科创申报记录。活动报名、取消、评价及培训报名使用指定 ID 单次提交并回读；完整参数和任务步骤见[青年平台 Skill](skills/njucli-youth/SKILL.md)。查询已完成本人账号实网核对；远端报名写入尚未用真实目标验收。

## 文档

[Skills](skills/) · [AI 客户端接入](docs/ai-plugin.md) · [贡献指南](CONTRIBUTING.md) · [问题反馈](https://github.com/MarcWebber/njucli/issues)

## 许可证

[个人使用许可证](LICENSE)：允许非商业个人学习和本人校园事务使用；学校、机构及商业用途须另获书面授权。
