import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system";
import type { BSICatalogueLink, BSIData } from "./bs_types";
import type { BooksDate } from "./bs_versioning";
import { getBlob, getTree, GitTree, fetchRef, parseGitHubUrl } from "./github";
import { getDataObject } from "./bs_main";
import { convertToJson, getExtension, isAllowedExtension } from "./bs_convert";
import { GithubGameSystemRow } from "~/assets/ts/types/db_types";

export class GithubGameSystemFiles extends GameSystemFiles {
  tree?: GitTree;
  constructor(
    public url: string,
    public ref: string,
    public sha?: string,
    public bsid?: string,
  ) {
    super();
  }

  async getTree() {
    if (this.tree) return this.tree;
    const { githubName, githubOwner } = parseGitHubUrl(this.url);
    const { ref } = await fetchRef(githubOwner, githubName, this.ref);
    const tree = await getTree(githubOwner, githubName, ref || "");
    this.tree = tree;
    if (tree.sha !== this.sha && this.bsid) {
      // Add files that are not currently stored (eg recently added catalogues) as they will never be updated otherwise
      const current = new Set();
      const gsts = [] as string[];
      await cataloguesdexie.systemrows.each((o: Partial<GithubGameSystemRow>) => {
        if (o.repoUrl && o.bsid && o.repoUrl === this.url) {
          gsts.push(o.bsid);
        }
      });
      await cataloguesdexie.catalogues
        .where("content.catalogue.gameSystemId")
        .anyOf(gsts)
        .each((o) => {
          current.add(o.content.catalogue.fullFilePath);
        });
      await cataloguesdexie.systems
        .where("id")
        .anyOf(gsts)
        .each((o) => {
          current.add(o.content.gameSystem.fullFilePath);
        });
      let count = 0;
      for (const treeFile of tree.tree) {
        const path = treeFile.path;
        if (!path) continue;
        if (path?.includes("/")) continue;
        if (path?.startsWith(".")) continue;
        if (!isAllowedExtension(path)) continue;
        if (current.has(path)) continue;
        const extension = getExtension(path);
        const content = await getBlob(treeFile.url!);
        const json = await convertToJson(content, extension);
        const data = getDataObject(json);
        data.fullFilePath = treeFile.path;
        data.sha = treeFile.sha;

        if (json.catalogue && data.gameSystemId === this.getId()) {
          await this.setCatalogue(json);
        }
        count++;
      }
      if (count) {
        showMessage({ msg: `Added ${count} catalogues` });
      }
    }
    return tree;
  }

  async getData(catalogueLink: BSICatalogueLink, booksDate?: BooksDate | undefined): Promise<BSIData> {
    const current = await super.getData(catalogueLink, booksDate);
    try {
      const obj = getDataObject(current);
      const { tree } = await this.getTree();
      const treeFile = tree.find((o) => o.path === obj.fullFilePath);
      if (treeFile?.url && treeFile.path && treeFile.sha !== obj.sha) {
        const extension = getExtension(treeFile.path);
        const content = await getBlob(treeFile.url);
        const json = await convertToJson(content, extension);
        const data = getDataObject(json);
        data.fullFilePath = treeFile.path;
        data.sha = treeFile.sha;
        if (json.gameSystem) {
          await this.setSystem(json);
        } else if (json.catalogue) {
          await this.setCatalogue(json);
        }
        showMessage({ msg: `Updated ${treeFile.path} to v${data.revision}` });
        return json;
      }
    } catch (e) {
      console.error(e);
    }
    return current;
  }
}
