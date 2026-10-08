# 研究生教务接口

## 研究生教务

应用由 [EHall 服务目录](https://ehall.nju.edu.cn/) 进入。请求前访问对应 `appShow?appId=...` 和应用首页，以下根路径均位于 `https://ehallapp.nju.edu.cn/gsapp/sys/`。

| 能力 | appId | 根路径 |
| --- | --- | --- |
| 成绩 | `5094115980385668` | `wdcjapp/` |
| 考试 | `5051542166524964` | `wdksapp/` |
| 课表 | `4979568947762216` | `wdkbapp/` |
| 培养方案 | `5006012186614764` | `wdpyfaapp/` |

### 成绩与考试

| 方法 | 相对应用根路径 | 用途 |
| --- | --- | --- |
| POST | `modules/wdcj/xscjcx.do` | 成绩 |
| GET | `modules/ksxxck/getXnxqList.do` | 考试学期 |
| POST | `modules/ksxxck/wdksxxcx.do` | 考试安排 |
| POST | `modules/ksxxck/wdkckcxxcx.do` | 考查安排 |

成绩映射 `XNXQDM_DISPLAY/KCDM/KCMC/KCLBMC/XF/CJXSZ/SFJG`。考试按学期、当前学号和 `SFFBKSAP=1` 查询；考试与考查分别使用 `KSAPWID` 非空和为空条件。

### 课表与培养方案

| 方法 | 相对应用根路径 | 用途 |
| --- | --- | --- |
| POST | `modules/xskcb/kfdxnxqcx.do` | 可查课表学期 |
| GET | `wdkcb/initXsxx.do?XH=` | 当前学号，供考试与培养方案查询 |
| POST | `modules/xskcb/xspkjgcx.do` | 课表，参数 `XNXQDM/XH` |
| POST | `modules/pyfaxq/gjxhcxdyfadm.do` | 由学号取得 `FADM` |
| POST | `modules/pyfaxq/facx.do` | 方案详情 |
| POST | `modules/pyfaxq/wdFacxPyfakclbxfyqcx.do` | 分类学分要求 |
| POST | `modules/pyfaxq/pyfakcxxcx.do` | 方案课程 |

课表使用 `KCDM/KCMC/BJMC/JSXM/XQ/KSJCDM/PKSJDD/JASMC/XQDM_DISPLAY`，保留学校返回的节次和地点。培养方案学分要求取响应首项的 `falxdykclbxfyqResults`，字段为 `KCLBDM_DISPLAY/ZDXF/ZGXF`；其余列表取 `datas.<action>.rows`。

验证范围：已核对官方页面和登录后的查询接口；完整 CLI 实网结果待核对。
