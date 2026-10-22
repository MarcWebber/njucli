import { readFile } from "node:fs/promises";
import { baseInput } from "./schema.js";
import { AppError } from "../../../src/core/errors.js";
import { saveFile } from "../../../src/core/fs.js";
import type { SkillRuntime } from "../../../src/app/runtime.js";
import { join } from "node:path";
import { withBrowserSession } from "../../../src/auth/browser-session.js";
import type { AuthCredentials } from "../../../src/auth/types.js";
import { readJsonFile } from "../../../src/core/fs.js";
import { TableAppClient } from "./apps.js";
import { TableClient } from "./client.js";

export type TableServices = Omit<TableClient, "restoreSession"> & {
  preset: typeof tablePreset;
  appShow(id: string): Promise<ReturnType<TableAppClient["show"]>>;
  appRows(id: string, ...args: Parameters<TableAppClient["rows"]>): ReturnType<TableAppClient["rows"]>;
  formSubmit(id: string, ...args: Parameters<TableAppClient["submit"]>): ReturnType<TableAppClient["submit"]>;
};

export async function loadTablePreset(name: string) {
  if (name !== "gradebook") throw new AppError("INVALID_INPUT", "内置模板：gradebook");
  return baseInput.parse(JSON.parse(await readFile(new URL("../templates/gradebook.json", import.meta.url), "utf8")));
}

async function tablePreset(name: string, output?: string) {
  const data = await loadTablePreset(name);
  return output ? saveFile(output, JSON.stringify(data, null, 2) + "\n") : data;
}

export function createTableServices({ withBrowser, accountStore, auth }: SkillRuntime): TableServices {
  const withTable = <T>(operation: (client: TableClient) => Promise<T>): Promise<T> => {
    let client: TableClient;
    return withBrowser("table", () => operation(client), async (session) => {
      client = new TableClient(session.request);
      return client.restoreSession();
    });
  };
  const withApp = async <T>(id: string, operation: (client: TableAppClient) => Promise<T> | T): Promise<T> => {
    const account = await accountStore.current();
    return withBrowserSession(account, true, async session => {
      const client = new TableAppClient(session.request, id);
      await auth.ensureSession(account, "table", async () => {
        await client.open(await readJsonFile<AuthCredentials>(join(account.configDir, "auth.json")));
        return true;
      });
      return operation(client);
    });
  };
  return {
    preset: tablePreset,
    appShow: (id: string) => withApp(id, client => client.show()),
    appRows: (id: string, ...args: Parameters<TableAppClient["rows"]>) => withApp(id, client => client.rows(...args)),
    formSubmit: (id: string, ...args: Parameters<TableAppClient["submit"]>) => withApp(id, client => client.submit(...args)),
    workspaces: () => withTable((client) => client.workspaces()),
    bases: (query) => withTable((client) => client.bases(query)),
    templates: (query) => withTable((client) => client.templates(query)),
    show: (id) => withTable((client) => client.show(id)),
    rows: (id, sheet, options) => withTable((client) => client.rows(id, sheet, options)),
    row: (id, sheet, rowId) => withTable((client) => client.row(id, sheet, rowId)),
    create: (name, options) => withTable((client) => client.create(name, options)),
    addSheet: (id, input) => withTable((client) => client.addSheet(id, input)),
    addColumn: (id, sheet, input) => withTable((client) => client.addColumn(id, sheet, input)),
    addView: (id, sheet, input) => withTable((client) => client.addView(id, sheet, input)),
    updateView: (id, sheet, input) => withTable((client) => client.updateView(id, sheet, input)),
    append: (id, sheet, rows) => withTable((client) => client.append(id, sheet, rows)),
    update: (id, sheet, updates) => withTable((client) => client.update(id, sheet, updates)),
  };
}
