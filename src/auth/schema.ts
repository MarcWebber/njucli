import { z } from "zod";
import { AUTH_CAPABILITIES } from "./capabilities.js";

export const credentialsInput = z.object({ username: z.string().trim().min(1), password: z.string().min(1) });
export const capabilityInput = z.enum(AUTH_CAPABILITIES).optional();
export const intervalInput = z.number().int().min(1).max(2147483).default(600);
