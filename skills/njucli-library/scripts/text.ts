import type { LibraryBookDetail, LibraryHolding, LibraryLoan, LibrarySearchPage } from "./types.js";

const NONE = "无";

export function librarySearchText(page: LibrarySearchPage): string {
  if (page.items.length === 0)
    return NONE;
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
  if (holdings.length === 0)
    return NONE;
  return holdings.map((holding) => {
    const place = [holding.library, holding.location, holding.shelfMark]
      .filter((value): value is string => Boolean(value))
      .join(" / ");
    return `${place}\t${holding.callNumber}\t${holding.status}`;
  }).join("\n");
}

export function libraryLoansText(loans: LibraryLoan[]): string {
  if (loans.length === 0)
    return NONE;
  return loans.map((loan) => {
    const overdue = loan.overdue ? "逾期" : "借阅中";
    return `${loan.title}\t${loan.dueOn}\t${overdue}`;
  }).join("\n");
}
