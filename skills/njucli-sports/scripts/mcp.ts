import { z } from 'zod';
import type { ReadTool } from '../../../src/mcp/read.js';
import type { SportsServices } from './services.js';

const CAMPUS_DATE = z
  .string()
  .min(1)
  .describe("Campus-local date: today, tomorrow, or YYYY-MM-DD");

export function registerSportsTools(read: ReadTool, service: SportsServices): void {
  read("sports_venues", "List NJU sports venues and reservable venue sites.", { sportTypeId: z.string().min(1).optional().describe("Optional numeric sport type ID") }, ({ sportTypeId }) => service.venues(sportTypeId));
  read("sports_slots", "List current availability for one sports venue site and date.", { venueSiteId: z.string().min(1).describe("Venue-site ID returned by sports_venues"), date: CAMPUS_DATE }, ({ venueSiteId, date }) => service.slots(venueSiteId, date));
  read("sports_reserve_link", "Return the official NJU reservation page for a chosen venue and date.", { venueSiteId: z.string().min(1).describe("Venue-site ID returned by sports_venues"), date: CAMPUS_DATE }, ({ venueSiteId, date }) => service.reservationLink(venueSiteId, date));
}
