import { z } from "zod";

import { AppError } from "../../core/errors.js";
import type {
  SportsBookingSummary,
  SportsSlotSchedule,
  SportsVenueSiteSummary,
} from "./types.js";

const remoteIdSchema = z.union([z.string().min(1), z.number().finite()]);
const optionalRemoteIdSchema = remoteIdSchema.nullish();
const optionalStringSchema = z.string().nullish();

const envelopeSchema = z
  .object({
    code: z.number().int(),
    data: z.unknown().optional(),
    message: z.string().nullish(),
  });

const venueSiteSchema = z
  .object({
    id: remoteIdSchema,
    campusName: z.string(),
    venueName: z.string(),
    siteName: z.string().min(1),
    sportName: optionalStringSchema,
    sportType: optionalRemoteIdSchema,
    openStartDate: optionalStringSchema,
    openEndDate: optionalStringSchema,
  });

const venueCatalogSchema = z
  .object({
    venueSiteInfo: z.record(z.string(), z.array(venueSiteSchema)),
  });

const timeInfoSchema = z
  .object({
    id: remoteIdSchema,
    beginTime: z.string().min(1),
    endTime: z.string().min(1),
  });

const spaceSchema = z
  .object({
    spaceName: z.string().min(1),
  }).passthrough();

const reservationCellSchema = z
  .object({
    reservationStatus: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
    ]),
  });

const slotScheduleSchema = z
  .object({
    spaceTimeInfo: z.array(timeInfoSchema),
    reservationDateSpaceInfo: z.record(z.string(), z.array(spaceSchema)),
  });

const bookingSummarySchema = z
  .object({
    id: remoteIdSchema,
    campusName: optionalStringSchema,
    venueName: optionalStringSchema,
    siteName: optionalStringSchema,
    reservationDate: z.string().min(1),
    reservationDateDetail: optionalStringSchema,
    orderStatus: z.union([z.literal(1), z.literal(2)]),
  });

const bookingPageSchema = z
  .object({
    content: z.array(bookingSummarySchema),
  });

const bookingDetailSchema = z
  .object({
    orderInfo: z.object({
      reservationDate: z.string().min(1),
      reservationDateDetail: optionalStringSchema,
      orderStatus: z.union([z.literal(1), z.literal(2)]),
    }),
    venueInfoBean: z
      .object({
        campusName: z.string().min(1),
        venueName: z.string().min(1),
        siteName: z.string().min(1),
      }),
  });

export function unwrapSportsEnvelope(value: unknown, path: string): unknown {
  const envelope = envelopeSchema.parse(value);
  if (envelope.code === 200) return envelope.data;
  if (envelope.code === 401 || envelope.code === 403) {
    throw new AppError("AUTH_EXPIRED", "体育场馆登录已失效", {
      hint: "运行 njucli auth login sports",
      authCommand: "njucli auth login sports",
    });
  }
  throw new Error(envelope.message ?? `体育场馆接口错误 ${envelope.code}: ${path}`);
}

export function parseVenueCatalog(value: unknown): SportsVenueSiteSummary[] {
  const data = venueCatalogSchema.parse(value);
  const sites = Object.values(data.venueSiteInfo)
    .flat()
    .map(toVenueSite)
    .sort(compareVenueSites);

  return sites;
}

export function parseVenueDetail(value: unknown): SportsVenueSiteSummary {
  return toVenueSite(venueSiteSchema.parse(value));
}

export function parseSlotSchedule(
  value: unknown,
  date: string,
): SportsSlotSchedule {
  const data = slotScheduleSchema.parse(value);
  const spaces = data.reservationDateSpaceInfo[date] ?? [];
  const slots = data.spaceTimeInfo.map((time) => {
    const timeId = idString(time.id);
    const parsedSpaces: SportsSlotSchedule["slots"][number]["spaces"] = [];

    for (const space of spaces) {
      const rawCell = space[timeId];
      if (rawCell === undefined) continue;
      const cell = reservationCellSchema.parse(rawCell);
      parsedSpaces.push({
        name: space.spaceName,
        state: mapReservationStatus(cell.reservationStatus),
      });
    }

    parsedSpaces.sort((left, right) =>
      left.name.localeCompare(right.name, "zh-CN"),
    );
    return {
      startAt: time.beginTime,
      endAt: time.endTime,
      spaces: parsedSpaces,
    };
  });

  return {
    date,
    slots,
  };
}

export function parseBookingPage(value: unknown): SportsBookingSummary[] {
  const data = bookingPageSchema.parse(value);
  return data.content.map(toBookingSummary);
}

export function parseBookingDetail(
  value: unknown,
  requestedBookingId: string,
): SportsBookingSummary {
  const data = bookingDetailSchema.parse(value);
  return {
    bookingId: requestedBookingId,
    campus: data.venueInfoBean.campusName,
    venue: data.venueInfoBean.venueName,
    site: data.venueInfoBean.siteName,
    reservationDate: data.orderInfo.reservationDate,
    reservationDetail: data.orderInfo.reservationDateDetail ?? null,
    status: mapOrderStatus(data.orderInfo.orderStatus),
  };
}

function mapReservationStatus(
  code: 1 | 2 | 3 | 4,
): SportsSlotSchedule["slots"][number]["spaces"][number]["state"] {
  return RESERVATION_STATES[code];
}

function mapOrderStatus(code: 1 | 2): SportsBookingSummary["status"] {
  return BOOKING_STATES[code];
}

const RESERVATION_STATES = {
  1: "available",
  2: "unavailable",
  3: "unpaid",
  4: "occupied",
} as const;

const BOOKING_STATES = {
  1: "active",
  2: "cancelled",
} as const;

function toVenueSite(data: z.infer<typeof venueSiteSchema>): SportsVenueSiteSummary {
  return {
    siteId: idString(data.id),
    campus: data.campusName,
    venue: data.venueName,
    name: data.siteName,
    sportId: nullableId(data.sportType),
    sport: data.sportName ?? null,
    openStart: data.openStartDate ?? null,
    openEnd: data.openEndDate ?? null,
  };
}

function toBookingSummary(
  data: z.infer<typeof bookingSummarySchema>,
): SportsBookingSummary {
  return {
    bookingId: idString(data.id),
    campus: data.campusName ?? null,
    venue: data.venueName ?? null,
    site: data.siteName ?? null,
    reservationDate: data.reservationDate,
    reservationDetail: data.reservationDateDetail ?? null,
    status: mapOrderStatus(data.orderStatus),
  };
}

function idString(value: string | number): string {
  return String(value);
}

function nullableId(value: string | number | null | undefined): string | null {
  return value === undefined || value === null ? null : idString(value);
}

function compareVenueSites(
  left: SportsVenueSiteSummary,
  right: SportsVenueSiteSummary,
): number {
  return left.campus.localeCompare(right.campus, "zh-CN") ||
    left.venue.localeCompare(right.venue, "zh-CN") ||
    left.name.localeCompare(right.name, "zh-CN") ||
    left.siteId.localeCompare(right.siteId);
}
