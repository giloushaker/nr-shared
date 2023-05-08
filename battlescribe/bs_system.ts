import type {
  BSICatalogueLink,
  BSIData,
  BSICostType,
  BSICatalogue,
  BSIGameSystem,
} from "./bs_types";
import type { Catalogue } from "./bs_main_catalogue";
import type { GameSystem } from "../../ts/systems/game_system";
import type { BsBook } from "./bs_book";
import type { NRAssociationInstance } from "./bs_association";
import type { Instance } from "./bs_instance";
import { setPrototypeRecursive, setPrototype } from "./bs_main_types";
import { PatchIndex } from "./bs_helpers";
import { Base, Category, UNCATEGORIZED_ID } from "./bs_main";
import { getBookDate, BooksDate } from "./bs_versioning";

export class BSCatalogueManager {
  catalogues = {} as Record<string, Record<string, Catalogue>>;

  // Must implement
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getData(
    catalogueLink: BSICatalogueLink,
    booksDate?: BooksDate
  ): Promise<BSIData> {
    throw new Error("Method not implemented.");
  }

  getLoadedCatalogue(
    catalogueLink: BSICatalogueLink,
    booksDate?: BooksDate
  ): Catalogue | undefined {
    const key = catalogueLink.targetId || catalogueLink.name!;
    const date = getBookDate(booksDate, catalogueLink.targetId) || "default";

    const dateIndex = this.catalogues[key];
    return dateIndex ? dateIndex[date] : undefined;
  }
  addLoadedCatalogue(catalogue: Catalogue, booksDate?: BooksDate): void {
    const date = getBookDate(booksDate, catalogue.id) || "default";
    if (!this.catalogues[catalogue.name]) this.catalogues[catalogue.name] = {};
    if (!this.catalogues[catalogue.id]) this.catalogues[catalogue.id] = {};
    this.catalogues[catalogue.name][date] = catalogue;
    this.catalogues[catalogue.id][date] = catalogue;
  }
  addLoadedSystem(system: Catalogue, booksDate?: BooksDate) {
    return this.addLoadedCatalogue(system, booksDate);
  }

  async loadData(data: BSIData, booksDate?: BooksDate): Promise<Catalogue> {
    const loaded = await loadData(this, data, booksDate);
    // loaded.process();
    return loaded;
  }
  async loadCatalogue(
    catalogueLink: BSICatalogueLink,
    booksDate?: BooksDate,
    forceLoad?: boolean
  ): Promise<Catalogue> {
    const loaded = this.getLoadedCatalogue(catalogueLink, booksDate);
    if (loaded && !forceLoad) return loaded;
    const data = await this.getData(catalogueLink, booksDate);
    if (data) {
      const result = await this.loadData(data, booksDate);
      result.process();
      return result;
    }
    throw Error(`Couldn't load catalogue: couldn't getData ${catalogueLink}`);
  }
}

