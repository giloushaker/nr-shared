import { BSCatalogueManager } from "./bs_system";
import { BSIDataSystem, BSIDataCatalogue, BSICatalogueLink, BSIData, BSICatalogue, BSIGameSystem } from "./bs_types";
import { BooksDate } from "./bs_versioning";
import { Catalogue } from "./bs_main_catalogue";
import { loadData } from "./bs_load_data";
import type { GithubIntegration } from "./github";
import { db } from "./cataloguesdexie";
import { getDataObject } from "./bs_main";

export class GameSystemFiles extends BSCatalogueManager {
  gameSystem: BSIDataSystem | null = null;
  catalogueFiles: Record<string, BSIDataCatalogue> = {};
  allLoaded?: boolean;
  loadedCatalogues: Record<string, Catalogue> = {};
  github?: GithubIntegration;

  async loadData(data: BSIData, booksDate?: BooksDate): Promise<Catalogue> {
    const loaded = await loadData(this, data, booksDate, { deleteBadLinks: false });
    return loaded;
  }
  unloadAll() {
    super.unloadAll();
    this.loadedCatalogues = {};
    for (const file of this.getAllCatalogueFiles()) {
      const obj = getDataObject(file) as any as Catalogue;
      delete obj.loaded;
      delete obj.loaded_editor;
    }
    delete this.allLoaded;
  }
  async loadAll() {
    if (this.gameSystem) {
      const loadedSys = await this.loadCatalogue({ targetId: this.gameSystem.gameSystem.id });
      loadedSys.processForEditor();
      for (const catalogue of Object.values(this.catalogueFiles)) {
        const loaded = await this.loadCatalogue({ targetId: catalogue.catalogue.id });
        loaded.processForEditor();
      }
    }
    this.allLoaded = true;
  }
  getLoadedCatalogue(catalogueLink: BSICatalogueLink, booksDate?: BooksDate): Catalogue | undefined {
    const key = catalogueLink.targetId || catalogueLink.name!;
    return this.loadedCatalogues[key] as Catalogue | undefined;
  }
  addLoadedCatalogue(catalogue: Catalogue, booksDate?: BooksDate): void {
    this.loadedCatalogues[catalogue.id] = catalogue;
  }
  getAllLoadedCatalogues() {
    const id = this.gameSystem?.gameSystem.id;
    if (id) {
      return Object.values(this.loadedCatalogues);
    }
    return [];
  }
  getCatalogueInfo(catalogueLink: BSICatalogueLink): { name: string } | undefined {
    if (this.gameSystem?.gameSystem.id === catalogueLink.targetId) {
      return { name: this.gameSystem?.gameSystem.name };
    }
    for (const catalogue of Object.values(this.catalogueFiles)) {
      if (catalogue.catalogue.id === catalogueLink.targetId) {
        return { name: catalogue.catalogue.name };
      }
    }
  }

  getAllCatalogueFiles() {
    return [...(this.gameSystem ? [this.gameSystem] : []), ...Object.values(this.catalogueFiles)];
  }
  setSystem(system: BSIDataSystem) {
    this.gameSystem = system;
  }
  setCatalogue(catalogue: BSIDataCatalogue) {
    const catalogueId = catalogue.catalogue.id;
    this.catalogueFiles[catalogueId] = catalogue;
  }
  removeCatalogue(catalogue: BSIDataCatalogue) {
    for (const [key, value] of Object.entries(this.catalogueFiles)) {
      if (value.catalogue.id === catalogue.catalogue.id) {
        delete this.catalogueFiles[key];
      }
    }
  }

  async getData(catalogueLink: BSICatalogueLink, booksDate?: BooksDate): Promise<BSIData> {
    if (catalogueLink.targetId == this.gameSystem?.gameSystem.id) {
      return this.gameSystem;
    }
    if (catalogueLink.targetId in this.catalogueFiles) {
      return this.catalogueFiles[catalogueLink.targetId];
    }

    const catalogue = await db.catalogues.get({
      "content.catalogue.id": catalogueLink.targetId,
    });
    if (catalogue) {
      return catalogue.content;
    }

    const system = await db.systems.get(catalogueLink.targetId);
    if (system) {
      return system.content;
    }

    const errorPart = catalogueLink.name ? `name ${catalogueLink.name}` : `id ${catalogueLink.targetId}`;
    throw Error(`Couldn't import catalogue with ${errorPart}, perhaps it wasnt uploaded?`);
  }
}
