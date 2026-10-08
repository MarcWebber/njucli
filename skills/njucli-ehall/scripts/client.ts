import { AppError } from "../../../src/core/errors.js";
import type { FetchLike } from "../../../src/core/types.js";
import type {
  EHallApplicationPage,
  EHallApplicationState,
  EHallService,
  EHallServiceLink,
  EHallTaskKind,
  EHallTaskPage,
} from "./types.js";

const PORTAL = "https://ehall.nju.edu.cn/";
const TASK_CENTER = "https://ehall.nju.edu.cn/taskcenterapp/";
const TASK_ACTIONS: Record<EHallTaskKind, { flag: string; action: string }> = {
  todo: { flag: "1", action: "queryTodoTask" },
  done: { flag: "2", action: "queryDoneTask" },
  started: { flag: "3", action: "queryProcessTrack" },
};
const APPLICATION_STATES: Record<EHallApplicationState, string> = {
  active: "1",
  completed: "2",
  cancelled: "3",
};

type Row = Record<string, unknown>;

export class EHallPortalClient {
  constructor(private readonly fetch: FetchLike) {}

  async hasSession(): Promise<boolean> {
    const value = await this.json<{ hasLogin: boolean }>(new URL("jsonp/userInfo.json", PORTAL));
    return value.hasLogin;
  }

  async services(query = ""): Promise<EHallService[]> {
    const url = new URL("jsonp/ywtb/onlineYwtbApps", PORTAL);
    url.search = new URLSearchParams({ searchKeyword: query.trim(), labels: "" }).toString();
    const value = await this.json<{ result: string; data: Row[] }>(url);
    if (value.result !== "success") throw new Error(`EHall 服务目录请求失败：${value.result}`);
    return value.data.map((row) => {
      const appId = required(row, "appId");
      return {
        appId,
        name: required(row, "appName"),
        available: [true, 1, "1", "true"].includes(row.hasPermission as string | number | boolean),
        url: serviceLink(appId).url,
      };
    });
  }

  async tasks(kind: EHallTaskKind, page = 1, pageSize = 20): Promise<EHallTaskPage> {
    const { flag, action } = TASK_ACTIONS[kind];
    const value = await this.postJson<{ datas: Record<string, { taskData: Row[]; taskDataTotal: number }> }>(
      new URL("sys/taskCenter/taskNew/getTaskRestful.do", TASK_CENTER),
      { flag, sourceWid: "", pageNumber: page, pageSize },
    );
    const bucket = value.datas[action]!;
    return {
      kind,
      page,
      total: Number(bucket.taskDataTotal),
      items: bucket.taskData.map((row) => ({
        subject: required(row, "subject"),
        count: row.todoCount == null || row.todoCount === "" ? null : Number(row.todoCount),
        priority: priority(row.priority),
        status: field(row, "processStatus"),
        node: field(row, "node_name"),
        author: field(row, "author"),
        time: field(row, kind === "done" ? "endTime" : "createTime"),
      })),
    };
  }

  async applications(
    state: EHallApplicationState,
    page = 1,
    pageSize = 20,
  ): Promise<EHallApplicationPage> {
    const value = await this.postJson<{ datas: { rows: Row[]; totalSize: number } }>(
      new URL("sys/taskCenter/taskNew/queryProcessTrack.do", TASK_CENTER),
      {
        userId: Date.now(),
        state: APPLICATION_STATES[state],
        searchKeyword: "",
        pageNumber: page,
        pageSize,
      },
    );
    return {
      state,
      page,
      total: Number(value.datas.totalSize),
      items: value.datas.rows.map((row) => ({
        subject: required(row, "subject"),
        node: field(row, "nodeName"),
        startedAt: field(row, "startTime"),
      })),
    };
  }

  private postJson<T>(url: URL, body: object): Promise<T> {
    return this.json<T>(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-requested-with": "XMLHttpRequest",
      },
      body: JSON.stringify(body),
    });
  }

  private async json<T>(url: URL, init?: RequestInit): Promise<T> {
    const response = await this.fetch(url, init);
    const target = new URL(response.url);
    if (target.hostname === "authserver.nju.edu.cn" || response.status === 401 || response.status === 403) {
      throw new AppError("AUTH_REQUIRED", "EHall 会话未登录或已经失效", {
        hint: "运行 njucli auth login ehall",
        authCommand: "njucli auth login ehall",
      });
    }
    if (!response.ok) throw new Error(`EHall 返回 HTTP ${response.status}`);
    return JSON.parse(await response.text()) as T;
  }
}

function field(row: Row, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined || value === "") return null;
  return String(value).trim() || null;
}

function required(row: Row, key: string): string {
  const value = field(row, key);
  if (value === null) throw new AppError("REMOTE_SCHEMA_CHANGED", `EHall 接口结构已变化：${key}`);
  return value;
}

function priority(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value === 1 || value === "1") return "特急";
  if (value === 2 || value === "2") return "紧急";
  return "一般";
}

export function serviceLink(appIdInput: string): EHallServiceLink {
  const appId = appIdInput.trim();
  return {
    appId,
    url: new URL(`/appShow?${new URLSearchParams({ appId })}`, PORTAL).toString(),
  };
}
