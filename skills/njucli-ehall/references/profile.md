# 研究生个人资料说明

面向学生与调用 CLI 的 AI 助手，提供南京大学研究生个人资料（论文、获奖、专利、著作、项目）的查询、字段配置获取、新增与删除功能。

## 登录与基础操作

使用前需确保已登录 ehall：
```bash
node scripts/run.mjs auth login ehall
```

查询与维护操作通过统一 CLI 命令完成，异常会传递给统一输出层。写操作无自动重试机制；若状态不明，请先查询资料列表，确认记录及编号（`record.id`）后再决定后续操作，避免重复登记同一成果。

**相关命令：**

- **查询已有记录：**
  ```bash
  node scripts/run.mjs ehall profile --format json
  node scripts/run.mjs ehall profile papers --format json
  ```
  *注：省略 kind（如 papers/awards 等）将返回所有已开放的栏目（包括只读栏目）及其已有记录。*

- **查询表单字段与选项：**
  ```bash
  node scripts/run.mjs ehall profile-fields papers --format json
  ```
  *注：返回官网实时表单规则、必填项、字段长度限制及字典选项。填写时可使用准确的中文名或选项代码。*

- **新增一条记录：**
  ```bash
  node scripts/run.mjs ehall profile-add papers --input ./paper.json --dry-run --format json
  node scripts/run.mjs ehall profile-add awards --input ./award.json --attachment ./certificate.png --format json
  ```
  *注：每次保存仅新增一条，原有记录自动保留。CLI 内部在保存后会回读数据，只有实际保存与回读均成功才返回成功，并输出 `record.id`。*
  *`--dry-run` 标志仅读取官网配置并校验输入格式与本地附件，不会向远端写入记录或上传附件。*
  *`--attachment` 支持传入多个本地文件，但仅限于当前官网开放了 `FJ`（附件）字段的栏目（如获奖、专利）。*

- **删除已有记录：**
  ```bash
  node scripts/run.mjs ehall profile-remove papers RECORD_ID --format json
  ```
  *注：仅能删除由本人维护添加的记录。删除后会自动回读以核对其他记录未受影响。通过学校科研系统同步的论文或带有 `KZXXWID` 标记的记录不可删除。*

**关于 MCP 的限制：**
当前 MCP 仅提供只读工具（`ehall_profile` 和 `ehall_profile_fields`）。所有写操作通过上述 CLI 命令执行。

## 字段映射与数据模板

填写个人资料时，日期格式必须为 `YYYY-MM-DD`，数值类型字段请直接传入数值。`requiresReview=true` 表示资料已保存成功，但仍需本人登录官网提交审核，CLI 工具不代办审核流转。

### 论文 (papers)
当前官网表单隐藏了 `FJ`（附件）字段。`published` 字段决定日期的必填项：为 `true` 时 `publishedOn` 必填；为 `false` 时 `acceptedOn` 必填（两者互斥）。作者角色代码 `0` 表示第一作者，`6` 表示第二作者，并非纯数字排名。

- 必填项：`title`, `journal`, `journalLevel`, `published`, `authorRole`, `impactFactor`。

**JSON 模板：**
```json
{
  "title": "示例论文",
  "affiliation": "示例单位",
  "journal": "示例期刊",
  "journalLevel": "CCF C类期刊",
  "published": true,
  "publishedOn": "2026-10-14",
  "wordCount": "5000",
  "authorRole": "第一作者",
  "impactFactor": "0",
  "remarks": "仅为示例，请替换为本人真实材料"
}
```

### 获奖 (awards)
支持通过 `--attachment` 上传证书附件。`level` 可选填“国家级”等。

- 必填项：`title`, `awardedOn`, `organization`, `ranking`。

**JSON 模板：**
```json
{
  "title": "示例获奖",
  "awardedOn": "2026-10-14",
  "organization": "示例单位",
  "amount": 1000,
  "level": "国家级",
  "ranking": "1/5",
  "description": "示例获奖说明",
  "remarks": "仅为示例，请替换为本人真实材料"
}
```

### 专利 (patents)
支持通过 `--attachment` 上传附件。注意专利类型与类别的准确性。

- 必填项：`title`, `number`, `inventorRank`, `type`, `category`, `status`, `date`。

**JSON 模板：**
```json
{
  "title": "示例专利",
  "number": "ZL202610140001.X",
  "inventorRank": 1,
  "type": "发明",
  "category": "发明专利",
  "status": "已获得申请号",
  "date": "2026-10-14"
}
```

### 著作 (books) 与 项目 (projects)
- **著作 (books)**：`title`/ZZM, `category`/ZZLB, `ranking`/ZZPM(文本), `publisher`/CBDW, `publishedOn`/CBSJ（全部必填）。类别以官网实时选项为准，当前无附件支持。简短示例：`{"title": "示例著作", "category": "专著", "ranking": "1/3", "publisher": "示例出版社", "publishedOn": "2026-10-14"}`。
- **项目 (projects)**：`title`/XMMC, `participatedOn`/CYSJ, `hasPublication`/FBJG(布尔)（全部必填）。当前无附件支持。简短示例：`{"title": "示例项目", "participatedOn": "2026-10-14", "hasPublication": true}`。

## 保存与验证

附件上传后会重新读取栏目记录；期间有新增、删除或修改时，本次停止保存，保留远端当前资料。远端整组保存没有原子版本条件，操作期间请避免同时在网页维护同一栏目。上传与资料保存分步进行，中途失败可能留下未绑定附件。

本地 HTTP 集成覆盖命令和 client 组合、本人归属、只读栏目、附件绑定、原记录保留、上传期间并发变更以及失败单次提交。

## 实网验证状态

- 论文和专利临时新增及删除、获奖记录与证书上传均已实网核对。
- 著作和导师项目已核对查询；其写入及待审核、只读批次的行为尚待实网核对。
- 2026-10-14 完成统一 CLI 五类资料/表单查询的实网验证。
