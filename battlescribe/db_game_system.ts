import { BSICatalogueLink, BSIData } from "./bs_types";
import { BooksDate } from "./bs_versioning";
import { GameSystemFiles } from "./local_game_system";
import { db } from "./cataloguesdexie";

export class DbGameSystemFiles extends GameSystemFiles {
  async getData(catalogueLink: BSICatalogueLink, booksDate?: BooksDate): Promise<BSIData> {
    console.log(`Loading: ${catalogueLink.name}`);

    if (catalogueLink.targetId == this.gameSystem?.gameSystem.id) {
      console.log("It was the GST...");
      return this.gameSystem;
    }

    if (catalogueLink.targetId in this.catalogueFiles) {
      console.log("Catalogue loaded from memory");
      return this.catalogueFiles[catalogueLink.targetId];
    }

    console.log("Loading catalgue from DEXIE");

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
