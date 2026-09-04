export type LibrarySearchField = "all" | "title" | "author" | "isbn" | "callno";

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
