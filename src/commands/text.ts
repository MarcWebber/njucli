import type { SessionMetadata } from "../auth/types.js";
import type {
  GraduateExam,
  GraduateGrade,
  GraduatePlan,
  GraduateSchedule,
} from "../domains/academic/types.js";
import type {
  CampusArticle,
  CampusArticlePage,
  CampusSource,
} from "../domains/campus/types.js";
import type {
  AcademicTerm,
  CourseOfferingPage,
  CourseOccurrence,
  CourseSchedule,
  GraduateCourse,
} from "../domains/course/types.js";
import type {
  LibraryBookDetail,
  LibraryHolding,
  LibraryLoan,
  LibrarySearchPage,
} from "../domains/library/types.js";
import type {
  SportsBookingSummary,
  SportsReservationLink,
  SportsSlotSchedule,
  SportsVenueSiteSummary,
} from "../domains/sports/types.js";
import type {
  EHallApplicationPage,
  EHallService,
  EHallServiceLink,
  EHallTaskPage,
} from "../domains/ehall/types.js";
import type {
  SoftSeAssignment,
  SoftSeCourse,
  SoftSeCourseSummary,
  SoftSeGrade,
  SoftSeLink,
  SoftSeParticipantPage,
} from "../domains/softse/types.js";
import type { DoctorResult, TodayResult } from "../app/services.js";

const NONE = "无";

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

export function courseOfferingsText(page: CourseOfferingPage): string {
  if (page.items.length === 0) return NONE;
  return page.items.map((course) => {
    const teachers = course.teachers.join("、") || "教师待定";
    return `${course.courseCode}\t${course.name}（${course.className}）\t${teachers}\t${course.campus}\t${course.schedule}\t剩余 ${course.remaining}/${course.capacity}\t${course.classId}`;
  }).join("\n");
}

export function selectedCoursesText(courses: GraduateCourse[]): string {
  if (courses.length === 0) return NONE;
  return courses.map((course) => {
    const teachers = course.teachers.join("、") || "教师待定";
    return `${course.courseCode}\t${course.name}（${course.className}）\t${teachers}\t${course.campus}\t${course.schedule}\t${course.classId}`;
  }).join("\n");
}

export function graduateGradesText(grades: GraduateGrade[]): string {
  if (grades.length === 0) return NONE;
  return grades.map((grade) =>
    `${grade.term ?? "学期未知"}\t${grade.courseCode}\t${grade.courseName}\t${grade.credits ?? "-"}\t${grade.score ?? "未公布"}\t${grade.passed === null ? "" : grade.passed ? "通过" : "未通过"}`
  ).join("\n");
}

export function graduateExamsText(exams: GraduateExam[]): string {
  if (exams.length === 0) return NONE;
  return exams.map((exam) => {
    const time = [exam.date, exam.startsAt && exam.endsAt
      ? `${exam.startsAt}-${exam.endsAt}`
      : exam.startsAt].filter(Boolean).join(" ") || "时间未公布";
    return `${exam.kind === "exam" ? "考试" : "考查"}\t${exam.courseCode ?? ""}\t${exam.courseName}\t${time}\t${exam.location ?? "地点未公布"}\t${exam.seat ?? ""}`;
  }).join("\n");
}

export function graduateScheduleText(schedule: GraduateSchedule): string {
  if (schedule.courses.length === 0) return `${schedule.term.name}\n${NONE}`;
  return [
    `学期：${schedule.term.name}`,
    ...schedule.courses.map((course) =>
      `${course.courseCode}\t${course.courseName}\t${course.teachers.join("、") || "教师待定"}\t${course.timePlace ?? `星期 ${course.weekday ?? "-"} / 节次 ${course.period ?? "-"}`}\t${course.location ?? ""}`
    ),
  ].join("\n");
}

export function graduatePlanText(plan: GraduatePlan): string {
  const requirements = plan.requirements.map((item) =>
    `要求\t${item.category}\t${item.minimumCredits ?? "-"}-${item.maximumCredits ?? "-"} 学分`
  );
  const courses = plan.courses.map((course) =>
    `${course.courseCode}\t${course.courseName}\t${course.category ?? ""}\t${course.credits ?? "-"} 学分\t${course.suggestedTerm ?? ""}`
  );
  return [
    `${plan.name ?? "培养方案"}\t${plan.planId}`,
    ...requirements,
    ...courses,
  ].join("\n");
}

