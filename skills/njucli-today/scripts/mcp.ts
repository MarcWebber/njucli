import { z } from 'zod';
import type { ReadTool } from '../../../src/mcp/read.js';
import type { TodayServices } from './services.js';

const CAMPUS_DATE = z
  .string()
  .min(1)
  .describe("Campus-local date: today, tomorrow, or YYYY-MM-DD");

export function registerTodayTools(read: ReadTool, service: TodayServices): void {
  read("nju_today", "Aggregate courses, library loans, and sports bookings for one date.", { date: CAMPUS_DATE.optional() }, ({ date }) => service(date));
}
