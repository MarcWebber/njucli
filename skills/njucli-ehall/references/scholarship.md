# 研究生奖学金

## 查询与填写

通过 `NJUCLI_ACCOUNT` 选择账号；应用从当前会话读取学号。

```bash
njucli ehall scholarship list --format json
njucli ehall scholarship show 奖种编号 --format json
njucli ehall scholarship form 奖种编号 --category 3 --format json
njucli ehall scholarship applications --format json
njucli ehall scholarship application 申请编号 --format json
```

`list` 和 `applications` 支持 `--page`、`--page-size`。奖种编号来自 `list` 的 `awardId`，等级编号来自 `show` 的 `levels[].levelId`，申请编号来自 `applications` 的 `applicationId`。`form` 返回指定分类的开放批次、填写模板及长度限制，等级有多个时需选择其中之一。分类代码沿用官网的 1 至 6；学校奖入口使用 3，学业奖学金入口使用 5。具体可申请奖种以当前账号查询结果为准。

大厅通用 `ehall applications` 与奖学金列表是两套业务。确认奖学金进度用 `scholarship applications`；通用列表为空不能判断奖学金未提交。状态显示采用远端原文，“待辅导员审核”表示仍在审核。专用列表为空表示当前账号本次查询未查到记录，继续核对账号和分页。

## 保存草稿

将需要填写的内容写入本地 JSON。新建示例：

```json
{
  "awardId": "从 list 取得",
  "levelId": "从 show 取得",
  "category": "3",
  "reason": "本人在读期间的学习与科研成果，以及申请本奖学金的理由。",
  "practice": "活动时间、实践或公益内容。",
  "attachments": ["/绝对路径/佐证材料.pdf"]
}
```

修改已有草稿时，使用 `applicationId`，省略奖种、等级和分类；只填写需要修改的内容：

```json
{"applicationId":"从 applications 取得","reason":"修改后的申请理由"}
```

```bash
njucli ehall scholarship save --input ./draft.json --dry-run --format json
njucli ehall scholarship save --input ./draft.json --format json
```

`--dry-run` 读取账号、奖种及申请数据，检查本地附件并返回预览，不创建草稿编号、不上传附件、不保存。保存完成后回读目标记录、草稿状态、奖种批次和全部保存字段，返回 `reviewUrl` 官网核对链接、申请编号和 `nextStep` 操作提示。向用户提供链接及申请内容，并询问是否提交；收到用户对该申请的明确同意后，执行下方提交命令。写入结果不明时先查询申请，不自动重试。

| 输入字段 | 含义 |
| --- | --- |
| `reason` | 申请理由；普通表单最多 1000 字，动态表单最多 600 字 |
| `practice` | 社会实践与公益活动，最多 100 字 |
| `research` | 预期科研创新突破说明，最多 1000 字 |
| `phone`、`contactPhone`、`email` | 申请记录中的手机、联系电话和邮箱；新建默认读取当前账号资料 |
| `attachments` | 本地佐证材料路径，最多 3 个文件，每个非空且不超过 5MB |

这些联系方式写入申请记录。论文、专利、获奖等个人成果由官网“我的个人信息”或相应个人信息命令维护，确认后再用于奖学金申请；CLI 不虚构或代填成果。

已有附件会随草稿内容保留。当前附件上传用于新建或尚无附件的草稿；已有附件的替换、删除在官网办理。支持 doc、docx、jpg、jpeg、png、bmp、zip、rar、pdf、xls、xlsx、txt。上传和草稿保存是分步操作，中途失败可能留下未绑定文件；检查结果后再处理。

