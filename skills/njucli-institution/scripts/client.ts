import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { AppError } from "../../../src/core/errors.js";
import { saveFile } from "../../../src/core/fs.js";
import type { FetchLike } from "../../../src/core/types.js";
import type { Institution, InstitutionSnapshot, KnowledgeKind, KnowledgeRecord } from "./types.js";
import { basicCategory, basicOverview, basicTeacher, contactEmail, decodeHtml, directoryMarkdown, extractText, institutionFilename, institutionMarkdown, researchDirection, servicesMarkdown, snapshotJson } from "./text.js";
import { parseInstitutionDirectory, parseLogisticsServices } from "./directory.js";

const DIRECTORY_URL = "https://www.nju.edu.cn/xybm.htm";
const SERVICES_URL = "https://www.nju.edu.cn/xyfw/hqfw.htm";
export interface SearchOptions { institution?: string | undefined; kind?: KnowledgeKind | undefined; limit?: number | undefined; offset?: number | undefined }

export class InstitutionClient {
  constructor(private readonly fetch: FetchLike = globalThis.fetch, private readonly snapshotPath: string | URL = new URL(import.meta.url.endsWith("/client.js") ? "../../../../skills/njucli-institution/references/机构资料.json" : "../references/机构资料.json", import.meta.url)) {}

  private async snapshot(): Promise<InstitutionSnapshot> {
    const snapshot = JSON.parse(await readFile(this.snapshotPath, "utf8")) as InstitutionSnapshot;
    for (const record of snapshot.records) {
      if (record.kind !== "teacher") continue;
      record.text = researchDirection(record.text);
      if (record.category) record.category = basicCategory(record.category);
    }
    return snapshot;
  }

  async list(query = "", live = false) {
    const snapshot = await this.snapshot();
    const fetchedAt = live ? new Date().toISOString() : snapshot.generatedAt;
    const items = live ? parseInstitutionDirectory(await this.html(DIRECTORY_URL), fetchedAt, DIRECTORY_URL) : snapshot.institutions;
    return { mode: live ? "live" : "snapshot", fetchedAt, items: items.filter(item => matches(query, item.name, item.category, item.id)) };
  }

  async show(id: string, live = false) {
    const snapshot = await this.snapshot();
    const institution = findInstitution(snapshot, id);
    const records = snapshot.records.filter(record => record.institutionId === institution.id && record.kind !== "teacher");
    const result: KnowledgeRecord[] = [];
    for (const record of records) result.push(live ? await this.liveRecord(record) : record);
    if (live && records.length === 0) throw new AppError("NOT_FOUND", "该机构尚无可实时读取的简介来源，请查看官网入口");
    return { mode: live ? "live" : "snapshot", institution, records: result, teacherCount: snapshot.records.filter(record => record.institutionId === institution.id && record.kind === "teacher").length, coverage: snapshot.coverage.find(item => item.institutionId === institution.id) ?? null, generatedAt: snapshot.generatedAt };
  }

  async teachers(query = "", options: Omit<SearchOptions, "kind"> = {}) {
    return this.search(query, { ...options, kind: "teacher" });
  }

  async teacher(id: string, live = false) {
    const snapshot = await this.snapshot();
    const record = snapshot.records.find(item => item.id === id && item.kind === "teacher");
    if (!record) throw new AppError("NOT_FOUND", "教师 ID 不存在，请从 institution teachers 选择");
    return { mode: live ? "live" : "snapshot", institution: findInstitution(snapshot, record.institutionId), record: live ? await this.liveRecord(record) : record, rosterSource: snapshot.coverage.find(item => item.institutionId === record.institutionId)?.rosterSource, generatedAt: snapshot.generatedAt };
  }

