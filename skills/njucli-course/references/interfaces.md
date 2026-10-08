# 课表与选课接口

## 本科个人课表

入口为 `https://ehall.nju.edu.cn/appShow?appId=4770397878132218`，随后访问课表 index 和 `changeAppRole/wdkb/20230211151103310.do`。以下路径相对 `https://ehallapp.nju.edu.cn/jwapp/sys/wdkb/modules/`。

| 查询 | 请求 | 响应数据键 |
| --- | --- | --- |
| 学期列表 | `POST jshkcb/xnxqcx.do` | `datas.xnxqcx.rows` |
| 当前学期 | `POST jshkcb/dqxnxq.do` | `datas.dqxnxq.rows` |
| 学期开始日期 | `GET jshkcb/cxjcs.do` | `datas.cxjcs.rows` |
| 结构化课表 | `POST xskcb/cxxszhxqkb.do` | `datas.cxxszhxqkb.rows` |

响应 `code=0` 表示成功。课表参数为 `XNXQDM`、`pageSize`、`pageNumber`；学期列表按 `*order=-DM` 排序。URL 与响应键集中定义在 `scripts/contract.ts`。

| 字段 | 含义 |
| --- | --- |
| `DM / MC` | 学期 ID / 名称 |
| `XN / XQ / XQKSRQ` | 学年 / 学期 / 开始日期 |
| `JXBID / KCM / SKJS` | 教学班 ID / 课程名 / 教师 |
| `KSJC / JSJC / SKXQ` | 开始节次 / 结束节次 / 星期 |
| `SKZC` | 教学周位图，`1` 表示该周有课 |
| `JASMC / XXXQDM_DISPLAY` | 地点 / 校区 |

接口与响应键沿用初始提交引用的 [nju-cli/nju-cli 固定版本](https://github.com/nju-cli/nju-cli/tree/df8716a4ee202ed8f7967b3732c8b2e53c961063)；该链接目前返回 404。节次钟点参考 [nju-schedule-ics](https://github.com/SuperKenVery/nju-schedule-ics)。这些课表查询与钟点仍待南大实网逐项核对。

## 研究生选课

[官方入口](https://yjsxk.nju.edu.cn/yjsxkapp/sys/xsxkapp/course_nju.html)。以下路径相对 `https://yjsxk.nju.edu.cn/yjsxkapp/sys/xsxkapp/`。

| 动作 | 请求 | 参数或结果 |
| --- | --- | --- |
| 会话 | `GET xsxkHome/loadPublicInfo_course.do` | `loginUserId / csrfToken` |
| 方案内课程 | `POST xsxkCourse/loadFanCourseInfo.do` | `kind=plan` |
| 公选课程 | `POST xsxkCourse/loadGxkCourseInfo.do` | `kind=public` |
| 已选课程 | `GET xsxkCourse/loadStdCourseInfo.do` | 课程数组 |
| 选课 | `POST xsxkCourse/choiceCourse.do` | `bjdm / lx / csrfToken`；plan 为 `lx=2`，public 为 `lx=1` |
| 选课结果 | `POST xsxkCourse/loadXkjgRes.do` | 查询本次事务结果 |
| 退课 | `POST xsxkCourse/cancelCourse.do` | `bjdm / csrfToken`；`code=1` 成功 |

课程筛选使用 `query_*` 字段，`query_sfym=0` 只查未满课程；分页使用 `pageIndex / pageSize`。

| 字段 | 含义 |
| --- | --- |
| `BJDM / BJMC` | 教学班 ID / 名称 |
| `KCDM / KCMC` | 课程代码 / 名称 |
| `RKJS / KCKKDWMC` | 教师 / 院系 |
| `XQMC / SKYYMC` | 校区 / 授课语言 |
| `XF / PKSJDDMS` | 学分 / 时间地点 |
| `DQRS / KXRS / IS_CONFLICT` | 已选人数 / 容量 / 冲突标记 |

接口来自选课站官方前端。已验证方案内、公选课和已选课程查询；真实选课、退课待验证。
