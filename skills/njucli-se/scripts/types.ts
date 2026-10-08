export const SE_SUBMISSION_STATES = ["draft", "submitted", "reopened"] as const;

export interface SeCourseSummary {
  courseId: string;
  name: string;
  url: string;
}

export interface SeCoursePage {
  page: number;
  items: SeCourseSummary[];
}

export interface SeParticipantPage {
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

export interface SeActivity {
  activityId: string;
  type: string;
  name: string;
  url: string;
}

export interface SeCourse {
  courseId: string;
  name: string;
  sections: Array<{
    name: string;
    activities: SeActivity[];
  }>;
}

export interface SeAssignment {
  activityId: string;
  courseId: string;
  name: string;
  url: string;
  instructions: string;
  state: "not-submitted" | typeof SE_SUBMISSION_STATES[number];
  submissionStatus: string | null;
  gradingStatus: string | null;
  dueAt: string | null;
  modifiedAt: string | null;
  attachments: SeFile[];
  submittedFiles: SeFile[];
}

export interface SeFile {
  name: string;
  url: string;
}

export interface SeGrade {
  item: string;
  weight: string | null;
  grade: string | null;
  range: string | null;
  percentage: string | null;
  feedback: string | null;
  contribution: string | null;
}

export interface SeLink {
  activityId: string;
  url: string;
}
