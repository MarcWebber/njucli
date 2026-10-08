import { type SkillRuntime } from "../../../src/app/runtime.js";
import { BoxClient, BOX_URL } from "./client.js";

export type BoxServices = Omit<BoxClient, "hasSession">;

export function createBoxServices(runtime: SkillRuntime): BoxServices {
  const { withBrowser } = runtime;
  const withBox = <T>(operation: (client: BoxClient) => Promise<T>): Promise<T> => withBrowser("box", async (session) => operation(new BoxClient(session.request, await session.cookie(BOX_URL, "sfcsrftoken"))));
  return {
    info: () => withBox((client) => client.info()),
    repos: () => withBox((client) => client.repos()),
    createRepo: (name) => withBox((client) => client.createRepo(name)),
    renameRepo: (repo, name) => withBox((client) => client.renameRepo(repo, name)),
    removeRepo: (repo) => withBox((client) => client.removeRepo(repo)),
    deletedRepos: () => withBox((client) => client.deletedRepos()),
    restoreRepo: (repo) => withBox((client) => client.restoreRepo(repo)),
    list: (repo, path, recursive) => withBox((client) => client.list(repo, path, recursive)),
    scan: (repo, path) => withBox((client) => client.scan(repo, path)),
    search: (query, repo, page, pageSize) => withBox((client) => client.search(query, repo, page, pageSize)),
    detail: (repo, path) => withBox((client) => client.detail(repo, path)),
    link: (repo, path) => withBox((client) => client.link(repo, path)),
    download: (repo, path, output) => withBox((client) => client.download(repo, path, output)),
    upload: (repo, local, parent, replace) => withBox((client) => client.upload(repo, local, parent, replace)),
    mkdir: (repo, path) => withBox((client) => client.mkdir(repo, path)),
    rename: (repo, path, name) => withBox((client) => client.rename(repo, path, name)),
    remove: (repo, path) => withBox((client) => client.remove(repo, path)),
    copy: (repo, path, destRepo, dest) => withBox((client) => client.copy(repo, path, destRepo, dest)),
    move: (repo, path, destRepo, dest) => withBox((client) => client.move(repo, path, destRepo, dest)),
    shares: (repo, path, page, pageSize) => withBox((client) => client.shares(repo, path, page, pageSize)),
    share: (repo, path, options) => withBox((client) => client.share(repo, path, options)),
    unshare: (linkId) => withBox((client) => client.unshare(linkId)),
    uploadLinks: (repo, path) => withBox((client) => client.uploadLinks(repo, path)),
    uploadLink: (repo, path, options) => withBox((client) => client.uploadLink(repo, path, options)),
    revokeUploadLink: (linkId) => withBox((client) => client.revokeUploadLink(linkId)),
    starred: () => withBox((client) => client.starred()),
    star: (repo, path) => withBox((client) => client.star(repo, path)),
    unstar: (repo, path) => withBox((client) => client.unstar(repo, path)),
    lock: (repo, path) => withBox((client) => client.lock(repo, path)),
    unlock: (repo, path) => withBox((client) => client.unlock(repo, path)),
    history: (repo, page, pageSize) => withBox((client) => client.history(repo, page, pageSize)),
    trash: (repo, path, cursor) => withBox((client) => client.trash(repo, path, cursor)),
    restore: (repo, path, commitId, directory) => withBox((client) => client.restore(repo, path, commitId, directory)),
    groups: () => withBox((client) => client.groups()),
    collaborators: (repo, path, type) => withBox((client) => client.collaborators(repo, path, type)),
    shareTo: (repo, path, type, recipient, permission) => withBox((client) => client.shareTo(repo, path, type, recipient, permission)),
    unshareTo: (repo, path, type, recipient) => withBox((client) => client.unshareTo(repo, path, type, recipient)),
  };
}
