import { AppError } from "../../core/errors.js";
import { isRecord } from "../../core/guards.js";
import type { FetchLike, FetchResponse } from "../../core/types.js";
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
const TASK_FLAGS: Record<EHallTaskKind, string> = {
  todo: "1",
  done: "2",
  started: "3",
};
const TASK_ACTIONS: Record<EHallTaskKind, string> = {
  todo: "queryTodoTask",
  done: "queryDoneTask",
  started: "queryProcessTrack",
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
    const value = await this.json(new URL("jsonp/userInfo.json", PORTAL));
    if (!isRecord(value) || typeof value.hasLogin !== "boolean") throw schemaChanged("hasLogin");
    return value.hasLogin;
  }

  async services(query = ""): Promise<EHallService[]> {
    const url = new URL("jsonp/ywtb/onlineYwtbApps", PORTAL);
    url.search = new URLSearchParams({ searchKeyword: query.trim(), labels: "" }).toString();
    const value = await this.json(url);
    if (!isRecord(value) || value.result !== "success" || !Array.isArray(value.data) || !value.data.every(isRecord)) {
      throw schemaChanged("服务目录");
    }
    return value.data.map((row) => {
      const appId = required(row, "appId");
      return {
        appId,
        name: required(row, "appName"),
        available: booleanField(row, "hasPermission"),
        url: this.serviceLink(appId).url,
      };
    });
  }

  async tasks(kind: EHallTaskKind, page = 1, pageSize = 20): Promise<EHallTaskPage> {
    const value = await this.postJson(
      new URL("sys/taskCenter/taskNew/getTaskRestful.do", TASK_CENTER),
      { flag: TASK_FLAGS[kind], sourceWid: "", pageNumber: page, pageSize },
    );
    const action = TASK_ACTIONS[kind];
    if (!isRecord(value) || !isRecord(value.datas) || !isRecord(value.datas[action])) {
      throw schemaChanged(action);
    }
    const bucket = value.datas[action];
    if (!Array.isArray(bucket.taskData) || !bucket.taskData.every(isRecord)) throw schemaChanged(action);
    return {
      kind,
      page,
      total: integer(bucket.taskDataTotal, "taskDataTotal"),
      items: bucket.taskData.map((row) => ({
        subject: required(row, "subject"),
        count: optionalInteger(row.todoCount, "todoCount"),
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
    const value = await this.postJson(
      new URL("sys/taskCenter/taskNew/queryProcessTrack.do", TASK_CENTER),
      {
        userId: Date.now(),
        state: APPLICATION_STATES[state],
        searchKeyword: "",
        pageNumber: page,
        pageSize,
      },
    );
    if (!isRecord(value) || !isRecord(value.datas) || !Array.isArray(value.datas.rows) || !value.datas.rows.every(isRecord)) {
      throw schemaChanged("queryProcessTrack");
    }
    return {
      state,
      page,
      total: integer(value.datas.totalSize, "totalSize"),
      items: value.datas.rows.map((row) => ({
        subject: required(row, "subject"),
        node: field(row, "nodeName"),
        startedAt: field(row, "startTime"),
      })),
    };
  }

  serviceLink(appIdInput: string): EHallServiceLink {
    const appId = appIdInput.trim();
    if (!/^\d+$/.test(appId)) {
      throw new AppError("INVALID_INPUT", "appId 必须是数字 ID");
    }
    return {
      appId,
      url: new URL(`/appShow?appId=${appId}`, PORTAL).toString(),
    };
  }

  private postJson(url: URL, body: object): Promise<unknown> {
    return this.json(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-requested-with": "XMLHttpRequest",
      },
      body: JSON.stringify(body),
    });
  }

  private async json(url: URL, init?: RequestInit): Promise<unknown> {
    const response = await this.request(url, init);
    return JSON.parse(await response.text()) as unknown;
  }

  private async request(url: URL, init?: RequestInit): Promise<FetchResponse> {
    const response = await this.fetch(url, init);
    const target = new URL(response.url);
    if (target.hostname === "authserver.nju.edu.cn" || response.status === 401 || response.status === 403) {
      throw new AppError("AUTH_REQUIRED", "EHall 会话未登录或已经失效", {
        hint: "运行 njucli auth login ehall",
        authCommand: "njucli auth login ehall",
      });
    }
    if (!response.ok) throw new Error(`EHall 返回 HTTP ${response.status}`);
    return response;
  }
}

function field(row: Row, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    throw schemaChanged(key);
  }
  return String(value).trim() || null;
}

function required(row: Row, key: string): string {
  const value = field(row, key);
  if (value === null) throw schemaChanged(key);
  return value;
}

function booleanField(row: Row, key: string): boolean {
  const value = row[key];
  if (value === true || value === 1 || value === "1" || value === "true") return true;
  if (value === false || value === 0 || value === "0" || value === "false") return false;
  throw schemaChanged(key);
}

function integer(value: unknown, key: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw schemaChanged(key);
  return result;
}

function optionalInteger(value: unknown, key: string): number | null {
  return value === null || value === undefined || value === "" ? null : integer(value, key);
}

function priority(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value === 1 || value === "1") return "特急";
  if (value === 2 || value === "2") return "紧急";
  return "一般";
}

function schemaChanged(part: string): AppError {
  return new AppError("REMOTE_SCHEMA_CHANGED", `EHall 接口结构已变化：${part}`);
}
