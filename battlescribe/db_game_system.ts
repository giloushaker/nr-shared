import { BSICatalogue, BSICatalogueLink, BSIData, BSIGameSystem } from "./bs_types";
import { BooksDate } from "./bs_versioning";
import { GameSystemFiles } from "./local_game_system";
import { db } from "./cataloguesdexie";
import { Catalogue } from "./bs_main_catalogue";
import { rootToJson } from "./bs_main";

export class DbGameSystemFiles extends GameSystemFiles {
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

  saveCatalogue(data: Catalogue | BSICatalogue | BSIGameSystem) {
    saveCatalogueInDb(data);
  }
}

function saveCatalogueInDb(data: Catalogue | BSICatalogue | BSIGameSystem) {
  const stringed = rootToJson(data);
  const isCatalogue = Boolean(data.gameSystemId);
  const isSystem = !isCatalogue;
  if (isSystem) {
    db.systems.put({
      content: JSON.parse(stringed),
      path: data.fullFilePath,
      id: data.id,
    });
  } else {
    db.catalogues.put({
      content: JSON.parse(stringed),
      path: data.fullFilePath,
      id: `${data.gameSystemId}-${data.id}`,
    });
  }
}
