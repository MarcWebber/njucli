import { z } from "zod";

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

const integerFromRemote = z.coerce.number().int();
const optionalString = z.string().nullish();

export const termRowSchema = z.object({
  DM: z.string().min(1),
  MC: z.string().min(1),
});

export const termDateRowSchema = z.object({
  XN: z.string().min(1),
  XQ: z.string().min(1),
  XQKSRQ: z.string().min(10),
});

export const courseRowSchema = z.object({
  JXBID: z.string().min(1),
  KCM: z.string().min(1),
  SKJS: optionalString,
  JASMC: optionalString,
  XXXQDM_DISPLAY: optionalString,
  KSJC: integerFromRemote,
  JSJC: integerFromRemote,
  SKXQ: integerFromRemote,
  SKZC: z.string().regex(/^[01]+$/),
});

export type TermRow = z.infer<typeof termRowSchema>;
export type TermDateRow = z.infer<typeof termDateRowSchema>;
export type CourseRow = z.infer<typeof courseRowSchema>;

export function pageEnvelopeSchema<T extends z.ZodType>(
  action: string,
  row: T,
): z.ZodType<{
  code: string;
  datas: Record<string, { rows: z.infer<T>[] }>;
}> {
  return z.object({
    code: z.coerce.string(),
    datas: z.record(
      z.string(),
      z.object({
        rows: z.array(row),
      }),
    ).refine((datas) => action in datas, {
      message: `response is missing datas.${action}`,
    }),
  }) as z.ZodType<{
    code: string;
    datas: Record<string, { rows: z.infer<T>[] }>;
  }>;
}
