import { Option, type Command } from "commander";
import type { BoxServices } from './services.js';
import { BOX_SHARE_TYPES, BOX_PERMISSIONS, type BoxShareType, type BoxPermission } from './client.js';
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../../../src/core/command.js";
import { optionalPositiveInteger } from "../../../src/core/options.js";

type Options = FormatOptions & {
  path?: string; repo?: string; page?: string; pageSize?: string; cursor?: string;
  output?: string; parent?: string; replace?: boolean; directory?: boolean;
  password?: string; expireDays?: string; previewOnly?: boolean;
  type?: BoxShareType; permission?: BoxPermission;
};

export function registerBoxCommands(program: Command, service: BoxServices, runtime: CommandRuntime): Command {
  const box = program.command("box").alias("njubox").description("使用南大云盘：文件、资料库、分享与协作");
  const run = (options: Options, action: () => Promise<unknown>) => runCommand(runtime, options, async () => {
    const data = await action();
    return { data, text: boxText(data) };
  });
  const pages = (command: Command) => command.option("--page <page>", "页码，从 1 开始").option("--page-size <count>", "每页条数，默认 25");
  const page = (o: Options) => optionalPositiveInteger(o.page, "--page");
  const pageSize = (o: Options) => optionalPositiveInteger(o.pageSize, "--page-size");
  const links = (command: Command) => command.option("--password <password>", "链接访问密码")
    .option("--expire-days <days>", "链接有效天数，省略采用学校设置");
  const linkOptions = (o: Options) => ({ password: o.password, expireDays: optionalPositiveInteger(o.expireDays, "--expire-days"), previewOnly: o.previewOnly });
  const recipients = (command: Command) => command.addOption(new Option("--type <type>", "共享对象类型").choices(BOX_SHARE_TYPES).default("user"));

  addFormatOption(box.command("info").description("查看云盘账号与存储用量"))
    .action((o: Options) => run(o, () => service.info()));
  addFormatOption(box.command("repos").description("列出本人、共享及群组资料库"))
    .action((o: Options) => run(o, () => service.repos()));
  addFormatOption(box.command("create-repo <name>").description("创建资料库并回读"))
    .action((name: string, o: Options) => run(o, () => service.createRepo(name)));
  addFormatOption(box.command("rename-repo <repo-id> <name>").description("重命名资料库并回读"))
    .action((repo: string, name: string, o: Options) => run(o, () => service.renameRepo(repo, name)));
  addFormatOption(box.command("remove-repo <repo-id>").description("删除指定资料库并核对"))
    .action((repo: string, o: Options) => run(o, () => service.removeRepo(repo)));
  addFormatOption(box.command("deleted-repos").description("列出可恢复的已删除资料库"))
    .action((o: Options) => run(o, () => service.deletedRepos()));
  addFormatOption(box.command("restore-repo <repo-id>").description("恢复已删除资料库并回读"))
    .action((repo: string, o: Options) => run(o, () => service.restoreRepo(repo)));

  addFormatOption(box.command("list <repo-id> [path]").description("列出目录内容，默认根目录"))
    .action((repo: string, path: string | undefined, o: Options) => run(o, () => service.list(repo, path)));
  addFormatOption(box.command("scan [repo-id]").description("递归扫描资料库；省略标识时扫描全部普通资料库").option("--path <path>", "扫描起始目录，默认 /"))
    .action((repo: string | undefined, o: Options) => run(o, () => service.scan(repo, o.path)));
  addFormatOption(pages(box.command("search <query>").description("搜索文件名与内容").option("--repo <repo-id>", "限定资料库")))
    .action((query: string, o: Options) => run(o, () => service.search(query, o.repo, page(o), pageSize(o))));
  addFormatOption(box.command("detail <repo-id> <path>").description("查看文件或目录标识、大小、权限与锁定状态"))
    .action((repo: string, path: string, o: Options) => run(o, () => service.detail(repo, path)));
  addFormatOption(box.command("link <repo-id> <path>").description("获取官方内部链接，用于预览与在线编辑"))
    .action((repo: string, path: string, o: Options) => run(o, () => service.link(repo, path)));
  addFormatOption(box.command("download <repo-id> <path>").description("下载文件或递归下载目录，覆盖指定本地文件").requiredOption("--output <path>", "本地文件或目录"))
    .action((repo: string, path: string, o: Options) => run(o, () => service.download(repo, path, o.output!)));
  addFormatOption(box.command("upload <repo-id> <local-path>").description("上传文件或目录并逐文件核对字节").option("--parent <path>", "云盘目标目录，默认 /").option("--replace", "替换同名文件；默认采用学校的同名自动改名"))
    .action((repo: string, local: string, o: Options) => run(o, () => service.upload(repo, local, o.parent, o.replace)));
  addFormatOption(box.command("mkdir <repo-id> <path>").description("创建目录及父目录并回读"))
    .action((repo: string, path: string, o: Options) => run(o, () => service.mkdir(repo, path)));
  addFormatOption(box.command("rename <repo-id> <path> <name>").description("重命名文件或目录并回读"))
    .action((repo: string, path: string, name: string, o: Options) => run(o, () => service.rename(repo, path, name)));
  addFormatOption(box.command("remove <repo-id> <path>").description("删除指定文件或目录并核对"))
    .action((repo: string, path: string, o: Options) => run(o, () => service.remove(repo, path)));
  addFormatOption(box.command("copy <repo-id> <path> <destination-repo> <destination-dir>").description("复制文件或目录，等待完成后回读"))
    .action((repo: string, path: string, destRepo: string, dest: string, o: Options) => run(o, () => service.copy(repo, path, destRepo, dest)));
  addFormatOption(box.command("move <repo-id> <path> <destination-repo> <destination-dir>").description("移动文件或目录，核对目标和来源"))
    .action((repo: string, path: string, destRepo: string, dest: string, o: Options) => run(o, () => service.move(repo, path, destRepo, dest)));

  addFormatOption(pages(box.command("shares [repo-id]").description("列出分享链接及撤销所需的 id").option("--path <path>", "限定文件或目录")))
    .action((repo: string | undefined, o: Options) => run(o, () => service.shares(repo, o.path, page(o), pageSize(o))));
  addFormatOption(links(box.command("share <repo-id> <path>").description("创建文件或目录分享链接并回读").option("--preview-only", "仅预览，关闭下载权限")))
    .action((repo: string, path: string, o: Options) => run(o, () => service.share(repo, path, linkOptions(o))));
  addFormatOption(box.command("unshare <link-id>").description("撤销分享链接并核对"))
    .action((link: string, o: Options) => run(o, () => service.unshare(link)));
  addFormatOption(box.command("upload-links [repo-id]").description("列出收集文件的上传链接").option("--path <path>", "限定目录"))
    .action((repo: string | undefined, o: Options) => run(o, () => service.uploadLinks(repo, o.path)));
  addFormatOption(links(box.command("upload-link <repo-id> <path>").description("为目录创建收集文件的上传链接并回读")))
    .action((repo: string, path: string, o: Options) => run(o, () => service.uploadLink(repo, path, linkOptions(o))));
  addFormatOption(box.command("revoke-upload-link <link-id>").description("撤销上传链接并核对"))
    .action((link: string, o: Options) => run(o, () => service.revokeUploadLink(link)));

  addFormatOption(box.command("starred").description("列出收藏的文件和目录"))
    .action((o: Options) => run(o, () => service.starred()));
  addFormatOption(box.command("star <repo-id> <path>").description("收藏文件或目录并回读"))
    .action((repo: string, path: string, o: Options) => run(o, () => service.star(repo, path)));
  addFormatOption(box.command("unstar <repo-id> <path>").description("取消收藏并回读"))
    .action((repo: string, path: string, o: Options) => run(o, () => service.unstar(repo, path)));
  addFormatOption(box.command("lock <repo-id> <path>").description("锁定文件并核对"))
    .action((repo: string, path: string, o: Options) => run(o, () => service.lock(repo, path)));
  addFormatOption(box.command("unlock <repo-id> <path>").description("解除文件锁定并核对"))
    .action((repo: string, path: string, o: Options) => run(o, () => service.unlock(repo, path)));
  addFormatOption(pages(box.command("history <repo-id>").description("分页查询资料库版本历史")))
    .action((repo: string, o: Options) => run(o, () => service.history(repo, page(o), pageSize(o))));
  addFormatOption(box.command("trash <repo-id>").description("查看回收站，返回恢复所需的路径与 commitId").option("--path <path>", "回收站目录，默认 /").option("--cursor <cursor>", "上一页返回的 cursor"))
    .action((repo: string, o: Options) => run(o, () => service.trash(repo, o.path, o.cursor)));
  addFormatOption(box.command("restore <repo-id> <path> <commit-id>").description("从指定版本恢复文件或目录并回读").option("--directory", "恢复目录"))
    .action((repo: string, path: string, commit: string, o: Options) => run(o, () => service.restore(repo, path, commit, o.directory)));
  addFormatOption(box.command("groups").description("列出可共享的群组标识"))
    .action((o: Options) => run(o, () => service.groups()));
  addFormatOption(recipients(box.command("collaborators <repo-id>").description("查询资料库或目录的协作权限").option("--path <path>", "共享目录，默认 /")))
    .action((repo: string, o: Options) => run(o, () => service.collaborators(repo, o.path, o.type)));
  addFormatOption(recipients(box.command("share-to <repo-id> <path> <recipient>").description("共享目录或资料库给指定账号或群组并核对")
    .addOption(new Option("--permission <permission>", "r 为只读，rw 为读写").choices(BOX_PERMISSIONS).default("r"))))
    .action((repo: string, path: string, recipient: string, o: Options) => run(o, () => service.shareTo(repo, path, o.type!, recipient, o.permission)));
  addFormatOption(recipients(box.command("unshare-to <repo-id> <path> <recipient>").description("撤销指定账号或群组的共享权限并核对")))
    .action((repo: string, path: string, recipient: string, o: Options) => run(o, () => service.unshareTo(repo, path, o.type!, recipient)));
  return box;
}

function boxText(data: unknown): string {
  if (Array.isArray(data)) return data.length ? data.map(boxText).join("\n") : "共 0 项";
  if (data && typeof data === "object") {
    const row = data as Record<string, unknown>;
    if (row.url) return `${row.url}\n${row.id ? `id: ${row.id}\n` : ""}${row.path ?? ""}`.trim();
    if (row.entries) return `${boxText(row.entries)}\n${JSON.stringify(Object.fromEntries(Object.entries(row).filter(([key]) => key !== "entries")))}`;
    if (row.path || row.name || row.repo_name) return Object.entries(row).filter(([, value]) => value !== undefined).map(([key, value]) => `${key}: ${value}`).join("\t");
  }
  return JSON.stringify(data, null, 2);
}
