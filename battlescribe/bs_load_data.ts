import type { Catalogue } from "./bs_main_catalogue";
import { setPrototypeRecursive, setPrototype } from "./bs_main_types";
import type { BSCatalogueManager } from "./bs_system";
import type { BSIData } from "./bs_types";
import type { BooksDate } from "./bs_versioning";

export interface loadDataOptions {
  deleteBadLinks: boolean;
}
export async function loadData(
  system: BSCatalogueManager,
  data: BSIData,
  booksDate?: BooksDate,
  options?: loadDataOptions
): Promise<Catalogue> {
  if (!data.catalogue && !data.gameSystem) {
    throw Error(`invalid loadBsData argument: no .catalogue or .gameSystem in data`);
  }

  const key = data.catalogue ? "catalogue" : "gameSystem";
  const isSystem = key === "gameSystem";
  const isCatalogue = key === "catalogue";
  const obj = data[key]!;
  const asCatalogue = obj as unknown as Catalogue;
  if (asCatalogue.loaded || asCatalogue.loaded_editor) {
    return asCatalogue;
  }
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
        content.gameSystem = await loadData(system, data, booksDate, options);
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
      return loadData(system, data, booksDate, options).then((data) => (link.target = data));
    });
    promises.push(promise);
  }
  await Promise.all(promises);

  // Resolve Imports
  content.generateImports();

  // Resolve links
  content.resolveAllLinks(content.imports, options?.deleteBadLinks);

  // Add loaded catalogue to Manager
  if (isSystem) {
    system.addLoadedSystem(content);
  }
  if (isCatalogue) {
    system.addLoadedCatalogue(content);
  }
  content.manager = system;
  return content;
}
