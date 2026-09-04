import { describe, expect, it } from "vitest";

import type { FetchLike, FetchResponse } from "../../src/core/types.js";
import { EHallTimetableClient } from "../../src/domains/course/client.js";
import { COURSE_URLS } from "../../src/domains/course/contract.js";

function response(value: unknown, url: string): FetchResponse {
  return {
    ok: true,
    status: 200,
    url,
    text: async () => JSON.stringify(value),
  };
}

describe("EHallTimetableClient", () => {
  it("uses one fixed preparation path and the structured schedule contract", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetch: FetchLike = async (input, init) => {
      const url = input.toString();
      calls.push(init === undefined ? { url } : { url, init });
      if (url === COURSE_URLS.schedule) {
        return response({
          code: "0",
          datas: {
            cxxszhxqkb: {
              rows: [{
                JXBID: "class-1",
                KCM: "程序设计",
                KSJC: "3",
                JSJC: "4",
                SKXQ: "2",
                SKZC: "1010",
              }],
            },
          },
        }, url);
      }
      return response("ok", url);
    };

    const rows = await new EHallTimetableClient(fetch).listSchedule("2026-2027-1");

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ KCM: "程序设计", KSJC: 3, SKXQ: 2 });
    expect(calls.map((call) => call.url)).toEqual([
      COURSE_URLS.app,
      COURSE_URLS.index,
      COURSE_URLS.role,
      COURSE_URLS.schedule,
    ]);
    expect(calls[3]?.init?.body).toBe(
      "XNXQDM=2026-2027-1&pageSize=999&pageNumber=1",
    );
  });

  it("reports an authentication error after a redirect to authserver", async () => {
    const fetch: FetchLike = async () => response(
      "login",
      "https://authserver.nju.edu.cn/authserver/login",
    );

    await expect(new EHallTimetableClient(fetch).currentTerm()).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
      authCommand: "njucli auth login timetable",
    });
  });

  it("prepares the EHall app only once when one service operation reads in parallel", async () => {
    const calls: string[] = [];
    const fetch: FetchLike = async (input) => {
      const url = input.toString();
      calls.push(url);
      if (url === COURSE_URLS.terms) {
        return response({
          code: "0",
          datas: {
            xnxqcx: {
              rows: [{ DM: "2026-2027-1", MC: "第一学期" }],
            },
          },
        }, url);
      }
      if (url === COURSE_URLS.termDates) {
        return response({
          code: "0",
          datas: {
            cxjcs: {
              rows: [{ XN: "2026-2027", XQ: "1", XQKSRQ: "2026-08-31" }],
            },
          },
        }, url);
      }
      return response("ok", url);
    };
    const client = new EHallTimetableClient(fetch);

    await Promise.all([client.listTerms(), client.listTermDates()]);

    expect(calls.filter((url) => url === COURSE_URLS.app)).toHaveLength(1);
    expect(calls.filter((url) => url === COURSE_URLS.index)).toHaveLength(1);
    expect(calls.filter((url) => url === COURSE_URLS.role)).toHaveLength(1);
  });
});
