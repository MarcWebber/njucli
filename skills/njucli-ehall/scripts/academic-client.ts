import { AppError } from "../../../src/core/errors.js";
import type { FetchLike, FetchResponse } from "../../../src/core/types.js";
import type {
  GraduateExam,
  GraduateGrade,
  GraduatePlan,
  GraduateSchedule,
} from "./types.js";

const EHALL = "https://ehall.nju.edu.cn";
const BASE = "https://ehallapp.nju.edu.cn/gsapp/sys/";
const APPS = {
  grades: {
    id: "5094115980385668",
    root: "wdcjapp",
  },
  exams: {
    id: "5051542166524964",
    root: "wdksapp",
  },
  schedule: {
    id: "4979568947762216",
    root: "wdkbapp",
  },
  plan: {
    id: "5006012186614764",
    root: "wdpyfaapp",
  },
} as const;

type AppName = keyof typeof APPS;
type Row = Record<string, unknown>;

export class GraduateAcademicClient {
  constructor(private readonly fetch: FetchLike) {}

  async grades(termId?: string): Promise<GraduateGrade[]> {
    await this.prepare("grades");
    const form = new URLSearchParams({ pageNumber: "1", pageSize: "1000" });
    if (termId?.trim()) form.set("querySetting", JSON.stringify([condition("XNXQDM", termId.trim())]));
    const rows = await this.postRows("grades", "modules/wdcj/xscjcx.do", "xscjcx", form);
    return rows.map((row) => ({
      term: value(row, "XNXQDM_DISPLAY"),
      courseCode: required(row, "KCDM"),
      courseName: required(row, "KCMC"),
      category: value(row, "KCLBMC"),
      credits: numberValue(row, "XF"),
      score: value(row, "CJXSZ"),
      passed: booleanValue(row, "SFJG"),
    }));
  }

  async exams(termId?: string): Promise<GraduateExam[]> {
    const studentId = await this.studentId();
    await this.prepare("exams");
    const { datas: terms } = await this.json<{ datas: Row[] }>(this.url("exams", "modules/ksxxck/getXnxqList.do"));
    const selectedTerm = termId?.trim() || value(terms[0], "DM");
    if (!selectedTerm) throw new AppError("NOT_FOUND", "没有可查询的考试学期");
    const common = [
      condition("XNXQDM", selectedTerm),
      condition("SFFBKSAP", "1"),
      condition("XH", studentId),
    ];
    const [exams, assessments] = await Promise.all([
      this.examRows("wdksxxcx", "notEqual", common),
      this.examRows("wdkckcxxcx", "equal", common),
    ]);
    return [
      ...exams.map((row) => exam(row, selectedTerm, "exam")),
      ...assessments.map((row) => exam(row, selectedTerm, "assessment")),
    ];
  }

  async schedule(termId?: string): Promise<GraduateSchedule> {
    await this.prepare("schedule");
    const terms = await this.postRows(
      "schedule",
      "modules/xskcb/kfdxnxqcx.do",
      "kfdxnxqcx",
      new URLSearchParams(),
    );
    const selected = termId?.trim()
      ? terms.find((term) => value(term, "XNXQDM") === termId.trim())
      : terms[0];
    if (!selected) throw new AppError("NOT_FOUND", `没有可查询的课表学期${termId ? `：${termId}` : ""}`);
    const id = required(selected, "XNXQDM");
    const rows = await this.postRows(
      "schedule",
      "modules/xskcb/xspkjgcx.do",
      "xspkjgcx",
      new URLSearchParams({ XNXQDM: id, XH: "" }),
    );
    return {
      term: { id, name: required(selected, "XNXQDM_DISPLAY") },
      courses: rows.map((row) => ({
        courseCode: required(row, "KCDM"),
        courseName: required(row, "KCMC"),
        className: value(row, "BJMC"),
        teachers: split(value(row, "JSXM")),
        weekday: value(row, "XQ"),
        period: value(row, "KSJCDM"),
        timePlace: value(row, "PKSJDD"),
        location: value(row, "JASMC"),
        campus: value(row, "XQDM_DISPLAY"),
      })),
    };
  }

