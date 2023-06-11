import { arrayToIndex, systemToString } from "../util";
import { BSCatalogueManager } from "../../shared/battlescribe/bs_system";
import type { PatchIndex } from "../../shared/battlescribe/bs_helpers";
import type { IArmyBook, SetupCategory } from "./army_interfaces";
import type { BookRow, GameSystemRow, Icons, IndexAndArray, ListRow } from "../../../assets/shared/types/db_types";
import { BsBook } from "../../shared/battlescribe/bs_book";

import { BooksDate, getBookDate } from "../../shared/battlescribe/bs_versioning";
import { defaultScore } from "./system_scores";
export type FetchedBook = any;

export interface ScoringSystem {
  id: number;
  name: string;
  score: Record<string, GameScore>;
  primary: string;
  tieBreakers?: string[];
  objective: string | null;
}

export interface GameScore {
  name: string;
  short: string;
  dispShort?: string;
  type: "number" | "player";
  mod: boolean;
  min?: number;
  max?: number;
  optional?: boolean;
}

function bookSort(a: any, b: any): number {
  if (a.name === b.name) {
    if (a.version <= b.version) return 1;
    return -1;
  } else {
    if (a.name <= b.name) return -1;
    return 1;
  }
}

function ordSort(a: any, b: any): number {
  if (a.ord <= b.ord) return -1;
  return 1;
}

export interface LoadedBookRow extends BookRow {
  rawData: Record<string, FetchedBook>;
  rawTranslation?: Record<string, FetchedBook>;
  data: Record<string, IArmyBook>;
}

export type BookFetchFunction = (
  id_sys: number,
  id_book: number,
  date?: string | null,
  lang?: string
) => Promise<FetchedBook>;

export interface SystemSettingsSize {
  type: string;
  size: { w: number; h: number; r: boolean };
}
export class BsGameSystem {
  _id: string;
  id: number;
  bsid?: string;

  unit_stats: any = null;
  name: string;
  short: string;
  version?: number;
  last_updated?: string;
  path: string;
  engine?: string;
  wiki?: boolean;
  wikiLastUpdated?: string;
  manager?: BSCatalogueManager;

  lastBooksDate?: string;
  rules: any;
  settings: {
    name?: string;
    sizes?: Record<string, SystemSettingsSize>;
    patch?: PatchIndex;
    major?: Record<string, { name: string; date: string }[]>;
    icons?: {
      army_icons: Icons;
      category_icons: Icons;
    };
    score?: ScoringSystem[];
    setup_categories?: Record<string, SetupCategory>;
    profileFilter?: string;
    profilesOrder?: string[];
    exportFormats?: string[];
    extractModelCountFromName?: boolean;
    characteristicDefinesModel?: string;
    defaultMaxCosts?: Record<string, number>;
  } = {};

  public books: IndexAndArray<LoadedBookRow>;

  public id_spells?: number;
  protected id_rules_def?: number;
  protected id_unit_stats?: number;

  private fetchStrategy: BookFetchFunction;
  public language = "EN";

  constructor(systemRow: GameSystemRow, lang: string, fetchStrategy: BookFetchFunction, manager?: BSCatalogueManager) {
    this.fetchStrategy = fetchStrategy;
    this.language = lang;
    this.manager = manager;
    this._id = systemRow._id!.toString();
    this.id = systemRow.id;
    this.bsid = systemRow.bsid;

    this.name = systemRow.name;
    this.short = systemRow.short;
    this.version = systemRow.version;
    this.last_updated = systemRow.last_updated;
    this.engine = systemRow.engine;

    this.id_unit_stats = systemRow.id_unit_stats || undefined;
    this.id_rules_def = systemRow.id_rules_def || undefined;
    this.id_spells = systemRow.id_spells || undefined;

    this.books = {
      array: [],
      index: {},
    };
    this.path = systemRow.path;

    this.settings.major = systemRow.settings?.major;
    this.settings.setup_categories = systemRow.settings?.setup_categories;
    this.settings.icons = systemRow.settings?.icons;
    this.settings.score = systemRow.settings?.score;
    this.settings.patch = systemRow.settings?.patch;
    this.settings.defaultMaxCosts = systemRow.settings?.defaultMaxCosts;
    this.settings.profileFilter = systemRow.settings?.profileFilter;
    this.settings.profilesOrder = systemRow.settings?.profilesOrder;
    this.settings.exportFormats = systemRow.settings?.exportFormats;
    this.settings.extractModelCountFromName = systemRow.settings?.extractModelCountFromName;
    this.settings.characteristicDefinesModel = systemRow.settings?.characteristicDefinesModel;

    this.settings.sizes = {};
    if (systemRow.settings?.sizes) {
      for (const elt in systemRow.settings.sizes) {
        this.settings.sizes[elt.toLocaleLowerCase()] = systemRow.settings.sizes[elt];
      }
    }

    if (this.settings.setup_categories) {
      for (const idcat in this.settings.setup_categories) {
        this.settings.setup_categories[idcat].items.sort(ordSort);
      }
    }

    this.wiki = systemRow.wiki;
    this.wikiLastUpdated = systemRow.wikiLastUpdated;
    if (systemRow.books) {
      systemRow.books.sort(bookSort);
      const books = systemRow.books as LoadedBookRow[];
      for (const elt of books) {
        elt.data = {};
        elt.rawData = {};
      }

      this.books = {
        index: arrayToIndex(books),
        array: books,
      };
    }
  }

  get label(): string {
    return systemToString(this.name, this.version);
  }
  get url(): string {
    return `%{short}/%{label}`;
  }
  isGameSystem(book: BookRow): boolean {
    return this.bsid !== undefined && book.bsid !== undefined && book.bsid === this.bsid;
  }

