# 南大云盘

用于 `box.nju.edu.cn` 的日常文件任务。需要 Node.js 20+、本机 Google Chrome 和本 Skill 的运行依赖。命令为 `node "$SKILL_DIR/scripts/run.mjs" box`，也可使用 `node "$SKILL_DIR/scripts/run.mjs" njubox`。账号通过 `account use` 或 `NJUCLI_ACCOUNT` 选择，Cookie 保存在当前账号目录。

业务命令先检查云盘会话。已有 `auth.json` 时自动填写官网的统一身份认证账号和密码；首次保存凭据可运行 `node "$SKILL_DIR/scripts/run.mjs" auth login box --credentials ./auth-credentials.json`。登录细节见[认证 Skill](https://github.com/MarcWebber/njucli/blob/main/skills/njucli-auth/SKILL.md)。以新进程 `node "$SKILL_DIR/scripts/run.mjs" auth status box --format json` 返回 `valid` 为成功。

## 查找与扫描

```bash
node "$SKILL_DIR/scripts/run.mjs" box info --format json
node "$SKILL_DIR/scripts/run.mjs" box repos --format json
node "$SKILL_DIR/scripts/run.mjs" box list <repo-id> / --format json
node "$SKILL_DIR/scripts/run.mjs" box scan --format json
node "$SKILL_DIR/scripts/run.mjs" box scan <repo-id> --path /课程 --format json
node "$SKILL_DIR/scripts/run.mjs" box search "关键词" --repo <repo-id> --page 1 --page-size 25 --format json
node "$SKILL_DIR/scripts/run.mjs" box detail <repo-id> /课程/资料.pdf --format json
node "$SKILL_DIR/scripts/run.mjs" box link <repo-id> /课程/资料.pdf --format json
```

`repo-id` 来自 `repos` 的 `id`；路径来自 `list`、`scan` 或 `search`。路径从 `/` 开始。`scan` 返回 `entries/files/directories/bytes/skipped`，逐项包含所属资料库和完整路径。全盘扫描覆盖普通资料库，加密资料库在 `skipped` 中列明。搜索使用学校的文件名和内容索引，索引更新时间由学校决定。内部 `link` 供具备访问权限的账号预览和在线编辑。

## 上传下载

```bash
node "$SKILL_DIR/scripts/run.mjs" box upload <repo-id> ./资料.pdf --parent /课程 --format json
node "$SKILL_DIR/scripts/run.mjs" box upload <repo-id> ./课程目录 --parent / --format json
node "$SKILL_DIR/scripts/run.mjs" box upload <repo-id> ./资料.pdf --parent /课程 --replace --format json
node "$SKILL_DIR/scripts/run.mjs" box download <repo-id> /课程/资料.pdf --output ./资料.pdf --format json
node "$SKILL_DIR/scripts/run.mjs" box download <repo-id> /课程 --output ./课程备份 --format json
```

上传目录保留本地目录名和子目录结构。默认同名处理采用学校自动改名，用户明确要求替换时使用 `--replace`。上传每个文件一次，核对返回的文件标识、大小及下载字节后成功；返回实际保存路径。下载文件覆盖指定输出文件，下载目录保持树形结构并覆盖相应文件，新文件权限为 0600。目录操作逐文件进行，失败时先扫描目标，依据已完成部分决定下一步。

## 分享链接

```bash
node "$SKILL_DIR/scripts/run.mjs" box share <repo-id> /课程/资料.pdf --expire-days 7 --format json
node "$SKILL_DIR/scripts/run.mjs" box share <repo-id> /课程 --password "用户指定密码" --expire-days 7 --format json
node "$SKILL_DIR/scripts/run.mjs" box share <repo-id> /课程/资料.pdf --preview-only --format json
node "$SKILL_DIR/scripts/run.mjs" box shares <repo-id> --path /课程 --page 1 --format json
node "$SKILL_DIR/scripts/run.mjs" box unshare <link-id> --format json
node "$SKILL_DIR/scripts/run.mjs" box upload-link <repo-id> /收集目录 --expire-days 7 --format json
node "$SKILL_DIR/scripts/run.mjs" box upload-links <repo-id> --format json
node "$SKILL_DIR/scripts/run.mjs" box revoke-upload-link <link-id> --format json
```

`share` 提交一次后回读目标，结果包含 `url`、`id`、`repoId`、`path`、`expires`、`protected` 和权限。把返回的 `url` 用 Markdown 链接交给用户，密码来自用户输入，单独告知用户指定的密码。`--preview-only` 关闭分享链接下载权限。`upload-link` 返回用于收集他人文件的链接。有效期省略时采用学校设置；密码长度与强度由学校校验。撤销所需 `link-id` 来自对应结果的 `id`，与资料库 ID 分开使用。

## 管理与协作

```bash
node "$SKILL_DIR/scripts/run.mjs" box create-repo "资料库名称" --format json
node "$SKILL_DIR/scripts/run.mjs" box rename-repo <repo-id> "新名称" --format json
node "$SKILL_DIR/scripts/run.mjs" box mkdir <repo-id> /课程/资料 --format json
node "$SKILL_DIR/scripts/run.mjs" box rename <repo-id> /课程/资料.pdf 新名称.pdf --format json
node "$SKILL_DIR/scripts/run.mjs" box copy <repo-id> /课程 <destination-repo> /备份 --format json
node "$SKILL_DIR/scripts/run.mjs" box move <repo-id> /课程 <destination-repo> /归档 --format json
node "$SKILL_DIR/scripts/run.mjs" box star <repo-id> /课程/资料.pdf --format json
node "$SKILL_DIR/scripts/run.mjs" box starred --format json
node "$SKILL_DIR/scripts/run.mjs" box unstar <repo-id> /课程/资料.pdf --format json
node "$SKILL_DIR/scripts/run.mjs" box lock <repo-id> /课程/资料.pdf --format json
node "$SKILL_DIR/scripts/run.mjs" box unlock <repo-id> /课程/资料.pdf --format json
node "$SKILL_DIR/scripts/run.mjs" box history <repo-id> --page 1 --format json
node "$SKILL_DIR/scripts/run.mjs" box trash <repo-id> --format json
node "$SKILL_DIR/scripts/run.mjs" box restore <repo-id> /资料.pdf <commit-id> --format json
node "$SKILL_DIR/scripts/run.mjs" box restore <repo-id> /课程 <commit-id> --directory --format json
node "$SKILL_DIR/scripts/run.mjs" box deleted-repos --format json
node "$SKILL_DIR/scripts/run.mjs" box restore-repo <repo-id> --format json
node "$SKILL_DIR/scripts/run.mjs" box groups --format json
node "$SKILL_DIR/scripts/run.mjs" box collaborators <repo-id> --path /课程 --type user --format json
node "$SKILL_DIR/scripts/run.mjs" box share-to <repo-id> /课程 <recipient> --type user --permission r --format json
node "$SKILL_DIR/scripts/run.mjs" box share-to <repo-id> /课程 <group-id> --type group --permission rw --format json
node "$SKILL_DIR/scripts/run.mjs" box unshare-to <repo-id> /课程 <recipient> --type user --format json
node "$SKILL_DIR/scripts/run.mjs" box remove <repo-id> /指定文件.pdf --format json
node "$SKILL_DIR/scripts/run.mjs" box remove-repo <repo-id> --format json
```

复制移动的目标参数是已存在目录，目标同名时先由用户确定新名称或位置。跨资料库操作等待官方任务结束后核对目标；移动同时核对来源。`commit-id` 从 `history` 或 `trash` 取得，回收站分页把返回的 `cursor` 传入下一次 `--cursor`。恢复可能替换当前版本，按用户指定的路径与版本办理。成员共享对象使用站内账号标识；群组 ID 来自 `groups`，权限 `r` 为只读、`rw` 为读写。各项权限以学校和当前账号为准。

写操作按用户指定的资料库、路径、文件和对象执行，个人账号开发验收使用另行授权的专用目标。遇到提交或回读失败，先查目标和链接记录，再决定后续动作。账号凭据、Cookie、个人文件和链接密码保存在本地指定位置。只读 MCP 提供查询，上传下载与远端写入由具备终端能力的 AI 调用同一 CLI。
