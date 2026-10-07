import type { AuthCapability, AuthCredentials, AuthMaintenance, SessionMetadata } from "../auth/types.js";
import type { CampusClient } from "../domains/campus/client.js";
import type { CampusSource } from "../domains/campus/types.js";
import type { CourseService } from "../domains/course/service.js";
import type { GraduateCourseSelectionClient } from "../domains/course/selection-client.js";
import type { CourseOccurrence } from "../domains/course/types.js";
import type { GraduateAcademicClient } from "../domains/academic/client.js";
import type { EHallPortalClient } from "../domains/ehall/client.js";
import type { EHallTripClient } from "../domains/ehall/trip.js";
import type { NjuOpacClient } from "../domains/library/client.js";
import type { LibraryLoan } from "../domains/library/types.js";
import type { SportsBookingSummary, SportsReservationLink, SportsSlotSchedule, SportsVenueSiteSummary } from "../domains/sports/types.js";
import type { SoftSeClient } from "../domains/softse/client.js";
import type { TexClient } from "../domains/tex/client.js";
import type { MailClient, MailBinding } from "../domains/mail/client.js";
import type { SoftwareClient } from "../domains/software/client.js";
import type { YouthClient } from "../domains/youth/client.js";

export interface NjuServices {
  youth: Pick<YouthClient, "profile" | "menus" | "years" | "hours" | "activities" | "activity" | "enroll" | "cancel" | "rate" | "teams" | "team" | "trainings" | "enrollTraining" | "cancelTraining" | "categories" | "applications" | "application" | "transcript" | "exportTranscript" | "courses" | "course" | "courseGrades" | "practices" | "practice" | "practiceTeams" | "practiceTeam" | "practiceResources" | "practiceResource" | "practiceJournals" | "clubs" | "club" | "jobs" | "recruitments" | "tickets" | "awards" | "projects" | "complaints">;
  software: Pick<SoftwareClient, "list" | "show" | "download">;
  mail: Pick<MailClient, "accounts" | "use" | "status" | "unbind" | "folders" | "list" | "search" | "read" | "download"> & {
    bind(credentials?: MailBinding): ReturnType<MailClient["bind"]>;
  };
  account: {
    current(): Promise<string>;
    list(): Promise<string[]>;
    add(name: string): Promise<string>;
    use(name: string): Promise<string>;
    remove(name: string): Promise<void>;
  };
  auth: {
    maintain(): Promise<AuthMaintenance>;
    status(capability?: AuthCapability): Promise<SessionMetadata[]>;
    login(capability?: AuthCapability, credentials?: AuthCredentials): Promise<SessionMetadata>;
    logout(capability?: AuthCapability): Promise<AuthCapability[]>;
  };
  campus: Pick<CampusClient, "canteens" | "articles" | "article"> & {
    sources(): CampusSource[];
  };
  course: Pick<CourseService, "terms" | "currentTerm" | "schedule" | "week" | "next"> &
    Pick<GraduateCourseSelectionClient, "select" | "withdraw"> & {
      today: CourseService["onDate"];
      available: GraduateCourseSelectionClient["listAvailable"];
      selected: GraduateCourseSelectionClient["listSelected"];
      export(path: string, termId?: string): Promise<{ path: string; eventCount: number }>;
    };
  academic: Pick<GraduateAcademicClient, "grades" | "exams" | "schedule" | "plan">;
  ehall: Pick<EHallPortalClient, "services" | "tasks" | "applications" | "serviceLink">
    & Pick<EHallTripClient, "trip" | "submitTrip">;
  softse: Pick<SoftSeClient, "courses" | "catalog" | "participants" | "search" | "course" | "assignments" | "assignment" | "grades" | "enroll" | "submissionLink"> & {
    download(activityId: string, fileName: string, path: string, submitted?: boolean): Promise<{ path: string; bytes: number }>;
  };
  tex: Pick<TexClient, "templates" | "projects" | "create" | "createFromTemplate" | "rename" | "log" | "files" | "read"> & {
    download(projectKey: string, versionNo: string, path: string): Promise<{ path: string; bytes: number }>;
    pdf(projectKey: string, versionNo: string, output: string): Promise<{ path: string; bytes: number }>;
    compile(projectKey: string, versionNo: string, path: string, output: string): Promise<{ path: string; bytes: number }>;
    write(projectKey: string, versionNo: string, path: string, inputLocalPath: string): Promise<{ path: string; bytes: number }>;
    upload(projectKey: string, versionNo: string, inputLocalPath: string): Promise<{ fileKey: string; path: string; bytes: number }>;
  };
  library: Pick<NjuOpacClient, "search" | "book" | "holdings" | "loans">;
  sports: {
    venues(sportTypeId?: string): Promise<SportsVenueSiteSummary[]>;
    venue(venueSiteId: string): Promise<SportsVenueSiteSummary>;
    slots(venueSiteId: string, date: string): Promise<SportsSlotSchedule>;
    bookings(page?: number, size?: number): Promise<SportsBookingSummary[]>;
    booking(bookingId: string): Promise<SportsBookingSummary>;
    reservationLink(venueSiteId: string, date: string): Promise<SportsReservationLink>;
    cancellationLink(bookingId: string): Promise<{ url: string; bookingId: string }>;
  };
  today(date?: string): Promise<TodayResult>;
  doctor(): Promise<DoctorResult>;
}

export interface TodayResult {
  date: string;
  course: CourseOccurrence[];
  library: LibraryLoan[];
  sports: SportsBookingSummary[];
}

export interface DoctorResult {
  account: string;
  authCapabilities: AuthCapability[];
  checks: Array<{
    name: string;
    ok: boolean;
    status?: number;
    code?: string;
    message?: string;
  }>;
}
