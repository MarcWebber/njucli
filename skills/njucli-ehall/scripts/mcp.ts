import { z } from 'zod';
import type { ReadTool } from '../../../src/mcp/read.js';
import type { EHallServices } from './services.js';
import { COURSE_SELECTION_KINDS, EHALL_APPLICATION_STATES, EHALL_TASK_KINDS } from './types.js';

const CAMPUS_DATE = z
  .string()
  .min(1)
  .describe("Campus-local date: today, tomorrow, or YYYY-MM-DD");

const OPTIONAL_TERM = z
  .string()
  .min(1)
  .optional()
  .describe("Academic term ID; omit to use the current term");

export function registerEHallTools(read: ReadTool, service: EHallServices): void {
  read("ehall_services", "Search official NJU EHall service entries.", { query: z.string().optional().describe("Service name keyword") }, ({ query }) => service.services(query));
  read("ehall_trip", "Read the current graduate holiday travel registration, contact defaults, and missing fields.", {}, () => service.trip());
  read("ehall_tasks", "List EHall todo, done, or initiated tasks without opening forms.", {
    kind: z.enum(EHALL_TASK_KINDS).default("todo"),
    page: z.number().int().min(1).optional(),
    pageSize: z.number().int().min(1).optional(),
  }, ({ kind, page, pageSize }) => service.tasks(kind, page, pageSize));
  read("ehall_applications", "List application processes initiated by the signed-in user.", {
    state: z.enum(EHALL_APPLICATION_STATES).default("active"),
    page: z.number().int().min(1).optional(),
    pageSize: z.number().int().min(1).optional(),
  }, ({ state, page, pageSize }) => service.applications(state, page, pageSize));
  read("ehall_grades", "List the signed-in graduate student's published grades.", { termId: OPTIONAL_TERM }, ({ termId }) => service.grades(termId));
  read("ehall_exams", "List published exam and assessment arrangements.", { termId: OPTIONAL_TERM }, ({ termId }) => service.exams(termId));
  read("ehall_graduate_schedule", "List the signed-in graduate student's timetable.", { termId: OPTIONAL_TERM }, ({ termId }) => service.graduateSchedule(termId));
  read("ehall_plan", "Read the signed-in graduate student's training plan.", {}, () => service.plan());
  read("ehall_today", "List the signed-in student's courses on one date.", { date: CAMPUS_DATE.optional(), termId: OPTIONAL_TERM }, ({ date, termId }) => service.today(date, termId));
  read("ehall_week", "List the signed-in student's courses for the week containing a date.", { date: CAMPUS_DATE.optional(), termId: OPTIONAL_TERM }, ({ date, termId }) => service.week(date, termId));
  read("ehall_next", "Get the signed-in student's next scheduled course.", { termId: OPTIONAL_TERM }, ({ termId }) => service.next(termId));
  read("ehall_available", "List graduate courses that currently report remaining seats.", {
    kind: z.enum(COURSE_SELECTION_KINDS).default("public").describe("Course scope: program-plan courses or public/cross-department courses"),
    query: z.string().optional().describe("Course code, name, or teacher keyword"),
    page: z.number().int().min(1).optional().describe("One-based result page"),
    pageSize: z.number().int().min(1).optional().describe("Results per page"),
  }, ({ kind, query, page, pageSize }) => service.available(kind, query, page, pageSize));
  read("ehall_selected", "List the signed-in student's selected graduate courses.", {}, () => service.selected());
}
