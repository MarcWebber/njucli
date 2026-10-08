import { z } from 'zod';
import type { ReadTool } from '../../../src/mcp/read.js';
import type { CampusServices } from './services.js';

export function registerCampusTools(read: ReadTool, service: CampusServices): void {
  read("campus_today", "汇总指定日期的课程、借阅与体育预约。", {
    date: z.string().min(1).optional().describe("today、tomorrow 或 YYYY-MM-DD"),
  }, ({ date }) => service.today(date));
  read("campus_articles", "List announcements from one explicit NJU public source and section.", {
    source: z.string().min(1).describe("Source ID returned by the campus sources command"),
    section: z.string().min(1).describe("Section ID from that source"),
    page: z.number().int().min(1).optional().describe("One-based article page"),
  }, ({ source, section, page }) => service.articles(source, section, page));
}
