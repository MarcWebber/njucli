import { z } from 'zod';
import type { ReadTool } from '../../../src/mcp/read.js';
import type { AcademicServices } from './services.js';

const OPTIONAL_TERM = z
  .string()
  .min(1)
  .optional()
  .describe("Academic term ID; omit to use the current term");

export function registerAcademicTools(read: ReadTool, service: AcademicServices): void {
  read("academic_grades", "List the signed-in graduate student's published grades.", { termId: OPTIONAL_TERM }, ({ termId }) => service.grades(termId));
  read("academic_exams", "List published exam and assessment arrangements.", { termId: OPTIONAL_TERM }, ({ termId }) => service.exams(termId));
  read("academic_schedule", "List the signed-in graduate student's timetable.", { termId: OPTIONAL_TERM }, ({ termId }) => service.schedule(termId));
  read("academic_plan", "Read the signed-in graduate student's training plan.", {}, () => service.plan());
}
