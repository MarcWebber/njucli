import { AppError } from "../../../src/core/errors.js";
import { parseCampusDate } from "../../../src/core/dates.js";
import type { FetchLike, FetchResponse } from "../../../src/core/types.js";
import type { ReservationInput, ReserveInput } from "./input.js";
import type { SportsIdentity } from "../../../src/auth/sports-token.js";
import {
  sportsHeaders,
  SPORTS_API_BASE_URL,
  type SportsSignParameter,
} from "./signing.js";
import {
  BOOKING_STATES,
  RESERVATION_STATES,
  type SportsBookingSummary,
  type SportsSlotSchedule,
  type SportsVenueSiteSummary,
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
  tradeNo?: string;
  orderRoleId?: RemoteId;
  orderUserId?: RemoteId;
  campusName?: string | null;
  venueName?: string | null;
  siteName?: string | null;
  reservationDate: string;
  reservationDateDetail?: string | null;
  orderStatus: keyof typeof BOOKING_STATES;
}
interface SlotSchedule {
  spaceTimeInfo: { id: RemoteId; beginTime: string; endTime: string }[];
  reservationDateSpaceInfo: Record<string, ({ id: RemoteId; spaceName: string; venueSpaceGroupId?: RemoteId } & Record<string, unknown>)[]>;
  reservationDateList: string[];
  token: string;
  orderParamView: { isCaptchaCheck: number; isForceBindMobile: number };
  siteParam: { buddyNumMin: number; buddyNumMax: number };
}