CLI 提供个人奖学金草稿保存与确认后提交；撤回、删除及其他流程操作通过官网办理。只修改 `SHZT=0` 的本人草稿；进入审核的记录会被拒绝。输入不接受 `TYPE`、`SHZT`、`XSBH`、原始 `INDATA` 等远端控制字段。团体奖项及本说明未覆盖的动态栏目使用[官方入口](https://ehall.nju.edu.cn/appShow?appId=5907343959144076)填写。

## 确认后提交

```bash
njucli ehall scholarship submit 申请编号 --format json
njucli ehall scholarship submit 申请编号 --dry-run --format json
# 向用户展示预览和 reviewUrl，询问是否提交；收到明确同意后执行：
njucli ehall scholarship submit 申请编号 --yes --format json
```

默认返回本人申请的奖种、学年、等级、金额、理由、附件、当前状态及 `reviewUrl`。`--dry-run` 优先采用预览模式。先向用户提供官网核对链接并询问是否提交，收到针对这份申请的明确同意后使用 `--yes`；通用“帮我申请”请求先进入草稿准备和确认流程。MCP `ehall_scholarship_submit` 对应参数为 `applicationId` 与 `confirmed`（默认 `false`）。

正式提交接受本人 `SHZT=0` 的草稿，复用已保存的内容和附件。提交前核对身份及草稿状态；内容变化后重新预览并取得确认。成功结果包含目标申请的回读状态及官网链接。处理结果待确认时，先通过 `applications` 或 `application` 查询对应编号，再决定后续操作。

## 接口契约

业务根路径：`https://ehallapp.nju.edu.cn/xxfw/sys/yjsjxjappnju`。通过官方 `appShow` 入口获取页面 `pageMeta.params.USERID`；同次调用复用 `ehall` 会话。以下查询均为 POST：

| 接口 | 用途与参数 |
| --- | --- |
| `modules/apply/xsdcxjzxx2.do` | 奖种列表；`XSBH/XSBH1/XSBH2/XSBH3`、`TJ1/TJ2/TJ3=3`、空 `FHTJ`、分页 |
| `modules/apply/cxxsysqjxjjl.do` | 本人申请；`XSBH`、`pageNumber/pageSize`；数据在 `datas.cxxsysqjxjjl` |
| `commoncall/callQuery/<action>-<type>-QUERY.do` | `requestParams` 为 JSON，`actionType` 为 `MINE` 或 `DATAMODEL`，`actionName`、`dataModelAction=QUERY`；成功 `resultCode=00000` |
| `T_JXJ_ZL`、`cxjxjdj` | 奖种与等级，条件 `JXJDM` |
| `cxpcdydjxlxxx2` | 指定 `FLDM` 分类、`JXJDM` 的开放批次 |
| `T_JXJ_PDXX` | 申请详情，条件 `WID`；先从本人列表定位，再核对记录 `XSBH` |
| `modules/apply/wysqjbxxbd.do` | 新申请联系方式，条件 `XSBH` |
| `modules/scholarShipApply/studentCanApply.do` | 资格检查，当前学号、批次、奖种、等级 |
| `zdscwid` | 实际新建草稿时生成编号；预览不调用 |

列表成功为 `code="0"`；分页返回 `totalSize/rows`。审核字段是 `SHZT/SHZT_DISPLAY`，申请时间 `SQRQ`，退回原因 `THYY`。输出只选择业务字段，完整响应中的 `BBTOKEN` 等票据不进入 CLI 输出或文档。

保存接口为 `modules/scholarShipApply/Applyjxj.do`。官网 `wysq.js` 的 `FormSave` 使用 `ACTIONTYPE=ADD`，`wysq_edit.js` 的 `Save` 使用 `ACTIONTYPE=MODIFY`；两者均为 `MODE=T_JXJ_PDXX`、`TYPE=0`，`INDATA` 是申请 JSON。正式提交使用同一路径，固定 `ACTIONTYPE=MODIFY`、`TYPE=1`，针对已有草稿；保存继续使用 `TYPE=0`。资格检查采用表单字段 `requestParamStr=JSON.stringify(params)`；保存采用表单字段 `data=JSON.stringify({INDATA,MODE,ACTIONTYPE,TYPE})`，其中 `INDATA` 再序列化为 JSON 字符串。两者不能混用。成功须满足 `returnCode=#E000000000000`、`data.flag=1`，保存后回读草稿状态；提交后核对列表与详情中的一致审核状态及草稿到审核流程的转换，两种操作均核对目标记录和保留字段。

附件沿用官网 emap 上传组件：`/xxfw/sys/emapcomponent/file/uploadTempFile.do`，multipart 字段 `bhFile/scope/fileToken/size/type/storeId/isSingle/fileName`；随后 `saveAttachment/<scope>/<token>.do`，携带 `attachmentParam=JSON.stringify({storeId:"file",orderMap})`，`orderMap` 按上传响应中的文件 `id` 记录顺序。缺少该参数时服务端可能返回 `success=true` 但提示未检测到附件保存信息，因此必须回读。通过 `getUploadedAttachment/<token>.do` 回读核对文件名、大小和数量后，把 token 绑定至申请的 `FJ`。动态表单使用官网权限参数 `authAppName=jxjapp`、`authBeanName=jxjFileOpAuthManager`。

## 验证范围

2026-10-15 已核对官网前端保存/提交区别、参数编码、身份来源、字段及附件组件契约。实网验证覆盖两个账号的申请列表、奖种等级、申请详情、填写模板及只读预览。随后使用已准备好的真实材料完成个人奖学金草稿新建、3 个 PDF 上传及绑定；独立回读确认状态仍为草稿、陈述与实践内容一致、附件文件名及数量一致。

新建草稿与首次附件写入已实网验证；修改已有草稿的写入待实际业务核对。接口未提供原子状态条件，保存时避免同时在网页修改或提交同一申请。

提交功能的构建与真实预览结果见[提交验证报告](validation/scholarship-submit.md)。
