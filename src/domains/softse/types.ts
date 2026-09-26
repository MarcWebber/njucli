export interface SoftSeCourseSummary {
  courseId: string;
  name: string;
  url: string;
}

export interface SoftSeCoursePage {
  page: number;
  items: SoftSeCourseSummary[];
}

export interface SoftSeParticipantPage {
  courseId: string;
  page: number;
  nextPage: number | null;
  items: Array<{
    userId: string;
    name: string;
    url: string;
    roles: string;
    groups: string;
  }>;
}

export interface SoftSeActivity {
  activityId: string;
  type: string;
  name: string;
  url: string;
}

export interface SoftSeCourse {
  courseId: string;
  name: string;
  sections: Array<{
    name: string;
    activities: SoftSeActivity[];
  }>;
}

export interface SoftSeAssignment {
  activityId: string;
  courseId: string;
  name: string;
  url: string;
  instructions: string;
  state: "not-submitted" | "draft" | "submitted" | "reopened";
  submissionStatus: string | null;
  gradingStatus: string | null;
  dueAt: string | null;
  modifiedAt: string | null;
  attachments: SoftSeFile[];
  submittedFiles: SoftSeFile[];
}

export interface SoftSeFile {
  name: string;
  url: string;
}

export interface SoftSeGrade {
  item: string;
  weight: string | null;
  grade: string | null;
  range: string | null;
  percentage: string | null;
  feedback: string | null;
  contribution: string | null;
}

export interface SoftSeLink {
  activityId: string;
  url: string;
}