  async plan(): Promise<GraduatePlan> {
    const studentId = await this.studentId();
    await this.prepare("plan");
    const planRows = await this.postRows(
      "plan",
      "modules/pyfaxq/gjxhcxdyfadm.do",
      "gjxhcxdyfadm",
      new URLSearchParams({ XH: studentId }),
    );
    const planId = required(planRows[0], "FADM");
    const [headers, requirementValue, courseRows] = await Promise.all([
      this.postRows(
        "plan",
        "modules/pyfaxq/facx.do",
        "facx",
        new URLSearchParams({ DM: planId }),
      ),
      this.post<{ falxdykclbxfyqResults: Row[] }[]>(
        "plan",
        "modules/pyfaxq/wdFacxPyfakclbxfyqcx.do",
        new URLSearchParams({ FADM: planId }),
      ),
      this.postRows(
        "plan",
        "modules/pyfaxq/pyfakcxxcx.do",
        "pyfakcxxcx",
        new URLSearchParams({
          setting: JSON.stringify([{ name: "FADM", value: planId }]),
          pageNumber: "1",
          pageSize: "1000",
        }),
      ),
    ]);
    const header = headers[0];
    return {
      planId,
      name: value(header, "FAMC"),
      gradeYear: value(header, "NJDM"),
      departmentCode: value(header, "YXDM"),
      requirements: requirementValue[0]!.falxdykclbxfyqResults.map((row) => ({
        category: required(row, "KCLBDM_DISPLAY"),
        minimumCredits: numberValue(row, "ZDXF"),
        maximumCredits: numberValue(row, "ZGXF"),
      })),
      courses: courseRows.map((row) => ({
        courseCode: required(row, "KCDM"),
        courseName: required(row, "KCMC"),
        category: value(row, "KCLBDM_DISPLAY"),
        college: value(row, "KKDW_DISPLAY"),
        hours: numberValue(row, "XS"),
        credits: numberValue(row, "XF"),
        suggestedTerm: value(row, "XNXQDM_DISPLAY"),
        required: value(row, "SFXWK_DISPLAY"),
        note: value(row, "BZ"),
      })),
    };
  }

  private async examRows(
    action: "wdksxxcx" | "wdkckcxxcx",
    builder: "equal" | "notEqual",
    common: Row[],
  ): Promise<Row[]> {
    return this.postRows(
      "exams",
      `modules/ksxxck/${action}.do`,
      action,
      new URLSearchParams({
        pageNumber: "1",
        pageSize: "500",
        querySetting: JSON.stringify([
          ...common,
          { ...condition("KSAPWID", null), builder },
        ]),
      }),
    );
  }

  private async studentId(): Promise<string> {
    await this.prepare("schedule");
    const url = this.url("schedule", "wdkcb/initXsxx.do");
    url.search = new URLSearchParams({ XH: "" }).toString();
    const result = await this.json<{ data: Row[] }>(url);
    return required(result.data[0], "XH");
  }

  private async prepare(name: AppName): Promise<void> {
    const app = APPS[name];
    await this.request(`${EHALL}/appShow?appId=${app.id}`);
    await this.request(this.url(name, "*default/index.do"));
  }

  private postRows(
    app: AppName,
    path: string,
    action: string,
    form: URLSearchParams,
  ): Promise<Row[]> {
    return this.post<{ datas: Record<string, { rows: Row[] }> }>(app, path, form)
      .then((value) => value.datas[action]!.rows);
  }

  private async post<T>(app: AppName, path: string, form: URLSearchParams): Promise<T> {
    return this.json<T>(this.url(app, path), {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-requested-with": "XMLHttpRequest",
      },
      body: form.toString(),
    });
  }

  private url(app: AppName, path: string): URL {
    return new URL(`${APPS[app].root}/${path}`, BASE);
  }

  private async json<T>(url: string | URL, init?: RequestInit): Promise<T> {
    const response = await this.request(url, init);
    return JSON.parse(await response.text()) as T;
  }

  private async request(url: string | URL, init?: RequestInit): Promise<FetchResponse> {
    const response = await this.fetch(url, init);
    const target = new URL(response.url);
    if (target.hostname === "authserver.nju.edu.cn" || response.status === 401 || response.status === 403) {
      throw new AppError("AUTH_REQUIRED", "EHall 教务会话未登录或已经失效", {
        hint: "运行 njucli auth login ehall",
        authCommand: "njucli auth login ehall",
      });
    }
    if (!response.ok) throw new Error(`EHall 教务服务返回 HTTP ${response.status}`);
    return response;
  }
}

function exam(row: Row, termId: string, kind: GraduateExam["kind"]): GraduateExam {
  return {
    kind,
    termId,
    courseCode: value(row, "KCDM"),
    courseName: required(row, "KCMC"),
    date: value(row, "KSRQ"),
    startsAt: value(row, "KSSJ"),
    endsAt: value(row, "JSSJ"),
    location: value(row, "JASMC"),
    seat: value(row, "ZWH"),
  };
}

function condition(name: string, current: string | null): Row {
  return {
    name,
    caption: name,
    builder: "equal",
    linkOpt: "AND",
    value: current,
  };
}

function required(row: Row | undefined, key: string): string {
  const result = value(row, key);
  if (result === null) throw new AppError("REMOTE_SCHEMA_CHANGED", `EHall 教务接口结构已变化：${key}`);
  return result;
}

function value(row: Row | undefined, key: string): string | null {
  const current = row?.[key];
  if (current === null || current === undefined || current === "") return null;
  return String(current).trim() || null;
}

function numberValue(row: Row | undefined, key: string): number | null {
  const current = value(row, key);
  if (current === null) return null;
  return Number(current);
}

function booleanValue(row: Row | undefined, key: string): boolean | null {
  const current = value(row, key);
  if (current === null) return null;
  return current === "1" || current === "true";
}

function split(input: string | null): string[] {
  return input?.split(/[,，、]/).map((item) => item.trim()).filter(Boolean) ?? [];
}

