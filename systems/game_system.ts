import { GameSystemRow } from "~/types/db_types";
import { IArmyBook } from "./army_interfaces";
import { BsBook } from "../../shared/battlescribe/bs_book";
import { NRClientCatalogueManager } from "../../shared/battlescribe/bs_system";
import { BooksDate } from "../../shared/battlescribe/bs_versioning";

import { BookFetchFunction, BsGameSystem } from "./bs_game_system";
import { RuleDefinition, getStatModifier } from "../../../assets/ts/rule/rule";
import { Spells } from "../../../assets/ts/game/wizard";
import Spell from "../../../assets/ts/game/spell";
import Path from "../../../assets/ts/game/path";
import ArmyBook from "../../../assets/ts/army/army_book";

/*
 ** Turn the string representation of stat modifier ("+1" or "+D6") into a structured StatModifier
 */
function stringToStatAll(rules: { rules: Record<string, RuleDefinition> | null } | null) {
  if (!rules?.rules) {
    return;
  }
  for (const rule of Object.values(rules.rules) as RuleDefinition[]) {
    let allmods: any[] = [];
    if (rule.mod) {
      allmods = allmods.concat(rule.mod);
    }

    if (rule.ennemymod) {
      allmods = allmods.concat(rule.ennemymod);
    }

    for (const mod of allmods) {
      if (mod.stats) {
        if (mod.stats != "params") {
          for (const stat in mod.stats) {
            if (mod.stats[stat].includes("params") == false) {
              mod.stats[stat] = getStatModifier(mod.stats[stat]);
            }
          }
        }
      }
    }
  }
}

export class GameSystem extends BsGameSystem {
  spells: Spells | null = null;
  rules: { rules: Record<string, RuleDefinition> | null } | null = null;
  translated_rules?: { rules: Record<string, RuleDefinition> | null } | null;

  constructor(systemRow: GameSystemRow, lang: string, fetchStrategy: BookFetchFunction) {
    super(systemRow, lang, fetchStrategy);
    if (systemRow.engine === "bs") {
      this.manager = new NRClientCatalogueManager(this, this.settings.patch);
    }
  }

  public async loadExtraBooks(booksDate?: string): Promise<void> {
    try {
      // Load Rules
      if ((this.lastBooksDate != booksDate || this.rules == null) && this.id_rules_def) {
        const loadBooksDate: BooksDate = {};
        if (booksDate) {
          loadBooksDate[`${this.id_rules_def}`] = booksDate;
        }
        this.rules = await this.getBookRaw(this.id_rules_def, loadBooksDate);
        if (this.language != "EN") {
          this.translated_rules = this.books.index[this.id_rules_def].rawTranslation || (null as any);
        }
        if (this.rules && this.rules.rules) {
          stringToStatAll(this.rules);
        }
      }
    } catch (e) {
      this.rules = null;
    }

    // Load Stats
    try {
      if ((this.lastBooksDate != booksDate || this.unit_stats == null) && this.id_unit_stats) {
        const loadBooksDate: BooksDate = {};
        if (booksDate) {
          loadBooksDate[`${this.id_unit_stats}`] = booksDate;
        }
        this.unit_stats = await this.getBookRaw(this.id_unit_stats, loadBooksDate);
      }
    } catch {
      this.unit_stats = undefined;
    }

    this.spells = (await this.loadSpells()) || null;
    this.lastBooksDate = booksDate;
  }

  async loadSpells(booksDate?: string): Promise<Spells | null> {
    // Load Spells
    try {
      if (this.spells != undefined && booksDate == this.lastBooksDate) {
        return this.spells;
      }

      if (this.id_spells == null) {
        return null;
      }

      const loadBooksDate: BooksDate = {};
      if (booksDate) {
        loadBooksDate[`${this.id_spells}`] = booksDate;
      }
      const spells = await this.getBookRaw(this.id_spells, loadBooksDate);
      if (spells) {
        Spell.warhallTokenID = 1000;
        // Turn paths into a map
        const nPaths = new Map<string, Path>();
        const rawPath = spells.paths as any;
        for (const key in rawPath) {
          nPaths.set(key, new Path(rawPath[key]));
        }
        spells.paths = nPaths;
      }

      return spells;
    } catch {
      return null;
    }
  }

  async unloadAllBooks() {
    super.unloadAllBooks();
    if (this.engine === "bs") {
      this.rules = null;
    }
  }

  /**
   * Loads all books
   * @param date
   * @returns All loaded books
   */
  async loadAllBooks(): Promise<IArmyBook[]> {
    let result = await super.loadAllBooks();
    switch (this.engine) {
      case "bs": {
        for (const book of result) {
          (book as BsBook).catalogue.processForWiki(this);
        }
        break;
      }
      case "t9a": {
        break;
      }
      default: {
        break;
      }
    }
    return result;
  }

  protected async loadBookFromJson(
    jsonData: any,
    translationData?: any,
    booksDate?: BooksDate
  ): Promise<IArmyBook | null> {
    // BS Book
    if (jsonData === null) return null;

    if (jsonData.catalogue || jsonData.gameSystem || jsonData.bsid || jsonData.url) {
      return await BsBook.loadFromJson(this, jsonData, booksDate);
    } else {
      return await ArmyBook.loadFromJson(this, jsonData, translationData, booksDate);
    }
  }
}
