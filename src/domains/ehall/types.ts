export interface EHallService {
  appId: string;
  name: string;
  available: boolean;
  url: string;
}

export type EHallTaskKind = "todo" | "done" | "started";

export interface EHallTaskPage {
  kind: EHallTaskKind;
  page: number;
  total: number;
  items: Array<{
    subject: string;
    count: number | null;
    priority: string | null;
    status: string | null;
    node: string | null;
    author: string | null;
    time: string | null;
  }>;
}

export type EHallApplicationState = "active" | "completed" | "cancelled";

export interface EHallApplicationPage {
  state: EHallApplicationState;
  page: number;
  total: number;
  items: Array<{
    subject: string;
    node: string | null;
    startedAt: string | null;
  }>;
}

export interface EHallServiceLink {
  appId: string;
  url: string;
}