  async search(query: string, options: SearchOptions = {}) {
    const snapshot = await this.snapshot();
    const institution = options.institution === undefined ? undefined : findInstitution(snapshot, options.institution);
    const items = snapshot.records.filter(record => (!institution || record.institutionId === institution.id) && (!options.kind || record.kind === options.kind) && matches(query, record.title, record.text, record.department ?? "", record.role ?? "", record.category ?? "", record.phone ?? "", record.email ?? "", record.office ?? ""));
    if (options.kind === "teacher") items.sort((a, b) => Number(Boolean(b.phone || b.email)) - Number(Boolean(a.phone || a.email)));
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 20;
    return { mode: "snapshot", generatedAt: snapshot.generatedAt, total: items.length, offset, limit, items: items.slice(offset, offset + limit).map(({ text, ...record }) => ({ ...record, excerpt: searchExcerpt(text, query), institutionName: snapshot.institutions.find(item => item.id === record.institutionId)?.name ?? record.institutionId })) };
  }

  async services(query = "", live = false) {
    const snapshot = await this.snapshot();
    const fetchedAt = live ? new Date().toISOString() : snapshot.generatedAt;
    const items = live ? parseLogisticsServices(await this.html(SERVICES_URL), fetchedAt, SERVICES_URL) : snapshot.services;
    return { mode: live ? "live" : "snapshot", fetchedAt, items: items.filter(item => matches(query, item.unit, item.department, item.phone)) };
  }

  async dump(output: string) {
    const snapshot = await this.snapshot();
    const directory = resolve(output);
    await mkdir(join(directory, "institutions"), { recursive: true });
    const files = [await saveFile(join(directory, "机构资料.json"), snapshotJson(snapshot)), await saveFile(join(directory, "机构目录.md"), directoryMarkdown(snapshot))];
    for (const institution of snapshot.institutions.filter(item => snapshot.records.some(record => record.institutionId === item.id))) {
      files.push(await saveFile(join(directory, "institutions", institutionFilename(institution)), institutionMarkdown(institution, snapshot)));
    }
    files.push(await saveFile(join(directory, "后勤电话.md"), servicesMarkdown(snapshot.services)));
    return { directory, generatedAt: snapshot.generatedAt, files };
  }

  private async liveRecord(record: KnowledgeRecord): Promise<KnowledgeRecord> {
    if (!record.source.selector) throw new AppError("NOT_FOUND", "该记录仅收录公开名录或来源说明，尚无可实时读取的独立正文，请查看来源链接");
    const html = await this.html(record.source.url);
    const body = extractText(html, record.source.selector);
    const basic = record.kind === "teacher" ? basicTeacher(body, record.title) : { text: basicOverview(body) };
    if (record.kind === "teacher" && record.source.contactSelector && "email" in basic) {
      const contactText = extractText(html, record.source.contactSelector);
      const contacts = basicTeacher(contactText, record.title);
      Object.assign(basic, { phone: contacts.phone || basic.phone, email: contacts.email || contactEmail(contactText) || basic.email, office: contacts.office || basic.office });
    }
    const result = { ...record, ...basic, source: { ...record.source, fetchedAt: new Date().toISOString() } };
    if ("role" in basic && !basic.role && record.role) result.role = record.role;
    return result;
  }

  private async html(url: string): Promise<string> {
    const response = await this.fetch(url, { headers: { accept: "text/html,application/xhtml+xml" }, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`机构官网返回 HTTP ${response.status}：${url}`);
    if (new URL(response.url).hostname === "authserver.nju.edu.cn") throw new AppError("AUTH_REQUIRED", "该来源已跳转学校登录页，公开查询无法读取正文");
    const bytes = new Uint8Array(await response.arrayBuffer());
    return decodeHtml(bytes, response.headers.get("content-type"));
  }
}

function findInstitution(snapshot: InstitutionSnapshot, id: string): Institution {
  const institution = snapshot.institutions.find(item => item.id === id || item.name === id);
  if (!institution) throw new AppError("NOT_FOUND", "机构不存在，请从 institution list 选择 ID 或完整名称");
  return institution;
}

function matches(query: string, ...values: string[]): boolean {
  const text = values.join("\n").toLocaleLowerCase();
  return query.trim().toLocaleLowerCase().split(/\s+/).every(word => text.includes(word));
}

function searchExcerpt(text: string, query: string): string {
  const word = query.trim().toLocaleLowerCase().split(/\s+/)[0] ?? "";
  const match = word ? text.toLocaleLowerCase().indexOf(word) : 0;
  const start = Math.max(0, match - 80);
  const end = start + 400;
  return `${start ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}
