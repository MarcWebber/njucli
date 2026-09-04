import type { AuthCapability, SessionMetadata } from "../auth/types.js";
import type {
  CampusArticle,
  CampusArticlePage,
  CampusSource,
} from "../domains/campus/types.js";
import type {
  AcademicTerm,
  CourseOccurrence,
  CourseSchedule,
} from "../domains/course/types.js";
import type {
  LibraryBookDetail,
  LibraryHolding,
  LibraryLoan,
  LibrarySearchField,
  LibrarySearchPage,
} from "../domains/library/types.js";
import type {
  SportsBookingSummary,
  SportsSlotSchedule,
  SportsVenueSiteSummary,
} from "../domains/sports/types.js";

export interface NjuServices {
  account: {
    current(): Promise<string>;
    list(): Promise<string[]>;
    add(name: string): Promise<string>;
    use(name: string): Promise<string>;
    remove(name: string): Promise<void>;
  };
  auth: {
    capabilities(): AuthCapability[];
    status(capability?: AuthCapability): Promise<SessionMetadata[]>;
    login(capability?: AuthCapability): Promise<SessionMetadata>;
    refresh(capability?: AuthCapability): Promise<SessionMetadata[]>;
    logout(capability?: AuthCapability): Promise<AuthCapability[]>;
  };
  campus: {
    sources(): CampusSource[];
    articles(source: string, section: string, page?: number): Promise<CampusArticlePage>;
    article(source: string, section: string, articleId: string): Promise<CampusArticle>;
  };
  course: {
    terms(): Promise<AcademicTerm[]>;
    currentTerm(): Promise<AcademicTerm>;
    schedule(termId?: string): Promise<CourseSchedule>;
    today(date?: string, termId?: string): Promise<CourseOccurrence[]>;
    week(date?: string, termId?: string): Promise<CourseOccurrence[]>;
    next(termId?: string): Promise<CourseOccurrence | null>;
    export(path: string, termId?: string): Promise<{ path: string; eventCount: number }>;
  };
  library: {
    search(query: string, field?: LibrarySearchField, page?: number, pageSize?: number): Promise<LibrarySearchPage>;
    book(bookId: string): Promise<LibraryBookDetail>;
    holdings(bookId: string): Promise<LibraryHolding[]>;
    loans(page?: number, pageSize?: number): Promise<LibraryLoan[]>;
  };
  sports: {
    venues(sportTypeId?: string): Promise<SportsVenueSiteSummary[]>;
    venue(venueSiteId: string): Promise<SportsVenueSiteSummary>;
    slots(venueSiteId: string, date: string): Promise<SportsSlotSchedule>;
    bookings(page?: number, size?: number): Promise<SportsBookingSummary[]>;
    booking(bookingId: string): Promise<SportsBookingSummary>;
  };
  today(date?: string): Promise<TodayResult>;
  doctor(): Promise<DoctorResult>;
}

export type SourceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export interface TodayResult {
  date: string;
  course: SourceResult<CourseOccurrence[]>;
  library: SourceResult<LibraryLoan[]>;
  sports: SourceResult<SportsBookingSummary[]>;
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
