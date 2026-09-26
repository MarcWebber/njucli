export const OPAC_BASE_URL = "https://opac.nju.edu.cn";

export interface BookRow {
  bibId: string | number;
  title: string;
  author?: string | null;
  callno?: string[] | null;
  itemCount: string | number;
  circCount: string | number;
}

export interface HoldingRow {
  callNo: string;
  library?: string | null;
  location: string;
  shelfMark?: string | null;
  status: string;
  itemsAvailable: string | number;
}

export interface LoanRow {
  title: string;
  dueDate: string;
  isOverdue: string | number;
}
