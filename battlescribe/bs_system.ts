import type { BSICatalogueLink, BSIData } from "./bs_types";
import type { Catalogue } from "./bs_main_catalogue";
import { getBookDate, BooksDate } from "./bs_versioning";
import { loadData } from "./bs_load_data";

export class BSCatalogueManager {
  catalogues = {} as Record<string, Record<string, Catalogue>>;
  // Must implement
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getData(catalogueLink: BSICatalogueLink, booksDate?: BooksDate): Promise<BSIData> {
    throw new Error("Method not implemented.");
  }
  getCatalogueInfo(catalogueLink: BSICatalogueLink): { name: string } | undefined {
    throw new Error("Method not implemented.");
  }
  getLoadedCatalogue(catalogueLink: BSICatalogueLink | string, booksDate?: BooksDate): Catalogue | undefined {
    const key = typeof catalogueLink === "string" ? catalogueLink : catalogueLink.targetId || catalogueLink.name!;
    const date = getBookDate(booksDate, key) || "default";

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
  unloadAll() {
    this.catalogues = {};
  }

  async loadData(data: BSIData, booksDate?: BooksDate): Promise<Catalogue> {
    const loaded = await loadData(this, data, booksDate);
    loaded.process();
    return loaded;
  }
  async loadCatalogue(catalogueLink: BSICatalogueLink, booksDate?: BooksDate, forceLoad?: boolean): Promise<Catalogue> {
    const loaded = this.getLoadedCatalogue(catalogueLink, booksDate);
    if (loaded && !forceLoad) return loaded;
    const data = await this.getData(catalogueLink, booksDate);
    if (data) {
      const result = await this.loadData(data, booksDate);
      return result;
    }
    throw Error(`Couldn't load catalogue: couldn't getData ${catalogueLink}`);
  }
}
