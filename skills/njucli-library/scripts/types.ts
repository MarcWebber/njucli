export const LIBRARY_SEARCH_FIELDS = ["all", "title", "author", "isbn", "callno"] as const;
export type LibrarySearchField = typeof LIBRARY_SEARCH_FIELDS[number];

export interface LibraryBookSummary {
  bookId: string;
  title: string;
  author: string | null;
  callNumbers: string[];
  totalCopies: number;
  availableCopies: number;
}

export interface LibraryHolding {
  callNumber: string;
  library: string | null;
  location: string;
  shelfMark: string | null;
  status: string;
  available: boolean;
}

export interface LibraryBookDetail extends LibraryBookSummary {
  holdings: LibraryHolding[];
}

export interface LibrarySearchPage {
  total: number;
  items: LibraryBookSummary[];
}

export interface LibraryLoan {
  title: string;
  dueOn: string;
  overdue: boolean;
}
