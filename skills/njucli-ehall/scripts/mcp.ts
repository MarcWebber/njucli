import { z } from 'zod';
import type { ReadTool } from '../../../src/mcp/read.js';
import type { EHallServices } from './services.js';
import { EHALL_APPLICATION_STATES, EHALL_TASK_KINDS } from './types.js';

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
}
