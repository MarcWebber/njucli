---
name: njucli
description: 使用 njucli 处理南京大学校园事务，包括教务、空闲教室、邮箱、云盘、写作和校园生活。用户提到南大服务或要求用 njucli 办事时使用。
---

# NjuCLI 校园服务套件

所有业务统一使用已安装的 `njucli`，可从任意目录执行。先按任务选择并读取对应说明；参数、登录方式与结果回读按该业务说明执行。

| 业务说明 | 服务 |
| --- | --- |
| [njucli-auth](njucli-auth/guide.md) | 统一认证与会话维护 |
| [njucli-campus](njucli-campus/guide.md) | 校园信息、NJU Mirror 镜像查询与今日汇总 |
| [njucli-ehall](njucli-ehall/guide.md) | 空闲教室、课表、选课、成绩、考试、培养方案、个人资料、奖学金草稿与办事大厅 |
| [njucli-pay](njucli-pay/guide.md) | 校园卡余额、消费与充值记录 |
| [njucli-dorm](njucli-dorm/guide.md) | 电费房间绑定与充值记录 |
| [njucli-self-service](njucli-self-service/guide.md) | 证明目录与申请、费用额度、邮件领取、申请撤销、打印机位置与云打印查询 |
| [njucli-library](njucli-library/guide.md) | 图书馆 |
| [njucli-sports](njucli-sports/guide.md) | 体育场馆 |
| [njucli-se](njucli-se/guide.md) | 软件学院课程平台 |
| [njucli-lms](njucli-lms/guide.md) | 智汇南雍课程、作业、测试与助教布置作业 |
| [njucli-tex](njucli-tex/guide.md) | TeX 写作 |
| [njucli-mail](njucli-mail/guide.md) | 校园邮箱 |
| [njucli-software](njucli-software/guide.md) | 正版软件 |
| [njucli-box](njucli-box/guide.md) | 南大云盘、在线文档、白板与可编辑数据图表 |
| [njucli-youth](njucli-youth/guide.md) | 青年平台 |
| [njucli-table](njucli-table/guide.md) | 协同表格、外部应用表单 API 填报与回读 |
| [njucli-itxia](njucli-itxia/guide.md) | IT 侠维修预约、进度查询与取消 |
| [njucli-institution](njucli-institution/guide.md) | 教师与院系联系方式、学院简介与后勤电话；本地检索、官网读取与导出 |

涉及多个业务时，按任务顺序组合相应命令。已有校园会话的查询通过 HTTP 执行；登录与会话处理见[统一认证](njucli-auth/guide.md)。公开镜像与机构目录可以直接查询。

用户授权具体业务后再执行提交、取消、上传和绑定等写操作，完成后核对指定目标的结果。网络和业务错误交由调用方处理；保留学校返回的原因供用户判断。

命令参数通过 `njucli <domain> --help` 查看。只读 MCP 使用 `njucli mcp`，需要写入时使用对应 CLI。
