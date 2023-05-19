import { GameSystem } from "../../ts/systems/game_system";
import { BSIData, BSICost } from "./bs_types";
import { getAllModels } from "./bs_main";
import { newList, ExportedRoot } from "./bs_selector";
import { Catalogue } from "./bs_main_catalogue";
import { patchJson, sortByAscending } from "./bs_helpers";
import { ExportedNode, RootInstance } from "./bs_instance";
import { loadAssociationsRoster } from "./bs_association";
import { BooksDate } from "./bs_versioning";
import { IArmyBook } from "../systems/army_interfaces";

export interface CatalogueExtraInfo {
  revision: number;
  id: number;
  id_game_system: number;
  name: string;
  nrversion: number;
  short: string;
  version: string;
  url?: string;
  meta?: string;
  xml_hash?: string;
}
export class BsBook implements IArmyBook {
  id: number;
  name: string;
  revision: number;
  short: string;
  version: string;
  nrversion: number;
  constructor(public system: GameSystem, public catalogue: Catalogue, data: CatalogueExtraInfo) {
    this.id = data.id;
    this.name = data.name;
    this.revision = data.revision;
    this.short = data.short;
    this.version = data.version;
    this.nrversion = data.nrversion;
    catalogue.book = this;
  }

  getCosts() {
    return Object.values(this.catalogue.costIndex).map((cost) => {
      return {
        name: cost.name,
        typeId: cost.id,
        value: 0,
      };
    });
  }

  async loadRosterFromJson(json: ExportedRoot, booksDate?: BooksDate) {
    /*  const t0 = Date.now(); */
    const manager = this.getSystem().manager!;
    const root = newList(this.catalogue, true);
    const roster = root.first();
    if (booksDate) {
      roster.booksDate = booksDate;
    }

    roster.setIsListLoading(true);
    for (const book of json.options) {
      const cat = await manager.loadCatalogue({ targetId: book.option_id, name: book.name }, booksDate);
      roster.addBook(cat.book);
    }
    await roster.loadFromInstanceJson(json as ExportedNode);
    loadAssociationsRoster(roster.getRoot());
    roster.setIsListLoading(false);
    roster.validateArmy();
    /*     const t1 = Date.now();
        console.log(`Loading done, took ${t1 - t0}ms`); */
    return roster;
  }

  createRoster(costs: BSICost[]) {
    const root = newList(this.catalogue);
    const result = root.first();
    (root.first() as RootInstance).setMaxCosts(costs);

    const catalogue = result.selectors.find((o) => o.ids.includes(this.catalogue.id));
    if (!catalogue) {
      throw Error("couldn't find main_catalogue inside list");
    }

    const first_force = catalogue.first().selectors.find((o) => o.source.isForce());
    if (!first_force) {
      throw Error("couldn't find any force inside main_catalogue");
    }

    const forces = catalogue.source.childs;
    if (forces.length === 1) {
      catalogue.first().insertForce(null, first_force.getId());
    }
    return result;
  }

  getId(): number {
    return this.id;
  }

  getIdSystem(): number {
    return this.system.id;
  }

  getName(): string {
    return this.name;
  }

  getShort(): string {
    return this.short;
  }
  getVersion(): string {
    return this.version.toString();
  }

  getRevision(): string {
    return this.catalogue.revision!.toString();
  }

  getSystem(): GameSystem {
    return this.system;
  }

  getForces() {
    this.catalogue.process();
    const result = this.catalogue.forces
      .map((force) => {
        return {
          id: force.id,
          name: force.getName(),
          getAvailableCategories() {
            return this.categories;
          },
          categories: force.categories
            .map((category) => {
              return {
                id: category.id,
                uid: category.getName(),
                name: category.getName(),
                isHidden: () => false,
                getAvailableUnits() {
                  return this.units;
                },
                units: category.units.map((unit) => {
                  return {
                    id: unit.id,
                    uid: unit.getName(),
                    name: unit.getName(),
                    source: unit,
                    getStartingCosts: () => [],
                    isHidden: () => false,
                    getModels: () => getAllModels(unit),
                    getBook: () => this,
                  };
                }),
              };
            })
            .filter((o) => o.units?.length),
        };
      })
      .filter((o) => o.categories.length);

    return sortByAscending(result, (o) => o.name);
  }

  getLastUpdated(): string | undefined {
    return this.catalogue.lastUpdated;
  }

  getMainCatalogue(): Catalogue {
    return this.catalogue;
  }

  static async loadFromJson(
    system: GameSystem,
    data: BSIData & CatalogueExtraInfo,
    booksDate?: BooksDate
  ): Promise<BsBook | null> {
    if (!data.catalogue && !data.gameSystem) {
      console.log(`Couldn't load book from json: no .catalogue or .gameSystem`);
      return null;
    }
    const json = data as any;
    if (system.settings.patch && !json.patched && !(globalThis as any).$debugNoPatch) {
      patchJson(json, system.settings.patch);
      json.patched = true;
    }

    const loaded = await system.manager!.loadData(data, booksDate);
    const res = new BsBook(system, loaded, data);
    res.catalogue = loaded;
    // console.log(`Loaded book: ${res.name}`);
    return res;
  }
  get url(): string {
    return "%{system}/%{name}";
  }
}
