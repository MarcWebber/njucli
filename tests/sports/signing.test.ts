import { describe, expect, it } from "vitest";

import {
  createSportsSignature,
  SPORTS_PUBLIC_APP_KEY,
} from "../../src/domains/sports/signing.js";

describe("sports request signing", () => {
  it("matches the fixed reference-code contract", () => {
    const timestamp = "1788739200000";
    const signature = createSportsSignature(
      "/api/reservation/day/info",
      [
        ["venueSiteId", "12"],
        ["searchDate", "2026-09-07"],
        ["hasReserveInfo", "1"],
        ["ignored", ""],
        ["nocache", timestamp],
      ],
      timestamp,
    );

    expect(signature).toBe("386675273d3a3d9ef45b45be6a123a9d");
    expect(SPORTS_PUBLIC_APP_KEY).toBe("8fceb735082b5a529312040b58ea780b");
  });
});
