import { type SkillRuntime } from "../../../src/app/runtime.js";
import { type AuthCapability, AUTH_CAPABILITIES } from "../../../src/auth/types.js";
import { asAppError } from "../../../src/core/errors.js";
import { NjuOpacClient } from "../../njucli-library/scripts/client.js";

export type DoctorServices = () => Promise<DoctorResult>;

interface DoctorResult {
  account: string;
  authCapabilities: AuthCapability[];
  checks: Array<{
    name: string;
    ok: boolean;
    status?: number;
    code?: string;
    message?: string;
  }>;
}

export function createDoctorServices(runtime: SkillRuntime): DoctorServices {
  const { accountStore } = runtime;
  return async () => {
    const account = await accountStore.current();
    const checks: DoctorResult["checks"] = [];
    try {
      const response = await fetch("https://www.nju.edu.cn/");
      checks.push({ name: "nju-home", ok: response.ok, status: response.status });
    }
    catch (error) {
      checks.push({ name: "nju-home", ok: false, code: "REMOTE_UNAVAILABLE", message: asAppError(error).message });
    }
    try {
      await new NjuOpacClient(fetch).probe();
      checks.push({ name: "opac-direct", ok: true });
    }
    catch (error) {
      const appError = asAppError(error);
      checks.push({
        name: "opac-direct",
        ok: false,
        code: appError.code,
        message: appError.message,
      });
    }
    return {
      account: account.name,
      authCapabilities: [...AUTH_CAPABILITIES],
      checks,
    };
  };
}
