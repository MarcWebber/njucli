import { type SkillRuntime } from "../../../src/app/runtime.js";
import type { BrowserSession } from "../../../src/auth/browser-session.js";
import { TexClient } from "./client.js";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { saveFile } from "../../../src/core/fs.js";
import { compileTexFile, uploadTexFile, writeTexFile } from "./editor.js";

export type TexServices = Pick<TexClient, "templates" | "projects" | "create" | "createFromTemplate" | "rename" | "log" | "files" | "read"> & {
  download(projectKey: string, versionNo: string, path: string): ReturnType<typeof saveFile>;
  pdf(projectKey: string, versionNo: string, output: string): ReturnType<typeof saveFile>;
  compile(projectKey: string, versionNo: string, path: string, output: string): ReturnType<typeof saveFile>;
  write(projectKey: string, versionNo: string, path: string, inputLocalPath: string): ReturnType<typeof writeTexFile>;
  upload(projectKey: string, versionNo: string, inputLocalPath: string): ReturnType<typeof uploadTexFile>;
};

export function createTexServices(runtime: SkillRuntime): TexServices {
  const { withBrowser } = runtime;
  const withTex = <T>(operation: (client: TexClient, session: BrowserSession) => Promise<T>): Promise<T> =>
    withBrowser("tex", (session) => operation(new TexClient(session.request), session));
  return {
    templates: (page) => withTex((client) => client.templates(page)),
    projects: (query, page) => withTex((client) => client.projects(query, page)),
    create: (name) => withTex((client) => client.create(name)),
    createFromTemplate: (templateKey) => withTex((client) => client.createFromTemplate(templateKey)),
    rename: (projectKey, name) => withTex((client) => client.rename(projectKey, name)),
    download: async (projectKey, versionNo, path) => {
      const bytes = await withTex((client) => client.download(projectKey, versionNo));
      return saveFile(path, bytes);
    },
    pdf: async (projectKey, versionNo, output) => saveFile(output, await withTex(async (client) => client.pdf(projectKey, versionNo, await client.compileResult(projectKey, versionNo)))),
    log: (projectKey, versionNo) => withTex((client) => client.log(projectKey, versionNo)),
    compile: (projectKey, versionNo, path, output) => withTex(async (client, session) => {
      const result = await compileTexFile(client, await session.page(), projectKey, versionNo, path);
      return saveFile(output, await client.pdf(projectKey, versionNo, result));
    }),
    files: (projectKey, versionNo) => withTex((client) => client.files(projectKey, versionNo)),
    upload: async (projectKey, versionNo, inputLocalPath) => {
      const path = resolve(inputLocalPath);
      const content = await readFile(path);
      return withTex(async (client, session) => uploadTexFile(client, await session.page(), projectKey, versionNo, basename(path), content));
    },
    read: (projectKey, versionNo, fileKey) => withTex((client) => client.read(projectKey, versionNo, fileKey)),
    write: async (projectKey, versionNo, path, inputLocalPath) => {
      const content = new TextDecoder("utf-8", { fatal: true }).decode(await readFile(resolve(inputLocalPath)));
      return withTex(async (client, session) => writeTexFile(client, await session.page(), projectKey, versionNo, path, content));
    },
  };
}
