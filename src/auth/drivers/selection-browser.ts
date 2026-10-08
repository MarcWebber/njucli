import type { AccountRecord } from "../../account/types.js";
import {
  COURSE_SELECTION_HOME_URL,
  COURSE_SELECTION_LOGOUT_URL,
  GraduateCourseSelectionClient,
} from "../../../skills/njucli-course/scripts/selection-client.js";
import {
  withBrowserSession,
} from "../browser-session.js";
import type { AuthSessionDriver } from "../types.js";

const COURSE_PAGE_PATH = "/yjsxkapp/sys/xsxkapp/course_nju.html";

export const selectionSessionDriver = {
  login(account: AccountRecord): Promise<boolean> {
    return withBrowserSession(account, false, async (session) => {
      await session.login(COURSE_SELECTION_HOME_URL, isCoursePage);
      if (!await new GraduateCourseSelectionClient(session.request).hasSession()) {
        throw new Error("研究生选课登录未完成，请在学校页面手动完成验证码");
      }
      return true;
    });
  },

  probe(account: AccountRecord): Promise<boolean> {
    return withBrowserSession(account, true, async (session) => {
      return new GraduateCourseSelectionClient(session.request).hasSession();
    });
  },

  logout(account: AccountRecord): Promise<void> {
    return withBrowserSession(account, true, async (session) => {
      await (await session.page()).goto(COURSE_SELECTION_LOGOUT_URL, { waitUntil: "domcontentloaded" });
    });
  },
} satisfies AuthSessionDriver;

function isCoursePage(url: URL): boolean {
  return url.hostname === "yjsxk.nju.edu.cn" && url.pathname === COURSE_PAGE_PATH;
}
