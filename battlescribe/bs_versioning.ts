export type BooksDate = {
  [id in keyof any]: string | null;
};
export function getBookDate(booksDate: BooksDate | undefined, id: number | string): string | null | undefined {
  if (!booksDate) return undefined;
  return booksDate[id] || booksDate["*"];
}
