import type { SkillRuntime } from "../../../src/app/runtime.js";
import { LmsClient } from "./client.js";

export type LmsServices = Pick<LmsClient, "courses" | "course" | "activities" | "assignments" | "assignment" | "exams" | "todos" | "createAssignment">;

export function createLmsServices({ withBrowser }: SkillRuntime): LmsServices {
  const withLms = <T>(operation: (client: LmsClient) => Promise<T>) =>
    withBrowser("lms", session => operation(new LmsClient(session.request)));
  return {
    courses: (page, query) => withLms(client => client.courses(page, query)),
    course: courseId => withLms(client => client.course(courseId)),
    activities: courseId => withLms(client => client.activities(courseId)),
    assignments: (courseId, page) => withLms(client => client.assignments(courseId, page)),
    assignment: activityId => withLms(client => client.assignment(activityId)),
    exams: courseId => withLms(client => client.exams(courseId)),
    todos: () => withLms(client => client.todos()),
    createAssignment: (courseId, input, publish, notify) => withLms(client => client.createAssignment(courseId, input, publish, notify)),
  };
}
