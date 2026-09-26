import { AppError } from "../../core/errors.js";
import { parseCampusDate } from "../../core/dates.js";
import type { FetchLike } from "../../core/types.js";
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

type RemoteId = string | number;
interface Venue {
  id: RemoteId;
  campusName: string;
  venueName: string;
  siteName: string;
  sportName?: string | null;
  sportType?: RemoteId | null;
  openStartDate?: string | null;
  openEndDate?: string | null;
}
interface Booking {
  id: RemoteId;
  campusName?: string | null;
  venueName?: string | null;
  siteName?: string | null;
  reservationDate: string;
  reservationDateDetail?: string | null;
  orderStatus: 1 | 2;
}
interface SlotSchedule {
  spaceTimeInfo: { id: RemoteId; beginTime: string; endTime: string }[];
  reservationDateSpaceInfo: Record<string, ({ spaceName: string } & Record<string, unknown>)[]>;
}
const RESERVATION_STATES = { 1: "available", 2: "unavailable", 3: "unpaid", 4: "occupied" } as const;
const BOOKING_STATES = { 1: "active", 2: "cancelled" } as const;

export class SportsClient {
  constructor(private readonly fetch: FetchLike, private readonly accessToken: string) {}

  async listVenues(sportType?: string | number): Promise<SportsVenueSiteSummary[]> {
    const query: SportsSignParameter[] = sportType === undefined ? [] : [["sportType", String(sportType).trim()]];
    const data = await this.get<{ venueSiteInfo: Record<string, Venue[]> }>("/api/reservation/campus/venue/info", query);
    return Object.values(data.venueSiteInfo).flat().map(venue).sort((left, right) =>
      left.campus.localeCompare(right.campus, "zh-CN") ||
      left.venue.localeCompare(right.venue, "zh-CN") ||
      left.name.localeCompare(right.name, "zh-CN") ||
      left.siteId.localeCompare(right.siteId));
  }

  async getVenue(venueSiteId: string | number): Promise<SportsVenueSiteSummary> {
    return venue(await this.get<Venue>(`/api/front/website/venue_sites/${encodeURIComponent(String(venueSiteId).trim())}`));
  }

  async listSlots(venueSiteId: string | number, dateInput: string): Promise<SportsSlotSchedule> {
    const date = parseCampusDate(dateInput);
    const data = await this.get<SlotSchedule>("/api/reservation/day/info", [
      ["venueSiteId", String(venueSiteId).trim()], ["searchDate", date], ["hasReserveInfo", "1"],
    ]);
    const spaces = data.reservationDateSpaceInfo[date] ?? [];
    return {
      date,
      slots: data.spaceTimeInfo.map((time) => ({
        startAt: time.beginTime,
        endAt: time.endTime,
        spaces: spaces.flatMap((space) => {
          const cell = space[String(time.id)] as { reservationStatus: keyof typeof RESERVATION_STATES } | undefined;
          return cell ? [{ name: space.spaceName, state: RESERVATION_STATES[cell.reservationStatus] }] : [];
        }).sort((left, right) => left.name.localeCompare(right.name, "zh-CN")),
      })),
    };
  }

  async listBookings(page = 0, size = 20): Promise<SportsBookingSummary[]> {
    const data = await this.get<{ content: Booking[] }>("/api/orders/mine", [
      ["page", String(page)], ["size", String(size)],
    ]);
    return data.content.map(booking);
  }

  async getBooking(orderId: string | number): Promise<SportsBookingSummary> {
    const id = String(orderId).trim();
    const { orderInfo, venueInfoBean } = await this.get<{
      orderInfo: Pick<Booking, "reservationDate" | "reservationDateDetail" | "orderStatus">;
      venueInfoBean: Pick<Venue, "campusName" | "venueName" | "siteName">;
    }>(`/api/orders/${encodeURIComponent(id)}`);
    return {
      bookingId: id,
      campus: venueInfoBean.campusName,
      venue: venueInfoBean.venueName,
      site: venueInfoBean.siteName,
      reservationDate: orderInfo.reservationDate,
      reservationDetail: orderInfo.reservationDateDetail ?? null,
      status: BOOKING_STATES[orderInfo.orderStatus],
    };
  }

  private async get<T>(path: string, query: readonly SportsSignParameter[] = []): Promise<T> {
    const timestamp = String(Date.now());
    const signedQuery: SportsSignParameter[] = [...query, ["nocache", timestamp]];
    const url = new URL(`${SPORTS_API_BASE_URL}${path}`);
    for (const [key, value] of signedQuery) url.searchParams.append(key, value);
    const response = await this.fetch(url, {
      method: "GET",
      headers: new Headers({
        "app-key": SPORTS_PUBLIC_APP_KEY,
        timestamp,
        sign: createSportsSignature(path, signedQuery, timestamp),
        cgAuthorization: this.accessToken,
      }),
    });
    if (response.status === 401 || response.status === 403) throw authRequired();
    if (!response.ok) throw new Error(`体育场馆服务返回 HTTP ${response.status}: ${path}`);
    const result = JSON.parse(await response.text()) as { code: number; data: T; message?: string };
    if (result.code === 401 || result.code === 403) throw authRequired();
    if (result.code !== 200) throw new Error(result.message ?? `体育场馆接口错误 ${result.code}: ${path}`);
    return result.data;
  }
}

function venue(data: Venue): SportsVenueSiteSummary {
  return {
    siteId: String(data.id),
    campus: data.campusName,
    venue: data.venueName,
    name: data.siteName,
    sportId: data.sportType == null ? null : String(data.sportType),
    sport: data.sportName ?? null,
    openStart: data.openStartDate ?? null,
    openEnd: data.openEndDate ?? null,
  };
}

function booking(data: Booking): SportsBookingSummary {
  return {
    bookingId: String(data.id),
    campus: data.campusName ?? null,
    venue: data.venueName ?? null,
    site: data.siteName ?? null,
    reservationDate: data.reservationDate,
    reservationDetail: data.reservationDateDetail ?? null,
    status: BOOKING_STATES[data.orderStatus],
  };
}

function authRequired(): AppError {
  return new AppError("AUTH_EXPIRED", "体育场馆登录已失效", { authCommand: "njucli auth login sports" });
}
