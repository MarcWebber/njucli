import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { AppError } from "../../src/core/errors.js";
import type { Clock, FetchLike, FetchResponse } from "../../src/core/types.js";
import { SportsClient } from "../../src/domains/sports/client.js";

const fixedClock: Clock = {
  now: () => new Date("2026-09-07T00:00:00.000Z"),
};

describe("SportsClient", () => {
  it("parses venues and one venue into stable DTOs", async () => {
    const client = clientWithFixtures(["venue-catalog.json", "venue-detail.json"]);

    const catalog = await client.listVenues(7);
    const venue = await client.getVenue(12);

    expect(catalog[0]).toMatchObject({
      siteId: "12",
      campus: "仙林校区",
      venue: "方肇周体育馆",
      name: "羽毛球场",
      sport: "羽毛球",
    });
    expect(venue).toEqual(catalog[0]);
  });

  it("signs GET requests and computes availability from individual spaces", async () => {
    const calls: CapturedCall[] = [];
    const client = clientWithFixtures(["slots.json"], calls);

    const schedule = await client.listSlots(12, "2026-09-07");

    expect(schedule.slots).toHaveLength(2);
    expect(schedule.slots[0]?.spaces.map((space) => space.state)).toEqual([
      "available",
      "occupied",
      "unavailable",
    ]);
    expect(schedule.slots[1]?.spaces.filter((space) => space.state === "available")).toHaveLength(2);

    const call = calls[0]!;
    expect(call.url.origin + call.url.pathname).toBe(
      "https://ggtypt.nju.edu.cn/venue-server/api/reservation/day/info",
    );
    expect(Object.fromEntries(call.url.searchParams)).toMatchObject({
      venueSiteId: "12",
      searchDate: "2026-09-07",
      hasReserveInfo: "1",
      nocache: "1788739200000",
    });
    expect(call.headers.get("cgAuthorization")).toBe("sports-access-token");
    expect(call.headers.get("app-key")).toBe(
      "8fceb735082b5a529312040b58ea780b",
    );
    expect(call.headers.get("timestamp")).toBe("1788739200000");
    expect(call.headers.get("sign")).toBe(
      "386675273d3a3d9ef45b45be6a123a9d",
    );
  });

  it("maps booking status without inventing unknown states", async () => {
    const client = clientWithFixtures(["bookings.json", "booking.json"]);

    const page = await client.listBookings();
    const detail = await client.getBooking(1234);

    expect(page.map((booking) => booking.status)).toEqual([
      "active",
      "cancelled",
    ]);
    expect(detail).toMatchObject({
      bookingId: "1234",
      status: "active",
      campus: "仙林校区",
      venue: "方肇周体育馆",
      site: "羽毛球场",
    });
  });

  it("fails explicitly when the fixed response schema drifts", async () => {
    const client = clientWithFixtures(["slots-schema-drift.json"]);

    await expect(
      client.listSlots(12, "2026-09-07"),
    ).rejects.toMatchObject<AppError>({
      code: "REMOTE_SCHEMA_CHANGED",
    });
  });
});

interface CapturedCall {
  url: URL;
  headers: Headers;
}

function clientWithFixtures(
  fixtureNames: string[],
  calls: CapturedCall[] = [],
): SportsClient {
  return new SportsClient(
    fixtureFetch(fixtureNames, calls),
    "sports-access-token",
    fixedClock,
  );
}

function fixtureFetch(
  fixtureNames: string[],
  calls: CapturedCall[],
): FetchLike {
  let index = 0;
  return async (input, init): Promise<FetchResponse> => {
    const fixtureName = fixtureNames[index++];
    if (!fixtureName) throw new Error("fixture queue exhausted");
    const body = await readFile(
      new URL(`./fixtures/${fixtureName}`, import.meta.url),
      "utf8",
    );
    calls.push({
      url: new URL(input.toString()),
      headers: new Headers(init?.headers),
    });
    return {
      ok: true,
      status: 200,
      url: input.toString(),
      text: async () => body,
    };
  };
}
