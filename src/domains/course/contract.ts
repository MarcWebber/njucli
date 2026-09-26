export const COURSE_URLS = {
  app: "https://ehall.nju.edu.cn/appShow?appId=4770397878132218",
  index:
    "https://ehallapp.nju.edu.cn/jwapp/sys/wdkb/*default/index.do?_roleId=20230211151103310&EMAP_LANG=zh&THEME=",
  role:
    "https://ehallapp.nju.edu.cn/jwapp/sys/funauthapp/api/changeAppRole/wdkb/20230211151103310.do",
  terms:
    "https://ehallapp.nju.edu.cn/jwapp/sys/wdkb/modules/jshkcb/xnxqcx.do",
  currentTerm:
    "https://ehallapp.nju.edu.cn/jwapp/sys/wdkb/modules/jshkcb/dqxnxq.do",
  termDates:
    "https://ehallapp.nju.edu.cn/jwapp/sys/wdkb/modules/jshkcb/cxjcs.do",
  schedule:
    "https://ehallapp.nju.edu.cn/jwapp/sys/wdkb/modules/xskcb/cxxszhxqkb.do",
} as const;

export interface TermRow {
  DM: string;
  MC: string;
}

export interface TermDateRow {
  XN: string;
  XQ: string;
  XQKSRQ: string;
}

export interface CourseRow {
  JXBID: string;
  KCM: string;
  SKJS?: string | null;
  JASMC?: string | null;
  XXXQDM_DISPLAY?: string | null;
  KSJC: number;
  JSJC: number;
  SKXQ: number;
  SKZC: string;
}
