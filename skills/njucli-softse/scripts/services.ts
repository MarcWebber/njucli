import { type SkillRuntime } from "../../../src/app/runtime.js";
import { SoftSeClient } from "./client.js";
import { saveFile } from "../../../src/core/fs.js";

export type SoftSeServices = Pick<SoftSeClient, "courses" | "catalog" | "participants" | "search" | "course" | "assignments" | "assignment" | "grades" | "enroll" | "submissionLink"> & {
  download(activityId: string, fileName: string, path: string, submitted?: boolean): ReturnType<typeof saveFile>;
};

export function createSoftSeServices(runtime: SkillRuntime): SoftSeServices {
  const { withBrowser } = runtime;
  const withSoftSe = <T>(operation: (client: SoftSeClient) => Promise<T>): Promise<T> => withBrowser("softse", (session) => operation(new SoftSeClient(session.request)));
  return {
    courses: () => withSoftSe((client) => client.courses()),
    catalog: () => withSoftSe((client) => client.catalog()),
    participants: (courseId, page) => withSoftSe((client) => client.participants(courseId, page)),
    search: (query, page) => withSoftSe((client) => client.search(query, page)),
    course: (courseId) => withSoftSe((client) => client.course(courseId)),
    assignments: (courseId, pending) => withSoftSe((client) => client.assignments(courseId, pending)),
    assignment: (activityId) => withSoftSe((client) => client.assignment(activityId)),
    download: async (activityId, fileName, path, submitted) => {
      const bytes = await withSoftSe((client) => client.download(activityId, fileName, submitted));
      return saveFile(path, bytes);
    },
    grades: (courseId) => withSoftSe((client) => client.grades(courseId)),
    enroll: (courseId, enrolmentKey) => withSoftSe((client) => client.enroll(courseId, enrolmentKey)),
    submissionLink: (activityId) => withSoftSe((client) => client.submissionLink(activityId)),
  };
}
