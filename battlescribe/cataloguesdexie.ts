// db.ts
import type { Table } from "dexie";
import Dexie from "dexie";
import { BSIDataCatalogue, BSIDataSystem } from "./bs_types";
import { GameSystemRow, GithubGameSystemRow } from "~/assets/ts/types/db_types";

export class MySubClassedDexie extends Dexie {
  catalogues!: Table<{ id: string; content: BSIDataCatalogue; path?: string }>;
  systems!: Table<{ id: string; content: BSIDataSystem; path?: string }>;
  systemrows!: Table<GameSystemRow | GithubGameSystemRow>;

  constructor() {
    super("nr-editor");
    this.version(6).stores({
      catalogues: "id, content.catalogue.id, content.catalogue.gameSystemId",
      systems: "id",
      systemrows: "id",
    });
  }
}

export const cataloguesdexie = new MySubClassedDexie();
