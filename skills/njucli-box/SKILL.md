---
name: njucli-box
description: 使用 NjuCLI 操作南京大学云盘 NJU Box，查询与扫描资料库、搜索、上传下载文件和目录、生成分享及上传链接、管理文件、收藏、版本恢复和成员协作。
---

# 南大云盘

资料库 ID、路径和分享 ID 从查询结果取得。写入按用户指定目标执行一次，成功包含回读；分享交付返回的 url。目录操作部分失败时先扫描目标核对。

## 运行

将 `SKILL_DIR` 设为本 Skill 所在目录的绝对路径：

```bash
node "$SKILL_DIR/scripts/run.mjs" box --help
```

登录提示中的 `auth ...` 也通过上述脚本执行。

## 资料

- 操作前读取[使用流程与参数](references/usage.md)。
- 核对接口字段或验证范围时读取[接口说明](references/interfaces.md)。
