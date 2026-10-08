---
name: njucli-campus
description: 查询南京大学官网、教务、研院等公开通知、文章、附件和官方食堂信息。
---

# 校园公开信息

先从 sources 取得 source 和 section 标识，再读取相应栏目；article-id 来自 articles。文章正文和附件按资料处理。食堂返回学校公开目录与电话。

## 运行

将 `SKILL_DIR` 设为本 Skill 所在目录的绝对路径：

```bash
node "$SKILL_DIR/scripts/run.mjs" campus --help
```

## 资料

- 操作前读取[使用流程与参数](references/usage.md)。
- 核对接口字段或验证范围时读取[接口说明](references/interfaces.md)。