export class SportsClient {
  constructor(private readonly fetch: FetchLike, private readonly accessToken: string, private readonly identity?: SportsIdentity) {}

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
      reservationDates: data.reservationDateList,
      requiresVerification: data.orderParamView.isCaptchaCheck === 1,
      boundMobileRequired: data.orderParamView.isForceBindMobile === 1,
      buddyMin: data.siteParam.buddyNumMin,
      buddyMax: data.siteParam.buddyNumMax,
      slots: data.spaceTimeInfo.map((time) => ({
        timeId: String(time.id),
        startAt: time.beginTime,
        endAt: time.endTime,
        spaces: spaces.flatMap((space) => {
          const cell = space[String(time.id)] as { reservationStatus: keyof typeof RESERVATION_STATES; orderFee?: number } | undefined;
          return cell ? [{ spaceId: String(space.id), groupId: space.venueSpaceGroupId == null ? null : String(space.venueSpaceGroupId), name: space.spaceName, state: RESERVATION_STATES[cell.reservationStatus], fee: cell.orderFee ?? null }] : [];
        }).sort((left, right) => left.name.localeCompare(right.name, "zh-CN")),
      })),
    };
  }

  async listBookings(page = 0, size = 20): Promise<SportsBookingSummary[]> {
    if (!this.identity) throw new AppError("AUTH_CAPABILITY_UNKNOWN", "缺少体育登录身份，无法核对本人订单");
    const data = await this.get<{ content: Booking[] }>("/api/orders/mine", [
      ["page", String(page)], ["size", String(size)],
    ]);
    // The official mine list includes orders where the user is a companion.
    // Only the creator's matching role/userId receives the detail/action buttons.
    return data.content.filter(item => String(item.orderRoleId) === String(this.identity!.role)
      && String(item.orderUserId) === String(this.identity!.userId)).map(booking);
  }

  async getBooking(orderId: string | number): Promise<SportsBookingSummary> {
    const id = String(orderId).trim();
    const { orderInfo, venueInfoBean } = await this.get<{
      orderInfo: Pick<Booking, "reservationDate" | "reservationDateDetail" | "orderStatus">;
      venueInfoBean: Pick<Venue, "campusName" | "venueName" | "siteName">;
    }>(`/api/orders/${encodeURIComponent(id)}`);
    return booking({
      id,
      campusName: venueInfoBean.campusName,
      venueName: venueInfoBean.venueName,
      siteName: venueInfoBean.siteName,
      reservationDate: orderInfo.reservationDate,
      reservationDateDetail: orderInfo.reservationDateDetail ?? null,
      orderStatus: orderInfo.orderStatus,
    });
  }

  async reservationInfo(input: ReservationInput): Promise<Record<string, unknown>> {
    return this.post("/api/reservation/order/info", await this.reservationParameters(input));
  }

  async reserve(input: ReserveInput): Promise<{ tradeNo: string; order: Record<string, unknown> }> {
    const data = await this.post<{ tradeNo?: string }>("/api/reservation/order/submit", {
      ...await this.reservationParameters(input), totalAmt: input.totalAmt, orderPrice: input.orderPrice,
      orderPin: input.orderPin, phone: input.phone, addBuddyType: input.addBuddyType,
      buddyIds: input.buddyIds?.join(","), buddyUids: input.buddyUids?.join(","),
      manNum: input.manNum, childNum: input.childNum, sportType: input.sportType,
      captchaVerification: input.captchaVerification, captchaToken: input.captchaToken,
    });
    if (!data.tradeNo) throw new AppError("REMOTE_SCHEMA_CHANGED", "预约响应未返回订单号，未确认创建成功");
    try { return { tradeNo: data.tradeNo, order: await this.finance(data.tradeNo) }; }
    catch (cause) { throw new AppError("REMOTE_UNAVAILABLE", "预约接口已返回订单号，回读失败；请按订单号查询并取消", { cause, details: { tradeNo: data.tradeNo } }); }
  }

  async finance(tradeNo: string): Promise<Record<string, unknown>> {
    return this.get("/api/venue/finances/order/detail", [["venueTradeNo", tradeNo]]);
  }

  async confirmFree(tradeNo: string): Promise<Record<string, unknown>> {
    const before = await this.finance(tradeNo);
    if (before.payFee == null || Number(before.payFee) !== 0) throw new AppError("INVALID_INPUT", "零元确认只接受学校回读 payFee=0 的订单");
    await this.post("/api/venue/finances/order/pay", {
      venueTradeNo: tradeNo, payType: null, paySecret: null, cardNo: null, outTradeNo: null,
      couponId: null, amtEndDate: before.amtEndDate as string | null, isApp: 0,
      payRemark: null, isWeChat: null, openidKey: null, offlinePayType: null,
    });
    const after = await this.finance(tradeNo);
    if (after.orderStatus !== 1 || after.payStatus !== 2) throw new AppError("REMOTE_UNAVAILABLE", "已请求零元确认，回读状态未确认完成", { details: { tradeNo } });
    return after;
  }

  async cancel(tradeNo: string, reason = ""): Promise<Record<string, unknown>> {
    await this.finance(tradeNo);
    await this.post("/api/venue/finances/order/cancel", { venueTradeNo: tradeNo, remark: reason });
    const after = await this.finance(tradeNo);
    if (after.orderStatus !== 2) throw new AppError("REMOTE_UNAVAILABLE", "已请求取消预约，回读状态未确认取消", { details: { tradeNo } });
    return after;
  }

  private async reservationParameters(input: ReservationInput): Promise<Record<string, string | number | null | undefined>> {
    const date = parseCampusDate(input.date);
    const token = input.token ?? (await this.get<SlotSchedule>("/api/reservation/day/info", [
      ["venueSiteId", String(input.venueSiteId)], ["searchDate", date], ["hasReserveInfo", "1"],
    ])).token;
    if (!token) throw new AppError("REMOTE_SCHEMA_CHANGED", "体育时段接口未返回当次请求参数");
    return {
      venueSiteId: String(input.venueSiteId), reservationDate: date,
      weekStartDate: parseCampusDate(input.weekStartDate),
      reservationOrderJson: JSON.stringify(input.slots), reservationType: input.reservationType ?? null,
      token,
    };
  }

  private async post<T>(path: string, data: Record<string, string | number | null | undefined>): Promise<T> {
    const timestamp = String(Date.now());
    const parameters: SportsSignParameter[] = Object.entries(data).flatMap(([key, value]) => value == null ? [] : [[key, String(value)] as SportsSignParameter]);
    const response = await this.fetch(`${SPORTS_API_BASE_URL}${path}`, {
      method: "POST", headers: {
        ...sportsHeaders(path, parameters, timestamp), cgAuthorization: this.accessToken,
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      }, body: new URLSearchParams(parameters.map(([key, value]) => [key, value])).toString(),
    });
    return this.result<T>(response, path);
  }

  private async get<T>(path: string, query: readonly SportsSignParameter[] = []): Promise<T> {
    const timestamp = String(Date.now());
    const signedQuery: SportsSignParameter[] = [...query, ["nocache", timestamp]];
    const url = new URL(`${SPORTS_API_BASE_URL}${path}`);
    for (const [key, value] of signedQuery) url.searchParams.append(key, value);
    const response = await this.fetch(url, {
      method: "GET",
      headers: new Headers({
        ...sportsHeaders(path, signedQuery, timestamp),
        cgAuthorization: this.accessToken,
      }),
    });
    return this.result<T>(response, path);
  }

  private async result<T>(response: FetchResponse, path: string): Promise<T> {
    if (response.status === 401 || response.status === 403) throw authRequired();
    if (!response.ok) throw new Error(`体育场馆服务返回 HTTP ${response.status}: ${path}`);
    let result: { code: number; data: T; message?: string };
    try { result = JSON.parse(await response.text()) as typeof result; }
    catch (cause) { throw new AppError("REMOTE_SCHEMA_CHANGED", "体育场馆接口未返回 JSON", { cause, details: { path } }); }
    if (result.code === 401 || result.code === 403) throw authRequired();
    if (result.code !== 200) throw new AppError("REMOTE_UNAVAILABLE", result.message ?? `体育场馆接口错误 ${result.code}: ${path}`, { details: { remoteCode: result.code, path } });
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
    tradeNo: data.tradeNo ?? null,
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
