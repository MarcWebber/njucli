import { z } from 'zod';
import type { McpTool } from '../../../src/mcp/tools.js';
import type { SportsServices } from './services.js';

const CAMPUS_DATE = z
  .string()
  .min(1)
  .describe("Campus-local date: today, tomorrow, or YYYY-MM-DD");

export function registerSportsTools(tool: McpTool, service: SportsServices): void {
  tool("sports_venues", "List NJU sports venues and reservable venue sites.", { sportTypeId: z.string().min(1).optional().describe("Optional numeric sport type ID") }, ({ sportTypeId }) => service.venues(sportTypeId));
  tool("sports_slots", "List current availability for one sports venue site and date.", { venueSiteId: z.string().min(1).describe("Venue-site ID returned by sports_venues"), date: CAMPUS_DATE }, ({ venueSiteId, date }) => service.slots(venueSiteId, date));
  tool("sports_reserve_link", "Return the official NJU reservation page for a chosen venue and date.", { venueSiteId: z.string().min(1).describe("Venue-site ID returned by sports_venues"), date: CAMPUS_DATE }, ({ venueSiteId, date }) => service.reservationLink(venueSiteId, date));
  tool("sports_venue", "读取指定体育场地详情。", { venueSiteId: z.string().min(1) }, ({ venueSiteId }) => service.venue(venueSiteId));
  tool("sports_bookings", "分页查询本人体育预约，页码从 0 开始。", {
    page: z.number().int().nonnegative().optional(), size: z.number().int().positive().optional(),
  }, ({ page, size }) => service.bookings(page, size));
  tool("sports_booking", "读取指定体育预约详情。", { bookingId: z.string().min(1) }, ({ bookingId }) => service.booking(bookingId));
  tool("sports_cancel_link", "返回官方预约记录页，在官网取消指定预约。", { bookingId: z.string().min(1) }, ({ bookingId }) => service.cancellationLink(bookingId));
}