export function ehallServicesText(services: EHallService[]): string {
  if (services.length === 0) return NONE;
  return services.map((service) =>
    `${service.available ? "可用" : "无权限"}\t${service.name}\t${service.appId}`
  ).join("\n");
}

export function ehallTasksText(page: EHallTaskPage): string {
  if (page.items.length === 0) return NONE;
  return page.items.map((task) =>
    `${task.subject}\t${task.node ?? task.status ?? ""}\t${task.author ?? ""}\t${task.time ?? ""}`
  ).join("\n");
}

export function ehallApplicationsText(page: EHallApplicationPage): string {
  if (page.items.length === 0) return NONE;
  return page.items.map((item) =>
    `${item.subject}\t${item.node ?? ""}\t${item.startedAt ?? ""}`
  ).join("\n");
}

export function ehallServiceLinkText(link: EHallServiceLink): string {
  return `应用 ID：${link.appId}\n官方入口：${link.url}`;
}

export function softSeCoursesText(courses: SoftSeCourseSummary[]): string {
  if (courses.length === 0) return NONE;
  return courses.map((course) =>
    `${course.name}\t${course.courseId}`
  ).join("\n");
}

export function softSeParticipantsText(page: SoftSeParticipantPage): string {
  const rows = page.items.map((item) => `${item.name}\tMoodle ID: ${item.userId}\t${item.roles}\t${item.groups}`);
  return [
    `课程 ${page.courseId} · 第 ${page.page} 页`,
    rows.length ? rows.join("\n") : NONE,
    ...(page.nextPage === null ? [] : [`下一页：njucli softse participants ${page.courseId} --page ${page.nextPage}`]),
  ].join("\n");
}

export function softSeCourseText(course: SoftSeCourse): string {
  const sections = course.sections.flatMap((section) => [
    `[${section.name}]`,
    ...section.activities.map((activity) =>
      `${activity.type}\t${activity.name}\t${activity.activityId}`
    ),
  ]);
  return [course.name, ...sections].join("\n");
}

export function softSeAssignmentsText(assignments: SoftSeAssignment[]): string {
  if (assignments.length === 0) return NONE;
  return assignments.map((assignment) =>
    `${assignment.dueAt ?? "无截止时间"}\t${assignment.submissionStatus}\t${assignment.name}\t课程 ${assignment.courseId}\t作业 ${assignment.activityId}`
  ).join("\n");
}

export function softSeAssignmentText(assignment: SoftSeAssignment): string {
  return [
    `${assignment.name}\t${assignment.activityId}`,
    `提交：${assignment.submissionStatus ?? "未知"}`,
    `评分：${assignment.gradingStatus ?? "未知"}`,
    `截止：${assignment.dueAt ?? "未设置"}`,
    assignment.instructions,
    ...assignment.attachments.map((file) => `附件：${file.name}\t${file.url}`),
    ...assignment.submittedFiles.map((file) => `已交文件：${file.name}\t${file.url}`),
  ].join("\n");
}

export function softSeGradesText(grades: SoftSeGrade[]): string {
  if (grades.length === 0) return NONE;
  return grades.map((grade) =>
    `${grade.item}\t${grade.grade ?? "-"}\t${grade.percentage ?? ""}\t${grade.feedback ?? ""}`
  ).join("\n");
}

export function softSeLinkText(link: SoftSeLink): string {
  return `作业活动 ID：${link.activityId}\n官方提交页：${link.url}`;
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
  return `${booking.reservationDate}\t${booking.reservationDetail ?? ""}\t${place}\t${booking.status}\t${booking.bookingId}`;
}

export function sportsReservationLinkText(link: SportsReservationLink): string {
  return [
    `预约日期：${link.date}（需在页面选择）`,
    `场地 ID：${link.venueSiteId}`,
    `继续预约：${link.url}`,
  ].join("\n");
}

export function todayText(result: TodayResult): string {
  return [
    `日期：${result.date}`,
    `课程：${result.course.length} 项`,
    `借阅：${result.library.length} 项`,
    `体育预约：${result.sports.length} 项`,
  ].join("\n");
}

export function doctorText(result: DoctorResult): string {
  const checks = result.checks.map((check) =>
    `${check.ok ? "OK" : "FAIL"}\t${check.name}${check.code ? `\t${check.code}` : ""}`
  );
  return [`账号：${result.account}`, ...checks].join("\n");
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
