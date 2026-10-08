---
name: njucli-tex
description: 使用本机 NjuCLI 管理南京大学 TeXPage 项目，协助学生撰写和修改 LaTeX 论文、上传插图与参考文献、编译并读取错误日志。用户涉及 tex.nju.edu.cn 或希望将论文保存到南大 TeX 平台时使用。
---

# TeX 写作

使用可见 Chrome 完成正文编辑、上传和编译。项目与版本标识从查询取得，正文先读后改；编译成功后核对本次 PDF。

## 运行

将 `SKILL_DIR` 设为本 Skill 所在目录的绝对路径：

```bash
node "$SKILL_DIR/scripts/run.mjs" tex --help
```

登录提示中的 `auth ...` 也通过上述脚本执行。

## 资料

- 操作前读取[使用流程与参数](references/usage.md)。
- 核对接口字段或验证范围时读取[接口说明](references/interfaces.md)。
