import { type SkillRuntime } from "../../../src/app/runtime.js";
import { GraduateAcademicClient } from "./client.js";

export type AcademicServices = Pick<GraduateAcademicClient, "grades" | "exams" | "schedule" | "plan">;

export function createAcademicServices(runtime: SkillRuntime): AcademicServices {
  const { withBrowser } = runtime;
  const withAcademic = <T>(operation: (client: GraduateAcademicClient) => Promise<T>): Promise<T> => withBrowser("ehall", (session) => operation(new GraduateAcademicClient(session.request)));
  return {
    grades: (termId) => withAcademic((client) => client.grades(termId)),
    exams: (termId) => withAcademic((client) => client.exams(termId)),
    schedule: (termId) => withAcademic((client) => client.schedule(termId)),
    plan: () => withAcademic((client) => client.plan()),
  };
}
