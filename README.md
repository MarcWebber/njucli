# NjuCLI

[![CI](https://github.com/MarcWebber/njucli/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/MarcWebber/njucli/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-5FA04E?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License: Personal Use](https://img.shields.io/badge/License-Personal_Use-blue)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/MarcWebber/njucli?style=flat)](https://github.com/MarcWebber/njucli/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/MarcWebber/njucli?style=flat)](https://github.com/MarcWebber/njucli/forks)

南京大学校园服务工具，每个 Skill 携带自己的业务脚本和资料，共享统一认证，也可通过 `njucli` 统一调用。

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

## 单独使用 Skill

从安装包或执行 `pnpm build` 后的源码中，复制所需的 `skills/njucli-*` 目录。安装该目录声明的依赖，即可独立运行：

```bash
SKILL_DIR=/absolute/path/njucli-box
npm install --omit=dev --ignore-scripts --prefix "$SKILL_DIR"
node "$SKILL_DIR/scripts/run.mjs" box --help
```

每个入口都提供 `account` 和 `auth`，共用本地账号与会话。代码归属、项目对比和构建方式见[Skill 组织说明](docs/skill-layout.md)。

## 登录

首次登录可保存统一认证凭据，后续业务会在使用前检查会话，过期时调用官方登录流程：

```bash
njucli auth login --credentials ./auth-credentials.json
njucli auth status sso --format json
```

凭据文件包含 `username` 和 `password`；遇到滑块或扫码时在官方页面完成验证。登录步骤见[认证 Skill](skills/njucli-auth/SKILL.md)。

## 行程填报

支持 e-Hall 的研究生节假日离返校登记。直接告诉 AI 本次行程即可；AI 先读取当前假期和已有联系方式，再一次性询问缺少的信息，整理表单并提交核对。已提供完整行程时直接办理，无需手写 JSON。

```bash
njucli ehall trip --format json
njucli ehall trip-submit --stay
njucli ehall trip-submit --from YYYY-MM-DD --to YYYY-MM-DD --destination 市或区县 --address "详细地址" --transport "交通方式"
```

全程留校用 `--stay`，外出填写日期、地点、地址和交通方式，默认使用当前开放假期。联系方式按账号保存并自动复用。`--dry-run` 是可选预览；多段复杂行程可选用 `--input`。参数和交互流程见[行程填报 Skill](skills/njucli-ehall/SKILL.md)。

## 南大云盘

支持 [NJU Box](https://box.nju.edu.cn/) 的资料库、目录扫描与搜索、文件和目录上传下载、复制移动、分享及上传链接、收藏、文件锁定、版本恢复与成员协作：

```bash
njucli box repos --format json
njucli box scan --format json
njucli box upload <repo-id> ./资料.pdf --parent /课程 --format json
njucli box download <repo-id> /课程/资料.pdf --output ./资料.pdf --format json
njucli box share <repo-id> /课程/资料.pdf --expire-days 7 --format json
```

分享结果直接返回 `url` 和管理链接所需的 `id`。已有统一认证凭据自动用于云盘官网登录；完整流程见[云盘 Skill](skills/njucli-box/SKILL.md)，接口及验证范围见[云盘证据](skills/njucli-box/references/interfaces.md)。

## 文档

[Skills](skills/) · [AI 客户端接入](docs/ai-plugin.md) · [贡献指南](CONTRIBUTING.md) · [问题反馈](https://github.com/MarcWebber/njucli/issues)

## 许可证

[个人使用许可证](LICENSE)：允许非商业个人学习和本人校园事务使用；学校、机构及商业用途须另获书面授权。
