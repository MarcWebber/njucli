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
