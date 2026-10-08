import { z } from 'zod';
import type { ReadTool } from '../../../src/mcp/read.js';
import type { CourseServices } from './services.js';
import { COURSE_SELECTION_KINDS } from './types.js';

const CAMPUS_DATE = z
  .string()
  .min(1)
  .describe("Campus-local date: today, tomorrow, or YYYY-MM-DD");

const OPTIONAL_TERM = z
  .string()
  .min(1)
  .optional()
  .describe("Academic term ID; omit to use the current term");

export function registerCourseTools(read: ReadTool, service: CourseServices): void {
  read("course_today", "List the signed-in student's courses on one date.", { date: CAMPUS_DATE.optional(), termId: OPTIONAL_TERM }, ({ date, termId }) => service.today(date, termId));
  read("course_week", "List the signed-in student's courses for the week containing a date.", { date: CAMPUS_DATE.optional(), termId: OPTIONAL_TERM }, ({ date, termId }) => service.week(date, termId));
  read("course_next", "Get the signed-in student's next scheduled course.", { termId: OPTIONAL_TERM }, ({ termId }) => service.next(termId));
  read("course_available", "List graduate courses that currently report remaining seats.", {
    kind: z.enum(COURSE_SELECTION_KINDS).default("public").describe("Course scope: program-plan courses or public/cross-department courses"),
    query: z.string().optional().describe("Course code, name, or teacher keyword"),
    page: z.number().int().min(1).optional().describe("One-based result page"),
    pageSize: z.number().int().min(1).optional().describe("Results per page"),
  }, ({ kind, query, page, pageSize }) => service.available(kind, query, page, pageSize));
  read("course_selected", "List the signed-in student's selected graduate courses.", {}, () => service.selected());
}
