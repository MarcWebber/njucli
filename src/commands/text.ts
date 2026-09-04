import type { SessionMetadata } from "../auth/types.js";
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
  LibrarySearchPage,
} from "../domains/library/types.js";
import type {
  SportsBookingSummary,
  SportsSlotSchedule,
  SportsVenueSiteSummary,
} from "../domains/sports/types.js";
import type { DoctorResult, SourceResult, TodayResult } from "../app/services.js";

const NONE = "无";

export const accountText = (account: string): string => account;

export function accountsText(accounts: string[]): string {
  return accounts.length === 0 ? NONE : accounts.join("\n");
}

export function sessionsText(sessions: SessionMetadata[]): string {
  return sessions.length === 0
    ? NONE
    : sessions.map((session) => `${session.capability}\t${session.status}`).join("\n");
}

export function campusSourcesText(sources: CampusSource[]): string {
  return sources.map((source) => {
    const sections = source.sections.map((section) => section.id).join(", ");
    return `${source.id}\t${source.name}\t${sections}`;
  }).join("\n");
}

export function campusArticlesText(page: CampusArticlePage): string {
  if (page.items.length === 0) return NONE;
  return page.items.map((article) =>
    `${article.publishedOn}\t${article.title}\t${article.articleId}`
  ).join("\n");
}

export function campusArticleText(article: CampusArticle): string {
  const publisher = article.publisher === null ? "" : `\n发布方：${article.publisher}`;
  const attachments = article.attachments.length === 0
    ? ""
    : `\n附件：\n${article.attachments.map((item) => `- ${item.title}: ${item.url}`).join("\n")}`;
  return `${article.title}\n发布日期：${article.publishedOn}${publisher}\n${article.content}${attachments}`;
}

export function termsText(terms: AcademicTerm[]): string {
  return terms.length === 0
    ? NONE
    : terms.map((term) => `${term.id}\t${term.name}`).join("\n");
}

export function termText(term: AcademicTerm): string {
  return `${term.name}\t${term.id}`;
}

export function scheduleText(schedule: CourseSchedule): string {
  if (schedule.courses.length === 0) return `${schedule.term.name}\n${NONE}`;
  const courses = schedule.courses.flatMap((course) => {
    const teachers = course.teachers.join("、") || "教师待定";
    if (course.arrangements.length === 0) {
      return [`${course.name}\t${teachers}\t无固定排课`];
    }
    return course.arrangements.map((arrangement) => {
      const weeks = arrangement.weeks.join(",");
      const place = [arrangement.campus, arrangement.location].filter(Boolean).join(" ") || "地点待定";
      return `${course.name}\t${teachers}\t周${weekdayText(arrangement.weekday)} ${arrangement.startTime}-${arrangement.endTime}\t第 ${weeks} 周\t${place}`;
    });
  });
  return [`学期：${schedule.term.name}`, ...courses].join("\n");
}

export function occurrencesText(occurrences: CourseOccurrence[]): string {
  if (occurrences.length === 0) return NONE;
  return occurrences.map((course) => {
    const location = course.location ?? "地点待定";
    return `${course.date} ${course.startTime}-${course.endTime}\t${course.name}\t${location}`;
  }).join("\n");
}

export function occurrenceText(occurrence: CourseOccurrence | null): string {
  return occurrence === null ? NONE : occurrencesText([occurrence]);
}

export function librarySearchText(page: LibrarySearchPage): string {
  if (page.items.length === 0) return NONE;
  return page.items.map((book) => {
    const author = book.author ?? "作者不详";
    return `${book.title}\t${author}\t可借 ${book.availableCopies}/${book.totalCopies}\t${book.bookId}`;
  }).join("\n");
}

export function libraryBookText(book: LibraryBookDetail): string {
  return [
    book.title,
    `作者：${book.author ?? "未知"}`,
    `索书号：${book.callNumbers.join("、") || "未知"}`,
    `馆藏：可借 ${book.availableCopies}/${book.totalCopies}`,
  ].join("\n");
}

export function libraryHoldingsText(holdings: LibraryHolding[]): string {
  if (holdings.length === 0) return NONE;
  return holdings.map((holding) => {
    const place = [holding.library, holding.location, holding.shelfMark]
      .filter((value): value is string => Boolean(value))
      .join(" / ");
    return `${place}\t${holding.callNumber}\t${holding.status}`;
  }).join("\n");
}

export function libraryLoansText(loans: LibraryLoan[]): string {
  if (loans.length === 0) return NONE;
  return loans.map((loan) => {
    const overdue = loan.overdue ? "逾期" : "借阅中";
    return `${loan.title}\t${loan.dueOn}\t${overdue}`;
  }).join("\n");
}

export function sportsVenuesText(sites: SportsVenueSiteSummary[]): string {
  if (sites.length === 0) return NONE;
  return sites.map((site) => {
    const sport = site.sportId === null
      ? (site.sport ?? "运动未知")
      : `${site.sport ?? "运动"} (${site.sportId})`;
    return `${site.campus}\t${site.venue}\t${site.name}\t${sport}\t${site.siteId}`;
  }).join("\n");
}

export function sportsVenueText(venue: SportsVenueSiteSummary): string {
  return [
    venue.name,
    `校区：${venue.campus}`,
    `场馆：${venue.venue}`,
    `开放：${venue.openStart ?? "未知"}-${venue.openEnd ?? "未知"}`,
    `场地 ID：${venue.siteId}`,
  ].join("\n");
}

export function sportsSlotsText(schedule: SportsSlotSchedule): string {
  if (schedule.slots.length === 0) return NONE;
  return schedule.slots.map((slot) => {
    const available = slot.spaces.filter((space) => space.state === "available").length;
    const header = `${schedule.date} ${slot.startAt}-${slot.endAt}\t剩余 ${available}/${slot.spaces.length}`;
    const spaces = slot.spaces.map((space) =>
      `  ${space.name}\t${reservationStateText(space.state)}`
    );
    return [header, ...spaces].join("\n");
  }).join("\n");
}

export function sportsBookingsText(bookings: SportsBookingSummary[]): string {
  return bookings.length === 0 ? NONE : bookings.map(sportsBookingText).join("\n");
}

export function sportsBookingText(booking: SportsBookingSummary): string {
  const place = [booking.campus, booking.venue, booking.site].filter(Boolean).join("/") || "地点未知";
  return `${booking.reservationDate}\t${place}\t${booking.status}\t${booking.bookingId}`;
}

export function todayText(result: TodayResult): string {
  return [
    `日期：${result.date}`,
    `课程：${sourceState(result.course)}`,
    `借阅：${sourceState(result.library)}`,
    `体育预约：${sourceState(result.sports)}`,
  ].join("\n");
}

export function doctorText(result: DoctorResult): string {
  const checks = result.checks.map((check) =>
    `${check.ok ? "OK" : "FAIL"}\t${check.name}${check.code ? `\t${check.code}` : ""}`
  );
  return [`账号：${result.account}`, ...checks].join("\n");
}

function sourceState(result: SourceResult<unknown>): string {
  if (!result.ok) return `失败 (${result.error.code})`;
  if (Array.isArray(result.data)) return `${result.data.length} 项`;
  return "成功";
}

function reservationStateText(state: SportsSlotSchedule["slots"][number]["spaces"][number]["state"]): string {
  return {
    available: "可预约",
    unavailable: "不可预约",
    unpaid: "待支付",
    occupied: "已占用",
  }[state];
}

function weekdayText(weekday: number): string {
  return ["一", "二", "三", "四", "五", "六", "日"][weekday - 1]!;
}
