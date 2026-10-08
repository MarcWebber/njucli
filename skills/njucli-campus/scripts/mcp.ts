import { z } from 'zod';
import type { ReadTool } from '../../../src/mcp/read.js';
import type { CampusClient } from './client.js';

export function registerCampusTools(read: ReadTool, service: CampusClient): void {
  read("campus_articles", "List announcements from one explicit NJU public source and section.", {
    source: z.string().min(1).describe("Source ID returned by the campus sources command"),
    section: z.string().min(1).describe("Section ID from that source"),
    page: z.number().int().min(1).optional().describe("One-based article page"),
  }, ({ source, section, page }) => service.articles(source, section, page));
}
