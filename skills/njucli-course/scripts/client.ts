import { AppError } from "../../../src/core/errors.js";
import type { FetchLike, FetchResponse } from "../../../src/core/types.js";
import {
  TIMETABLE_API,
  type CourseRow,
  type TermDateRow,
  type TermRow,
} from "./contract.js";

export class EHallTimetableClient {
  private preparation: Promise<void> | undefined;
  private term: Promise<TermRow> | undefined;

  constructor(private readonly fetch: FetchLike) {}

  async listTerms(): Promise<TermRow[]> {
    await this.prepare();
    return this.queryRows(
      TIMETABLE_API.terms,
      new URLSearchParams({ "*order": "-DM" }),
    );
  }

  currentTerm(): Promise<TermRow> {
    return this.term ??= this.readCurrentTerm();
  }

  private async readCurrentTerm(): Promise<TermRow> {
    await this.prepare();
    const rows = await this.queryRows<TermRow>(
      TIMETABLE_API.currentTerm,
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
    return this.queryRows<TermDateRow>(TIMETABLE_API.termDates);
  }

  async listSchedule(termId: string): Promise<CourseRow[]> {
    await this.prepare();
    const rows = await this.queryRows<CourseRow>(
      TIMETABLE_API.schedule,
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
    await this.request(TIMETABLE_API.app);
    await this.request(TIMETABLE_API.index);
    await this.request(TIMETABLE_API.role);
  }

  private async queryRows<T>(
    endpoint: { url: string; rowsKey: string },
    form?: URLSearchParams,
  ): Promise<T[]> {
    const response = await this.request(endpoint.url, form && {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const parsed = JSON.parse(await response.text()) as {
      code: string | number;
      datas: Record<string, { rows: T[] }>;
    };
    if (String(parsed.code) !== "0") {
      throw new Error(`课表服务返回业务错误 ${parsed.code}`);
    }
    return parsed.datas[endpoint.rowsKey]!.rows;
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
