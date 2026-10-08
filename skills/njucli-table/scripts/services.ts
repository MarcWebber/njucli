import type { SkillRuntime } from "../../../src/app/runtime.js";
import { TableClient } from "./client.js";

export type TableServices = Omit<TableClient, "restoreSession">;

export function createTableServices({ withBrowser }: SkillRuntime): TableServices {
  const withTable = <T>(operation: (client: TableClient) => Promise<T>): Promise<T> => {
    let client: TableClient;
    return withBrowser("table", () => operation(client), async (session) => {
      client = new TableClient(session.request);
      return client.restoreSession();
    });
  };
  return {
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
