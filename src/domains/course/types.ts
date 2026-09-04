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
