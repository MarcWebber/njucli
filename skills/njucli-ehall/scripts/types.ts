export interface EHallService {
  appId: string;
  name: string;
  available: boolean;
  url: string;
}

export const EHALL_TASK_KINDS = ["todo", "done", "started"] as const;
export type EHallTaskKind = typeof EHALL_TASK_KINDS[number];

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

export const EHALL_APPLICATION_STATES = ["active", "completed", "cancelled"] as const;
export type EHallApplicationState = typeof EHALL_APPLICATION_STATES[number];

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
