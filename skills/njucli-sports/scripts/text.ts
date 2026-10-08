import type { SportsBookingSummary, SportsReservationLink, SportsSlotSchedule, SportsVenueSiteSummary } from "./types.js";

const NONE = "无";

export function sportsVenuesText(sites: SportsVenueSiteSummary[]): string {
  if (sites.length === 0)
    return NONE;
  return sites.map((site) => {
    const sport = site.sportId === null
      ? (site.sport ?? "运动未知")
      : `${site.sport ?? "运动"} (${site.sportId})`;
    return `${site.campus}\t${site.venue}\t${site.name}\t${sport}\t${site.siteId}`;
  }).join("\n");
}

export function sportsVenueText(venue: SportsVenueSiteSummary): string {
  return [
    venue.name,
    `校区：${venue.campus}`,
    `场馆：${venue.venue}`,
    `开放：${venue.openStart ?? "未知"}-${venue.openEnd ?? "未知"}`,
    `场地 ID：${venue.siteId}`,
  ].join("\n");
}

export function sportsSlotsText(schedule: SportsSlotSchedule): string {
  if (schedule.slots.length === 0)
    return NONE;
  return schedule.slots.map((slot) => {
    const available = slot.spaces.filter((space) => space.state === "available").length;
    const header = `${schedule.date} ${slot.startAt}-${slot.endAt}\t剩余 ${available}/${slot.spaces.length}`;
    const spaces = slot.spaces.map((space) => `  ${space.name}\t${reservationStateText(space.state)}`);
    return [header, ...spaces].join("\n");
  }).join("\n");
}

export function sportsBookingsText(bookings: SportsBookingSummary[]): string {
  return bookings.length === 0 ? NONE : bookings.map(sportsBookingText).join("\n");
}

export function sportsBookingText(booking: SportsBookingSummary): string {
  const place = [booking.campus, booking.venue, booking.site].filter(Boolean).join("/") || "地点未知";
  return `${booking.reservationDate}\t${booking.reservationDetail ?? ""}\t${place}\t${booking.status}\t${booking.bookingId}`;
}

export function sportsReservationLinkText(link: SportsReservationLink): string {
  return [
    `预约日期：${link.date}（需在页面选择）`,
    `场地 ID：${link.venueSiteId}`,
    `继续预约：${link.url}`,
  ].join("\n");
}

function reservationStateText(state: SportsSlotSchedule["slots"][number]["spaces"][number]["state"]): string {
  return {
    available: "可预约",
    unavailable: "不可预约",
    unpaid: "待支付",
    occupied: "已占用",
  }[state];
}
