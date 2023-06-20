import { BSICatalogue, BSICatalogueLink, BSIData, BSIGameSystem } from "./bs_types";
import { BooksDate } from "./bs_versioning";
import { GameSystemFiles } from "./local_game_system";
import { db } from "./cataloguesdexie";
import { Catalogue } from "./bs_main_catalogue";
import { rootToJson } from "./bs_main";
import { convertToXml, getExtension, isZipExtension } from "./bs_convert";
import { filename, writeFile } from "~/electron/node_helpers";
import { zipCompress } from "./bs_helpers";

export class FsGameSystemFiles extends GameSystemFiles {
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
    saveCatalogueInFiles(data);
  }
}

export async function saveCatalogueInFiles(data: Catalogue | BSICatalogue | BSIGameSystem) {
  const path = data.fullFilePath;
  if (!path) {
    console.error(`No path included in the catalogue ${data.name} to save at`);
    return;
  }
  const extension = getExtension(path);
  if (path.endsWith(".json")) {
    const content = rootToJson(data);
    await writeFile(path, content);
  } else {
    const xml = convertToXml(data);
    const shouldZip = isZipExtension(extension);
    const name = filename(path);
    const nameInZip = name.replace(".gstz", ".gst").replace(".catz", ".cat");
    const content = shouldZip ? await zipCompress(nameInZip, xml, "uint8array") : xml;
    await writeFile(path, content);
  }
}
