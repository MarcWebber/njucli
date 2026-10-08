import { type SkillRuntime } from "../../../src/app/runtime.js";
import { MailClient, type MailBinding } from "./client.js";
import { bindMailAccount } from "../../../src/auth/mail-bind.js";

export type MailServices = Pick<MailClient, "accounts" | "use" | "status" | "unbind" | "folders" | "list" | "search" | "read" | "download"> & {
  bind(credentials?: MailBinding): ReturnType<MailClient["bind"]>;
};

export function createMailServices(runtime: SkillRuntime): MailServices {
  const { accountStore } = runtime;
  const mail = async () => new MailClient((await accountStore.current()).configDir);
  return {
    bind: async (credentials) => bindMailAccount(await accountStore.current(), credentials),
    accounts: async () => (await mail()).accounts(),
    use: async (address) => (await mail()).use(address),
    status: async () => (await mail()).status(),
    unbind: async (address) => (await mail()).unbind(address),
    folders: async () => (await mail()).folders(),
    list: async (options) => (await mail()).list(options),
    search: async (query, options) => (await mail()).search(query, options),
    read: async (id) => (await mail()).read(id),
    download: async (id, attachment, output) => (await mail()).download(id, attachment, output),
  };
}
