# 校园服务接口

接口路径、字段和验证范围随所属 Skill 保存。修改远端请求时，同步对应的接口说明。

| 能力 | 接口说明 |
| --- | --- |
| 统一身份认证 | [登录、会话与凭据](../skills/njucli-auth/references/interfaces.md) |
| 本科课表与研究生选课 | [课表、学期与选退课](../skills/njucli-course/references/interfaces.md) |
| 研究生教务 | [成绩、考试、课表与培养方案](../skills/njucli-academic/references/interfaces.md) |
| 网上办事大厅 | [服务、待办、办件与行程登记](../skills/njucli-ehall/references/interfaces.md) |
| SoftSE | [课程、作业、名单与成绩](../skills/njucli-softse/references/interfaces.md) |
| TeX | [项目、文件、编辑与编译](../skills/njucli-tex/references/interfaces.md) |
| 图书馆 | [书目、馆藏与借阅](../skills/njucli-library/references/interfaces.md) |
| 体育场馆 | [场馆、时段与预约记录](../skills/njucli-sports/references/interfaces.md) |
| 校园信息 | [新闻、公告与食堂](../skills/njucli-campus/references/interfaces.md) |
| 正版软件 | [目录与安装包](../skills/njucli-software/references/interfaces.md) |
| 校园邮箱 | [绑定、邮件与附件](../skills/njucli-mail/references/interfaces.md) |
| 南大云盘 | [资料库、文件、分享与协作](../skills/njucli-box/references/interfaces.md) |

## 研究生节假日行程登记

[行程接口](../skills/njucli-ehall/references/interfaces.md)包含表单字段、联系方式复用及提交结果。一次单站离返校登记已完成实网提交与回读；全程留校、多次离返校和多站行程由本地集成覆盖。

## 南大云盘

[云盘接口](../skills/njucli-box/references/interfaces.md)包含资料库、传输、链接与管理操作。实网已核对读取、扫描、已有分享、文件下载与内部链接；写入由本地集成覆盖，实际远端写入待验收。

## 验证范围

本地集成验证模块组合，实网验证确认学校部署的实际结果，两者分别记录。已有结果见[验收记录](design-v1.md#验收记录)，独立 Skill 和安装检查见[构建验证](skill-layout.md#验证)。
