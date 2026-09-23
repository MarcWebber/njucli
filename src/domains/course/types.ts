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

export type CourseSelectionKind = "plan" | "public";

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

export interface CourseOffering extends GraduateCourse {
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
