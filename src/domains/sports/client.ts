import { AppError } from "../../core/errors.js";
import { parseCampusDate } from "../../core/dates.js";
import type { FetchLike, FetchResponse } from "../../core/types.js";
import {
  parseBookingDetail,
  parseBookingPage,
  parseSlotSchedule,
  parseVenueCatalog,
  parseVenueDetail,
  unwrapSportsEnvelope,
} from "./parsers.js";
import {
  createSportsSignature,
  SPORTS_API_BASE_URL,
  SPORTS_PUBLIC_APP_KEY,
  type SportsSignParameter,
} from "./signing.js";
import type {
  SportsBookingSummary,
  SportsSlotSchedule,
  SportsVenueSiteSummary,
} from "./types.js";

export class SportsClient {
  constructor(
    private readonly fetch: FetchLike,
    private readonly accessToken: string,
  ) {}

  async listVenues(
    sportType?: string | number,
  ): Promise<SportsVenueSiteSummary[]> {
    const query: SportsSignParameter[] = [];
    if (sportType !== undefined) {
      query.push(["sportType", requiredId(sportType, "sportType")]);
    }
    const data = await this.get(
      "/api/reservation/campus/venue/info",
      query,
    );
    return parseVenueCatalog(data);
  }

  async getVenue(
    venueSiteId: string | number,
  ): Promise<SportsVenueSiteSummary> {
    const id = requiredId(venueSiteId, "venueSiteId");
    const data = await this.get(
      `/api/front/website/venue_sites/${encodeURIComponent(id)}`,
      [],
    );
    return parseVenueDetail(data);
  }

  async listSlots(
    venueSiteIdInput: string | number,
    dateInput: string,
  ): Promise<SportsSlotSchedule> {
    const venueSiteId = requiredId(venueSiteIdInput, "venueSiteId");
    const date = parseCampusDate(dateInput);
    const query: SportsSignParameter[] = [
      ["venueSiteId", venueSiteId],
      ["searchDate", date],
      ["hasReserveInfo", "1"],
    ];
    const data = await this.get(
      "/api/reservation/day/info",
      query,
    );
    return parseSlotSchedule(data, date);
  }

  async listBookings(
    page = 0,
    size = 20,
  ): Promise<SportsBookingSummary[]> {
    const data = await this.get(
      "/api/orders/mine",
      [
        ["page", String(page)],
        ["size", String(size)],
      ],
    );
    return parseBookingPage(data);
  }

  async getBooking(
    orderId: string | number,
  ): Promise<SportsBookingSummary> {
    const id = requiredId(orderId, "orderId");
    const data = await this.get(
      `/api/orders/${encodeURIComponent(id)}`,
      [],
    );
    return parseBookingDetail(data, id);
  }

  private async get(
    path: string,
    query: readonly SportsSignParameter[],
  ): Promise<unknown> {
    const timestamp = String(Date.now());
    const signedQuery: SportsSignParameter[] = [
      ...query,
      ["nocache", timestamp],
    ];
    const url = new URL(`${SPORTS_API_BASE_URL}${path}`);
    for (const [key, value] of signedQuery) url.searchParams.append(key, value);
    const headers = new Headers({
      "app-key": SPORTS_PUBLIC_APP_KEY,
      timestamp,
      sign: createSportsSignature(path, signedQuery, timestamp),
      cgAuthorization: this.accessToken,
    });

    const response = await this.fetch(url, { method: "GET", headers });
    assertHttpResponse(response, path);
    return unwrapSportsEnvelope(JSON.parse(await response.text()), path);
  }
}

function assertHttpResponse(response: FetchResponse, path: string): void {
  if (response.ok) return;
  if (response.status === 401 || response.status === 403) {
    throw new AppError("AUTH_EXPIRED", "体育场馆登录已失效", {
      hint: "运行 njucli auth login sports 重新登录",
      authCommand: "njucli auth login sports",
      details: { path, status: response.status },
    });
  }
  throw new Error(`体育场馆服务返回 HTTP ${response.status}: ${path}`);
}

function requiredId(value: string | number, field: string): string {
  const normalized = String(value).trim();
  if (normalized.length === 0) {
    throw new Error(`${field} 不能为空`);
  }
  return normalized;
}
