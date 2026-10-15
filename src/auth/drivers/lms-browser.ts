import type { AccountRecord } from "../../account/types.js";
import { AppError } from "../../core/errors.js";
import { withBrowserSession, type BrowserSession } from "../browser-session.js";
import type { AuthSessionDriver } from "../types.js";

const HOME = "https://lms.nju.edu.cn/user/index";

async function hasSession(session: BrowserSession): Promise<boolean> {
  const response = await session.request(HOME);
  if (response.status === 401 || response.status === 403) return false;
  if (!response.ok) throw new AppError("REMOTE_UNAVAILABLE", `智汇南雍登录检查返回 HTTP ${response.status}`);
  const url = new URL(response.url);
  if (url.origin !== new URL(HOME).origin || url.pathname !== "/user/index") return false;
  return /\bglobalData\s*=\s*\{\s*user\s*:\s*\{\s*id\s*:\s*\d+/.test(await response.text());
}

// The home page exchanges the existing CAS session through lms-identity.
const restore = (account: AccountRecord) => withBrowserSession(account, true, hasSession);

export const lmsSessionDriver = { login: restore, probe: restore } satisfies AuthSessionDriver;
