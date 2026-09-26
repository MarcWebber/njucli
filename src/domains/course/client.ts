import { AppError } from "../../core/errors.js";
import type { FetchLike, FetchResponse } from "../../core/types.js";
import {
  COURSE_URLS,
  type CourseRow,
  type TermDateRow,
  type TermRow,
} from "./contract.js";

const TERMS_ACTION = "xnxqcx";
const CURRENT_TERM_ACTION = "dqxnxq";
const TERM_DATES_ACTION = "cxjcs";
const SCHEDULE_ACTION = "cxxszhxqkb";

/** The single remote client for the EHall undergraduate timetable contract. */
export class EHallTimetableClient {
  private preparation: Promise<void> | undefined;
  private term: Promise<TermRow> | undefined;

  constructor(private readonly fetch: FetchLike) {}

  async listTerms(): Promise<TermRow[]> {
    await this.prepare();
    return this.postRows(
      COURSE_URLS.terms,
      TERMS_ACTION,
      new URLSearchParams({ "*order": "-DM" }),
    );
  }

  currentTerm(): Promise<TermRow> {
    return this.term ??= this.readCurrentTerm();
  }

  private async readCurrentTerm(): Promise<TermRow> {
    await this.prepare();
    const rows = await this.postRows<TermRow>(
      COURSE_URLS.currentTerm,
      CURRENT_TERM_ACTION,
      new URLSearchParams(),
    );
    const term = rows[0];
    if (!term) {
      throw new AppError("NOT_FOUND", "没有查询到当前学期");
    }
    return term;
  }

  async listTermDates(): Promise<TermDateRow[]> {
    await this.prepare();
    const response = await this.request(COURSE_URLS.termDates);
    return this.parseRows<TermDateRow>(response, TERM_DATES_ACTION);
  }

  async listSchedule(termId: string): Promise<CourseRow[]> {
    await this.prepare();
    const rows = await this.postRows<CourseRow>(
      COURSE_URLS.schedule,
      SCHEDULE_ACTION,
      new URLSearchParams({
        XNXQDM: termId,
        pageSize: "999",
        pageNumber: "1",
      }),
    );
    return rows.map((row) => ({ ...row, KSJC: Number(row.KSJC), JSJC: Number(row.JSJC), SKXQ: Number(row.SKXQ) }));
  }

  private async prepare(): Promise<void> {
    this.preparation ??= this.prepareOnce();
    await this.preparation;
  }

  private async prepareOnce(): Promise<void> {
    await this.request(COURSE_URLS.app);
    await this.request(COURSE_URLS.index);
    await this.request(COURSE_URLS.role);
  }

  private async postRows<T>(
    url: string,
    action: string,
    form: URLSearchParams,
  ): Promise<T[]> {
    const response = await this.request(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    return this.parseRows<T>(response, action);
  }

  private async parseRows<T>(
    response: FetchResponse,
    action: string,
  ): Promise<T[]> {
    const parsed = JSON.parse(await response.text()) as {
      code: string | number;
      datas: Record<string, { rows: T[] }>;
    };
    if (String(parsed.code) !== "0") {
      throw new Error(`课表服务返回业务错误 ${parsed.code}`);
    }
    return parsed.datas[action]!.rows;
  }

  private async request(url: string, init?: RequestInit): Promise<FetchResponse> {
    const response = await this.fetch(url, init);

    const hostname = new URL(response.url).hostname;
    if (
      hostname === "authserver.nju.edu.cn" ||
      response.status === 401 ||
      response.status === 403
    ) {
      throw new AppError("AUTH_REQUIRED", "课表会话未登录或已经失效", {
        hint: "运行 njucli auth login timetable",
        authCommand: "njucli auth login timetable",
      });
    }
    if (!response.ok) {
      throw new Error(`课表服务返回 HTTP ${response.status}`);
    }
    return response;
  }
}
