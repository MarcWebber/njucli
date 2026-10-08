import type { SkillRuntime } from "../../../src/app/runtime.js";
import { YouthClient } from "./client.js";

export type YouthServices = Omit<YouthClient, "hasSession" | "restoreSession">;

export function createYouthServices({ withBrowser }: SkillRuntime): YouthServices {
  const withYouth = <T>(operation: (client: YouthClient) => Promise<T>): Promise<T> => {
    let client: YouthClient;
    return withBrowser("youth", () => operation(client), async (session) => {
      client = new YouthClient(session.request);
      return client.restoreSession();
    });
  };
  return {
    profile: () => withYouth((client) => client.profile()),
    menus: () => withYouth((client) => client.menus()),
    years: () => withYouth((client) => client.years()),
    hours: (year) => withYouth((client) => client.hours(year)),
    activities: (options) => withYouth((client) => client.activities(options)),
    activity: (id) => withYouth((client) => client.activity(id)),
    enroll: (id, input) => withYouth((client) => client.enroll(id, input)),
    cancel: (id) => withYouth((client) => client.cancel(id)),
    rate: (id, stars, comment) => withYouth((client) => client.rate(id, stars, comment)),
    teams: (options) => withYouth((client) => client.teams(options)),
    team: (id) => withYouth((client) => client.team(id)),
    trainings: (options) => withYouth((client) => client.trainings(options)),
    enrollTraining: (id) => withYouth((client) => client.enrollTraining(id)),
    cancelTraining: (id) => withYouth((client) => client.cancelTraining(id)),
    categories: (options) => withYouth((client) => client.categories(options)),
    applications: (options) => withYouth((client) => client.applications(options)),
    application: (id) => withYouth((client) => client.application(id)),
    transcript: (options) => withYouth((client) => client.transcript(options)),
    exportTranscript: (output) => withYouth((client) => client.exportTranscript(output)),
    courses: (options) => withYouth((client) => client.courses(options)),
    course: (id) => withYouth((client) => client.course(id)),
    courseGrades: (options) => withYouth((client) => client.courseGrades(options)),
    practices: (options) => withYouth((client) => client.practices(options)),
    practice: (id) => withYouth((client) => client.practice(id)),
    practiceTeams: (options) => withYouth((client) => client.practiceTeams(options)),
    practiceTeam: (id) => withYouth((client) => client.practiceTeam(id)),
    practiceResources: (options) => withYouth((client) => client.practiceResources(options)),
    practiceResource: (id) => withYouth((client) => client.practiceResource(id)),
    practiceJournals: (options) => withYouth((client) => client.practiceJournals(options)),
    clubs: (options) => withYouth((client) => client.clubs(options)),
    club: (id) => withYouth((client) => client.club(id)),
    jobs: (options) => withYouth((client) => client.jobs(options)),
    recruitments: (options) => withYouth((client) => client.recruitments(options)),
    tickets: (options) => withYouth((client) => client.tickets(options)),
    awards: (kind, options) => withYouth((client) => client.awards(kind, options)),
    projects: (options) => withYouth((client) => client.projects(options)),
    complaints: (options) => withYouth((client) => client.complaints(options)),
  };
}
