import { createHash } from "node:crypto";

export const SPORTS_API_BASE_URL = "https://ggtypt.nju.edu.cn/venue-server";

// Public client constants observed in reference code; neither value is a user secret.
export const SPORTS_PUBLIC_APP_KEY = "8fceb735082b5a529312040b58ea780b";
const SPORTS_PUBLIC_SIGNING_CONSTANT =
  "c640ca392cd45fb3a55b00a63a86c618";

export type SportsSignParameter = readonly [key: string, value: string];

export function createSportsSignature(
  path: string,
  parameters: readonly SportsSignParameter[],
  timestamp: string,
): string {
  const sorted = parameters
    .filter(([, value]) => value.length > 0)
    .slice()
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));

  const payload = [
    SPORTS_PUBLIC_SIGNING_CONSTANT,
    path,
    ...sorted.flatMap(([key, value]) => [key, value]),
    timestamp,
    " ",
    SPORTS_PUBLIC_SIGNING_CONSTANT,
  ].join("");

  return createHash("md5").update(payload, "utf8").digest("hex");
}