  /**  Unloads all books */
  async unloadAllBooks() {
    for (const book of this.books.array) {
      book.rawData = {};
      book.data = {};
    }
  }

  /**
   * Loads all books
   * @param date
   * @returns All loaded books
   */
  async loadAllBooks(): Promise<IArmyBook[]> {
    const result = [] as IArmyBook[];
    for (const book of this.books.array) {
      try {
        if (book.id != this.id_spells && book.id != this.id_rules_def) {
          const loaded = await this.getBook(book.id);
          if (loaded) {
            result.push(loaded);
          }
        }
      } catch (e) {
        console.log(e);
      }
    }
    await this.loadExtraBooks();
    return result;
  }
  /**
   * @description Fills provided `book` `.data[{key}]` and `.rawData[{key}]`
   * @returns the {key} to find the loaded book within `book.data` or `book.rawData`
   *
   * @param book the bookRow
   * @param date The date to load the current book at
   * @param booksDate BooksDate to pass to dependencies
   */
  private async loadBook(book: LoadedBookRow, date?: string | null, booksDate?: BooksDate): Promise<string | null> {
    if ((this.engine == "t9a" && book.id < 100) || (this.engine == "bs" && book.id > 200)) {
      let date: string | undefined = undefined;
      if (booksDate) {
        date = booksDate[book.id] || undefined;
      }
      await this.loadExtraBooks(date);
    }
    if (date === undefined) date = book.last_updated;
    const dateIndex = date || "0";
    // Check if Book already loaded
    if (this.books.index[book.id].data[dateIndex] != null) {
      return dateIndex;
    }

    const res = await this.fetchStrategy(this.id, book.id, date, this.language);
    if (res) {
      book.rawData[dateIndex] = res.book;
      if (this.language) {
        book.rawTranslation = res.translation;
      }
      const loaded = await this.loadBookFromJson(res.book, res.translation, booksDate);
      if (loaded) book.data[dateIndex] = loaded;

      return dateIndex;
    }

    return null;
  }

  protected async loadBookFromJson(
    jsonData: any,
    translationData?: any,
    booksDate?: BooksDate
  ): Promise<IArmyBook | null> {
    // BS Book
    if (jsonData === null) return null;
    return await BsBook.loadFromJson(this as any, jsonData, booksDate);
  }

  public async findBookByName(name: string, date?: string): Promise<IArmyBook | null> {
    const book = this.books.array.find((book) => book.name.toLowerCase() == name.toLowerCase());
    if (book) {
      const loaded = await this.loadBook(book, date);
      if (loaded) return book.data[loaded]; // Latest version should be in id = 0
    }
    return null;
  }

  public async findBookByBsid(bsid: string, booksDate?: BooksDate): Promise<BsBook | null> {
    const book = this.books.array.find((book) => book.bsid == bsid);
    if (book) {
      const loaded = await this.loadBook(book, getBookDate(booksDate, book.id), booksDate);
      if (loaded) return book.data[loaded] as BsBook; // Latest version should be in id = 0

      // return book.data[date]; // Latest version should be in id = 0
    }
    return null;
  }

  public getBookRowByBsid(bsid: string): LoadedBookRow | undefined {
    return this.books.array.find((book) => book.bsid == bsid);
  }
  public async findRawByBsid(bsid: string, date?: string | null, booksDate?: BooksDate): Promise<FetchedBook | null> {
    const book = this.getBookRowByBsid(bsid);
    if (book) {
      date = date || getBookDate(booksDate, book.id);
      const loaded = await this.loadBook(book, date, booksDate);
      if (loaded) return book.rawData[loaded]; // Latest version should be in id = 0
    }

    return null;
  }

  public async getBook(id: number, booksDate?: BooksDate): Promise<IArmyBook | null> {
    const book = this.books.index[id];
    const date = getBookDate(booksDate, id);
    if (book) {
      const loaded = await this.loadBook(book, date, booksDate);
      if (loaded) return book.data[loaded];
    }
    return null;
  }

  public async getBookFromListRow(list: ListRow): Promise<IArmyBook | null> {
    if (!list.id_book) {
      return null;
    }
    //let booksDate = booksDate || (selectedList.isFrozen ? selectedList.booksDate : undefined);
    return this.getBook(list.id_book, list.booksDate);
  }

  public async getBookRaw(id: number, booksDate?: BooksDate): Promise<FetchedBook | null> {
    const date = getBookDate(booksDate, id);
    const book = this.books.index[id];
    if (book) {
      const loaded = await this.loadBook(book, date);
      if (loaded) return book.rawData[loaded];
    }
    return null;
  }
  public async getBookRawByBsid(bsid: string, booksDate?: BooksDate): Promise<FetchedBook | null> {
    const book = this.getBookRowByBsid(bsid);
    if (book) {
      return await this.getBookRaw(book.id, booksDate);
    }
    return null;
  }

  public setLanguage(lang: string | null): void {
    if (!lang || lang == this.language) {
      return;
    }
    for (const book of this.books.array) {
      book.data = {};
      book.rawData = {};
    }
    this.language = lang;
  }

  public async loadExtraBooks(booksDate?: string): Promise<void> {}

  public freezeList(list: ListRow): void {
    list.isFrozen = true;

    // Create BooksDate object
    const date = new Date().toISOString();
    if (!list.booksDate) {
      list.booksDate = {};
    }
    list.booksDate["*"] = date;
    for (const book of this.books.array) {
      list.booksDate[book.id] = book.last_updated || date;
    }
  }

  public unfreezeList(list: ListRow): void {
    list.isFrozen = false;
    // Delete BooksDate object
    if (list.booksDate) {
      delete list.booksDate;
    }
  }

  public getScoring(): ScoringSystem[] {
    return this.settings.score || [defaultScore];
  }
}
