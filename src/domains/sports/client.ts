import { AppError } from "../../core/errors.js";
import { parseCampusDate } from "../../core/dates.js";
import {
  systemClock,
  type Clock,
  type FetchLike,
  type FetchResponse,
} from "../../core/types.js";
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
    private readonly clock: Clock = systemClock,
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
    const date = parseCampusDate(dateInput, this.clock.now());
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
    pageInput = 0,
    sizeInput = 20,
  ): Promise<SportsBookingSummary[]> {
    const page = pageNumber(pageInput, "page", 0);
    const size = pageNumber(sizeInput, "size", 1);
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
    const timestamp = String(Math.trunc(this.clock.now().getTime()));
    const signedQuery: SportsSignParameter[] = [
      ...query,
      ["nocache", timestamp],
    ];
    if (this.accessToken.trim().length === 0) {
      throw new AppError("AUTH_REQUIRED", "体育场馆访问令牌不可用", {
        hint: "运行 njucli auth login sports",
        authCommand: "njucli auth login sports",
      });
    }

    const url = new URL(`${SPORTS_API_BASE_URL}${path}`);
    for (const [key, value] of signedQuery) url.searchParams.append(key, value);
    const headers = new Headers({
      "app-key": SPORTS_PUBLIC_APP_KEY,
      timestamp,
      sign: createSportsSignature(path, signedQuery, timestamp),
      cgAuthorization: this.accessToken,
    });

    let response: FetchResponse;
    try {
      response = await this.fetch(url, {
        method: "GET",
        headers,
      });
    } catch (error) {
      throw new AppError("REMOTE_UNAVAILABLE", "无法连接体育场馆服务", {
        cause: error,
        details: { path },
      });
    }
    assertHttpResponse(response, path);

    let payload: unknown;
    try {
      const body = await response.text();
      if (body.trim().length === 0) throw new Error("empty response body");
      payload = JSON.parse(body) as unknown;
    } catch (error) {
      throw new AppError("REMOTE_SCHEMA_CHANGED", "体育场馆接口没有返回有效 JSON", {
        cause: error,
        details: { path, status: response.status },
      });
    }
    return unwrapSportsEnvelope(payload, path);
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
  if (response.status === 429) {
    throw new AppError("RATE_LIMITED", "体育场馆服务请求过于频繁", {
      details: { path, status: response.status },
    });
  }
  throw new AppError("REMOTE_UNAVAILABLE", "体育场馆服务返回错误", {
    details: { path, status: response.status },
  });
}

function requiredId(value: string | number, field: string): string {
  const normalized = String(value).trim();
  if (normalized.length === 0) {
    throw new AppError("INVALID_INPUT", `${field} 不能为空`, {
      details: { field },
    });
  }
  return normalized;
}

function pageNumber(value: number, field: string, minimum: number): number {
  if (!Number.isInteger(value) || value < minimum) {
    throw new AppError("INVALID_INPUT", `${field} 必须是不小于 ${minimum} 的整数`, {
      details: { field, value },
    });
  }
  return value;
}