export class NRClientCatalogueManager extends BSCatalogueManager {
  constructor(public system: GameSystem, public patch?: PatchIndex) {
    super();
  }
  async getData(
    catalogueLink: BSICatalogueLink,
    booksDate?: BooksDate
  ): Promise<BSIData> {
    const id = this.system.getBookRowByBsid(catalogueLink.targetId)?.id;
    if (!id) {
      throw Error("Could not find cat with id: " + catalogueLink.targetId);
    }
    const json = await this.system.getBookRaw(id, booksDate);
    return json;
  }
}
export function getDataObject(data: BSIData): BSIGameSystem | BSICatalogue {
  if (data.gameSystem) return data.gameSystem;
  if (data.catalogue) return data.catalogue;
  throw Error("getDataObject data argument is not a valid system or catalogue");
}
export function getDataDbId(data: BSIData): string {
  if (data.catalogue) {
    return `${data.catalogue.gameSystemId}-${data.catalogue.id}`;
  }
  if (data.gameSystem) {
    return data.gameSystem.id;
  }
  throw Error("getDataId data argument is not a valid system or catalogue");
}
export async function loadData(
  system: BSCatalogueManager,
  data: BSIData,
  booksDate?: BooksDate
): Promise<Catalogue> {
  if (!data.catalogue && !data.gameSystem) {
    throw Error(
      `invalid loadBsData argument: no .catalogue or .gameSystem in data`
    );
  }

  const key = data.catalogue ? "catalogue" : "gameSystem";
  const isSystem = key === "gameSystem";
  const isCatalogue = key === "catalogue";
  const obj = data[key]!;
  const asCatalogue = obj as unknown as Catalogue;
  if (asCatalogue.loaded) return asCatalogue;

  // const links = setPrototypeRecursive(content, linkKeys);

  // Prevent infinite loops by checking if prototype is already set
  setPrototypeRecursive(obj);
  const content = setPrototype(obj, key);

  // Resolve gameSystem
  if (isCatalogue) {
    const link = { targetId: content.gameSystemId! };
    const alreadyLoadedGameSystem = system.getLoadedCatalogue(link, booksDate);
    if (alreadyLoadedGameSystem) {
      content.gameSystem = alreadyLoadedGameSystem;
    } //
    else {
      const data = await system.getData(link, booksDate);
      const loadedGameSystem = system.getLoadedCatalogue(link, booksDate);
      if (loadedGameSystem) {
        content.gameSystem = loadedGameSystem;
      } //
      else {
        content.gameSystem = await loadData(system, data, booksDate);
      }
    }
  }

  // Resolve catalogue Links
  const promises = [];
  for (const link of content?.catalogueLinks || []) {
    if (link.targetId === content.id) {
      link.target = content;
      continue;
    }
    const alreadyLoadedCatalogue = system.getLoadedCatalogue(link, booksDate);
    if (alreadyLoadedCatalogue) {
      link.target = alreadyLoadedCatalogue;
      continue;
    } //

    const promise = system.getData(link, booksDate).then((data) => {
      const loadedCatalogue = system.getLoadedCatalogue(link, booksDate);
      if (loadedCatalogue) {
        link.target = loadedCatalogue;
        return;
      }
      return loadData(system, data, booksDate).then(
        (data) => (link.target = data)
      );
    });
    promises.push(promise);
  }
  await Promise.all(promises);
  // Resolve Imports
  content.generateImports();

  // Resolve links
  content.resolveAllLinks(content.imports);

  // Add loaded catalogue to Manager
  if (isSystem) {
    system.addLoadedSystem(content);
  }
  if (isCatalogue) {
    system.addLoadedCatalogue(content);
  }
  return content;
}

export class Roster extends Base {
  system!: GameSystem;
  book!: BsBook;
  catalogues!: Record<string, Catalogue>;
  name = "Roster";

  associated?: Record<string, any[]>;
  declare associations?: NRAssociationInstance[];
  danglingUnits = [] as Instance[];
  constructor(json: any, book: BsBook, catalogues: Catalogue[]) {
    super(json);
    this.system = book.getSystem();
    this.book = book;
    this.catalogues = {};
    for (const catalogue of catalogues) {
      this.catalogues[catalogue.id] = catalogue;
      catalogue.generateImports();
      for (const imported of catalogue.imports) {
        this.catalogues[imported.id] = imported;
      }
    }
    this.generateCostIndex();
    this.generateCategoryIndex();
  }
  isRoster(): this is Roster {
    return true;
  }
  isQuantifiable(): boolean {
    return false;
  }
  isEntry(): boolean {
    return false;
  }
  categoryIndex!: Record<string, any>;
  generateCategoryIndex(): Record<string, Category> {
    const uncategorized = {
      name: "Uncategorized",
      id: UNCATEGORIZED_ID,
      hidden: false,
    } as Category;
    const result = {} as Record<string, Category>;
    for (const catalogue of Object.values(this.catalogues)) {
      for (const imported of catalogue.imports) {
        for (const category of imported.categoryEntries || []) {
          result[category.id] = category;
        }
      }
      for (const category of catalogue.categoryEntries || []) {
        result[category.id] = category;
      }
    }
    result[uncategorized.id] = uncategorized;

    this.categoryIndex = result;
    return result;
  }

  costIndex!: Record<string, any>;
  generateCostIndex(): Record<string, BSICostType> {
    const result = {} as Record<string, BSICostType>;
    for (const catalogue of Object.values(this.catalogues)) {
      for (const imported of catalogue.imports) {
        for (const costType of imported.costTypes || []) {
          result[costType.id] = costType;
        }
      }
      for (const costType of catalogue.costTypes || []) {
        result[costType.id] = costType;
      }
    }

    this.costIndex = result;
    return result;
  }
  removeCatalogue(catalogue: Catalogue) {
    delete this.catalogues[catalogue.id];
    this.generateCostIndex();
    this.generateCategoryIndex();
  }
  addCatalogue(catalogue: Catalogue) {
    this.catalogues[catalogue.id] = catalogue;
    catalogue.generateImports();
    for (const imported of catalogue.imports) {
      this.catalogues[imported.id] = imported;
    }
    this.generateCostIndex();
    this.generateCategoryIndex();
  }
  findOptionById(id: string) {
    for (const catalogue of Object.values(this.catalogues)) {
      const found = catalogue.index[id];
      if (found) return found;
    }
  }
}
