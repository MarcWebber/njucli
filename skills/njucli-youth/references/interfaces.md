# 青年平台接口

入口为 [青年平台](https://youth.nju.edu.cn/tw/)。认证使用共用 `youth` 会话：先访问 `/tw/`，再 POST 空表单至 `ctx`；响应 `data` 为 Base64 JSON，`anonymous=false` 表示本人已登录。

## 查询

请求路径相对 `https://youth.nju.edu.cn/tw/`。`.me` 取当前本人菜单中对应 `urlN` 的 PC 菜单 ID，再编码为 Base64。列表使用服务端返回的 `pageIndex/pageSize/count`；社团固定每页 12 条，普通列表最多每页 500 条。

| 业务 | 已确认路径（均以 `/tw/` 开头） | 方法与参数 |
| --- | --- | --- |
| 学年 | `common/selector` | GET；`clazz=Xn,valueField=id,labelField=mc`；`data[].label/value` |
| 志愿时长 | `zyz/wdhd/fwsc` | POST 空表单；查询 `xnid`，空值为全部；`extend.fwzsc/cjhds` |
| 本人活动 | `zyz/wdhd/ajaxList` | GET；`queryType=all,xmmc,xn,page,limit` |
| 活动中心 | `zyz/hdzx/ajaxList` | GET；`queryType=all/zmz/jxz/yjs,xmmc,page,limit` |
| 活动说明 | `zyz/hdzx/<id>/update` | GET；`view=true` |
| 志愿者资料 | `zyz/grzl/create` | GET；解析官网标签、表单值和正文 |
| 服务组织 | `zyz/tdzz/ajaxList`、`zyz/tdzz/<id>` | GET；列表名称筛选 `mc,mc.op=ILIKE` |
| 培训 | `zyz/pxgl/bm/ajaxList` | GET；`mc,mc.op=ILIKE`；`syzt` 为报名开放，`bmzt` 为本人报名状态 |
| 申报类别 | `xssq/xssq/ajaxList` | GET；类别标题 `bt`；`sqyq/sqks/sqjs/dqrsfksq/bksqyy/bdxList` 为要求、时间、可申报状态与表单字段 |
| 本人申请 | `xssq/wdsq/ajaxList`、`xssq/wdsq/<id>/update` | GET；列表 `queryType=all`，详情 `view=true` |
| 本人成绩单 | `xssq/zxsck/sqmx/ajaxList` | GET；`xh` 使用本次 ctx 的本人 `userId`；`mc,mc.op=ILIKE` |
| 成绩单导出 | `xssq/zxsck/sqmx/export` | GET；本人 `xh` 与空 `ids`；返回带 Content-Disposition 的 PDF |
| 青马课程 | `kcgl/xxzx/ajaxList`、`kcgl/xxzx/view`、`kcgl/cjcx/ajaxList` | GET；课程说明使用 `kcid` |
| 本人社会实践 | `shsj/wdshsj/ajaxList`、`shsj/wdshsj/<id>/update`、`shsj/rj/ajaxList` | GET；详情 `view=true` |
| 实践招募 | `shsj/sjzx/ajaxList`、`shsj/sjzx/<id>` | GET；`tdmc,xn` |
| 实践资料库 | `shsj/sjzlk/ajaxList`、`shsj/sjzlk/<id>/update` | GET；`tdmc,tdmc.op=ILIKE,sz.xn.id,sz.xn.id.op=EQ`；详情 `view=true` |
| 社团 | `st/qxstqk/loadData`、`st/qxstqk/view` | 列表 POST 表单 `tab=all/mine,lb,xj,dw,page,limit`；详情 GET `id` |
| 岗位 | `sxgw/gwzx/ajaxList`、`sxgw/wdgw/ajaxList` | GET；`queryType=all,mc`，后者为本人记录 |
| 骨干招募 | `xsgb/zmzx/ajaxList`、`xsgb/wdbm/ajaxList` | GET；`queryType=all`，后者为本人记录 |
| 票务 | `dzp/pwzx/ajaxList`、`dzp/wdpq/ajaxList` | GET；`queryType=all,mc`，后者为本人票券 |
| 实践评选 | `shsj/yxtd/ajaxList`、`shsj/yxbg/ajaxList`、`shsj/yxxs/ajaxList`、`shsj/yxzdls/ajaxList` | GET；依次为团队、报告、学生、指导教师 |
| 志愿者评选、科创、投诉 | `zyzpy/grsq/ajaxList`、`kcss/sb/ajaxList`、`zyz/wqts/ajaxList` | GET；本人可见申报与投诉记录 |

本人活动的行 `id` 是报名记录 ID，`hd.id` 是活动 ID。`shzt.label` 为审核状态；`fwzsc/fwsc/jtsc/pxsc` 分别为总、服务、交通和培训时长，仅 `hd.currentState.id=99` 时返回已认定时长。总时长采用官方加权结果，学年和状态允许为空。

## 写入

下列请求使用表单 POST，提交后按稳定 ID 回读：

| 操作 | 路径与参数 | 完成结果 |
| --- | --- | --- |
| 报名活动 | `zyz/hdzx/bm?hdid=<活动ID>&mm=<可选密码>`；`bhdrs/zwys/qq` | 本人活动中出现目标 `hd.id` |
| 取消报名 | `zyz/wdhd/qxbm?id=<报名记录ID>`；空表单 | 本人活动中该报名记录消失 |
| 活动评价 | `zyz/wdhd/hdpj`；`id/pjxj/pj` | 对应记录的星级与文字一致 |
| 报名/取消培训 | `zyz/pxgl/bm/saveBm`、`zyz/pxgl/bm/qxBm`；`id` | 对应培训的 `bmzt` 与本次操作一致 |

## 验证范围

已用编译 CLI 核对各列表查询，以及活动、组织、实践团队、资料和社团详情；本人志愿时长与活动记录一致。成绩单 PDF 已下载并核对可打开及本人字段。部分模块在研究生账号下返回空列表。

报名、取消、评价和培训写入已通过本地集成，尚未实网验收。本地用例覆盖会话请求顺序、菜单隔离、空字段、分页、筛选、单次提交、跨页回读和文件保存。只读 MCP 提供 31 个青年平台查询工具。
