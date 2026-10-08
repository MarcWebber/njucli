export interface EHallService {
  appId: string;
  name: string;
  available: boolean;
  url: string;
}

export const EHALL_TASK_KINDS = ["todo", "done", "started"] as const;
export type EHallTaskKind = typeof EHALL_TASK_KINDS[number];

export interface EHallTaskPage {
  kind: EHallTaskKind;
  page: number;
  total: number;
  items: Array<{
    subject: string;
    count: number | null;
    priority: string | null;
    status: string | null;
    node: string | null;
    author: string | null;
    time: string | null;
  }>;
}

export const EHALL_APPLICATION_STATES = ["active", "completed", "cancelled"] as const;
export type EHallApplicationState = typeof EHALL_APPLICATION_STATES[number];

export interface EHallApplicationPage {
  state: EHallApplicationState;
  page: number;
  total: number;
  items: Array<{
    subject: string;
    node: string | null;
    startedAt: string | null;
  }>;
}

export interface EHallServiceLink {
  appId: string;
  url: string;
}

export interface GraduateGrade {
  term: string | null;
  courseCode: string;
  courseName: string;
  category: string | null;
  credits: number | null;
  score: string | null;
  passed: boolean | null;
}

export interface GraduateExam {
  kind: "exam" | "assessment";
  termId: string;
  courseCode: string | null;
  courseName: string;
  date: string | null;
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
  seat: string | null;
}

export interface GraduateSchedule {
  term: { id: string; name: string };
  courses: Array<{
    courseCode: string;
    courseName: string;
    className: string | null;
    teachers: string[];
    weekday: string | null;
    period: string | null;
    timePlace: string | null;
    location: string | null;
    campus: string | null;
  }>;
}

export interface GraduatePlan {
  planId: string;
  name: string | null;
  gradeYear: string | null;
  departmentCode: string | null;
  requirements: Array<{
    category: string;
    minimumCredits: number | null;
    maximumCredits: number | null;
  }>;
  courses: Array<{
    courseCode: string;
    courseName: string;
    category: string | null;
    college: string | null;
    hours: number | null;
    credits: number | null;
    suggestedTerm: string | null;
    required: string | null;
    note: string | null;
  }>;
}

export interface AcademicTerm {
  id: string;
  name: string;
  startsOn: string | null;
}

export interface ScheduledCourse {
  teachingClassId: string;
  name: string;
  teachers: string[];
  arrangements: Array<{
    weekday: number;
    startPeriod: number;
    startTime: string;
    endTime: string;
    weeks: number[];
    location: string | null;
    campus: string | null;
  }>;
}

export interface CourseOccurrence {
  occurrenceId: string;
  name: string;
  teachers: string[];
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  campus: string | null;
}

export interface CourseSchedule {
  term: AcademicTerm;
  courses: ScheduledCourse[];
}

export const COURSE_SELECTION_KINDS = ["plan", "public"] as const;
export type CourseSelectionKind = typeof COURSE_SELECTION_KINDS[number];

export interface GraduateCourse {
  classId: string;
  courseCode: string;
  name: string;
  className: string;
  teachers: string[];
  department: string;
  campus: string;
  language: string;
  credits: number;
  schedule: string;
}

interface CourseOffering extends GraduateCourse {
  enrolled: number;
  capacity: number;
  remaining: number;
  conflict: boolean;
}

export interface CourseOfferingPage {
  kind: CourseSelectionKind;
  page: number;
  pageSize: number;
  total: number;
  items: CourseOffering[];
}
