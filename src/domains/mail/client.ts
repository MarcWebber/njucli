import { ImapFlow, type FetchMessageObject } from "imapflow";
import { simpleParser } from "mailparser";
import { z } from "zod";

import { AppError } from "../../core/errors.js";
import { saveFile } from "../../core/fs.js";

const messageId = z.tuple([z.string(), z.string().min(1), z.string().regex(/^\d+$/), z.number().int().positive()]);
type Credentials = { address: string; password: string };

export interface MailQuery {
  folder?: string | undefined;
  unread?: boolean | undefined;
  limit?: number | undefined;
  before?: number | undefined;
}

export class MailClient {
  constructor(private readonly accountDirectory: string) {}

  private async entry() {
    const { AsyncEntry } = await import("@napi-rs/keyring");
    return new AsyncEntry("njucli.mail", this.accountDirectory, { linux: { store: "secret-service" } });
  }

  private async credentials(): Promise<Credentials | null> {
    const value = await (await this.entry()).getPassword();
    return value ? JSON.parse(value) as Credentials : null;
  }

  async bind(address: string, password: string) {
    const credentials = { address: address.trim(), password };
    await this.connect(credentials, async (client) => { await client.mailboxOpen("INBOX", { readOnly: true }); });
    await (await this.entry()).setPassword(JSON.stringify(credentials));
    return { bound: true, address: credentials.address };
  }

  async status() {
    const credentials = await this.credentials();
    return { bound: credentials !== null, address: credentials?.address ?? null };
  }

  async unbind() {
    return { removed: await (await this.entry()).deletePassword() };
  }

  async folders() {
    return this.session(async (client) => (await client.list()).map((folder) => ({
      path: folder.path, name: folder.name, selectable: !folder.flags.has("\\Noselect"),
    })));
  }

  async list(options: MailQuery = {}, query?: string) {
    return this.session(async (client, address) => {
      const folder = await client.mailboxOpen(options.folder ?? "INBOX", { readOnly: true });
      const found = await client.search({
        all: true,
        ...(options.unread ? { seen: false } : {}),
        ...(query === undefined ? {} : { text: query }),
        ...(options.before === undefined ? {} : { uid: `1:${Math.max(1, options.before - 1)}` }),
      }, { uid: true });
      if (!Array.isArray(found)) throw new Error("IMAP SEARCH 未返回邮件标识列表");
      const uids = found.filter((uid) => options.before === undefined || uid < options.before).sort((a, b) => b - a);
      const page = uids.slice(0, options.limit ?? 20);
      const rows = page.length ? await client.fetchAll(page, { envelope: true, flags: true }, { uid: true }) : [];
      return {
        items: rows.sort((a, b) => b.uid - a.uid).map((row) => ({
          id: Buffer.from(JSON.stringify([address, folder.path, String(folder.uidValidity), row.uid])).toString("base64url"),
          ...summary(row),
        })),
        nextBefore: uids.length > page.length ? page.at(-1)! : null,
      };
    });
  }

  async search(query: string, options: MailQuery = {}) {
    return this.list(options, query);
  }

  async read(id: string) {
    const { row, parsed } = await this.message(id);
    return {
      id, ...summary(row), text: parsed.text ?? "",
      attachments: parsed.attachments.map((file, index) => ({
        id: String(index + 1), name: file.filename ?? null, contentType: file.contentType, bytes: file.size,
      })),
    };
  }

  async download(id: string, attachment: number, output: string) {
    const { parsed } = await this.message(id);
    const file = parsed.attachments[attachment - 1];
    if (!file) throw new AppError("NOT_FOUND", "附件不存在，请使用 mail read 返回的附件编号");
    return saveFile(output, file.content);
  }

  private async message(id: string) {
    const [address, folder, validity, uid] = messageId.parse(JSON.parse(Buffer.from(id, "base64url").toString("utf8")));
    return this.session(async (client, currentAddress) => {
      if (address !== currentAddress) throw new AppError("INVALID_INPUT", "邮件标识不属于当前绑定的邮箱");
      const mailbox = await client.mailboxOpen(folder, { readOnly: true });
      if (String(mailbox.uidValidity) !== validity) throw new AppError("NOT_FOUND", "邮件夹标识已变化，请重新查询邮件列表");
      const row = await client.fetchOne(uid, { source: true, envelope: true, flags: true }, { uid: true });
      if (!row || !row.source) throw new AppError("NOT_FOUND", "邮件已移走或删除，请重新查询邮件列表");
      const parsed = await simpleParser(row.source, { skipTextToHtml: true, skipImageLinks: true });
      return { row, parsed };
    });
  }

  private async session<T>(operation: (client: ImapFlow, address: string) => Promise<T>): Promise<T> {
    const credentials = await this.credentials();
    if (!credentials) throw new AppError("AUTH_REQUIRED", "尚未绑定校园邮箱", { authCommand: "njucli mail bind" });
    return this.connect(credentials, (client) => operation(client, credentials.address));
  }

  private async connect<T>(credentials: Credentials, operation: (client: ImapFlow) => Promise<T>): Promise<T> {
    const client = new ImapFlow({
      host: "imap.exmail.qq.com", port: 993, secure: true,
      auth: { user: credentials.address, pass: credentials.password },
      logger: false, disableAutoIdle: true,
    });
    // ImapFlow emits socket errors as well as rejecting pending commands.
    let connectionError: Error | undefined;
    client.on("error", (error: Error) => { connectionError = error; });
    try {
      await client.connect();
      const result = await operation(client);
      if (connectionError) throw connectionError;
      return result;
    } finally {
      client.close();
    }
  }
}

function summary(row: FetchMessageObject) {
  if (!row.envelope || !row.flags) throw new Error("IMAP FETCH 缺少邮件头或标记");
  return {
    subject: row.envelope.subject ?? "", from: row.envelope.from ?? [], to: row.envelope.to ?? [],
    date: row.envelope.date instanceof Date ? row.envelope.date.toISOString() : row.envelope.date ?? null,
    unread: !row.flags.has("\\Seen"),
  };
}
