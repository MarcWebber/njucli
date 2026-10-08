import { type SkillRuntime } from "../../../src/app/runtime.js";
import { SeClient } from "./client.js";
import { saveFile } from "../../../src/core/fs.js";

export type SeServices = Pick<SeClient, "courses" | "catalog" | "participants" | "search" | "course" | "assignments" | "assignment" | "grades" | "enroll" | "submissionLink"> & {
  download(activityId: string, fileName: string, path: string, submitted?: boolean): ReturnType<typeof saveFile>;
};

export function createSeServices(runtime: SkillRuntime): SeServices {
  const { withBrowser } = runtime;
  const withSe = <T>(operation: (client: SeClient) => Promise<T>): Promise<T> => withBrowser("se", (session) => operation(new SeClient(session.request)));
  return {
    courses: () => withSe((client) => client.courses()),
    catalog: () => withSe((client) => client.catalog()),
    participants: (courseId, page) => withSe((client) => client.participants(courseId, page)),
    search: (query, page) => withSe((client) => client.search(query, page)),
    course: (courseId) => withSe((client) => client.course(courseId)),
    assignments: (courseId, pending) => withSe((client) => client.assignments(courseId, pending)),
    assignment: (activityId) => withSe((client) => client.assignment(activityId)),
    download: async (activityId, fileName, path, submitted) => {
      const bytes = await withSe((client) => client.download(activityId, fileName, submitted));
      return saveFile(path, bytes);
    },
    grades: (courseId) => withSe((client) => client.grades(courseId)),
    enroll: (courseId, enrolmentKey) => withSe((client) => client.enroll(courseId, enrolmentKey)),
    submissionLink: (activityId) => withSe((client) => client.submissionLink(activityId)),
  };
}
