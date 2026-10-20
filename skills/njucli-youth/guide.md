# 青年平台

首次使用需登录：`njucli auth login youth`。

## 志愿时长与活动

```bash
njucli youth years --format json
njucli youth hours --format json
njucli youth hours --year YEAR_ID --format json
njucli youth activities --mine --format json
njucli youth activities "校园" --state recruiting --page 1 --size 20 --format json
njucli youth activity ACTIVITY_ID --format json
```

`YEAR_ID` 来自 `years`。`hours` 查询官方加权时长，省略学年时查询全部；活动的 `hours` 为 `null` 表示尚未认定。

`activities --mine` 查看本人已报名的活动列表，结果中包含 `registrationId`。
`activities [关键词]` 搜索活动，`--state` 可选 `recruiting`（招募中，默认）、`ongoing`、`ended`、`all`。列表用 `--page`、`--size` 翻页，以返回的 `page/size/total` 判断是否读完。
`activity` 查看活动详情，`ACTIVITY_ID` 取自活动列表中的 `id`。

## 报名、取消与评价

```bash
njucli youth enroll ACTIVITY_ID --understanding "活动认识" --strengths "个人优势" --qq 12345678 --format json
njucli youth cancel REGISTRATION_ID --format json
njucli youth rate REGISTRATION_ID --stars 5 --comment "评价内容" --format json
njucli youth training-enroll TRAINING_ID --format json
njucli youth training-cancel TRAINING_ID --format json
```

报名须向用户收齐活动认识、个人优势及 QQ 后再提交；若活动设置了密码，须传 `--password`。
取消和评价使用本人活动列表中的 `registrationId`。
培训报名和取消使用 `training-enroll / training-cancel`，`TRAINING_ID` 取自 `youth trainings`。

提交结果不明时，活动报名或取消查 `activities --mine`，培训报名或取消查 `trainings` 的 `bmzt`；评价到官方页面核对。确认状态后再决定后续操作。

## 第二课堂成绩单与其他查询

```bash
njucli youth transcript --format json
njucli youth transcript-export --output ./transcript.pdf --format json
```

其他常用查询接在 `njucli` 后：

- 社团信息：`youth clubs [--mine]`、`youth club ID`（每页固定 12 条）
- 社会实践：`youth practices`、`youth practice-teams`
- 青马工程：`youth courses`、`youth course-grades`
- 票务活动：`youth tickets [--mine]`
- 组织与培训：`youth teams`、`youth trainings`

部分模块对研究生账号返回空列表。更多查询见 `njucli youth --help`，接口字段见[接口说明](references/interfaces.md)。
