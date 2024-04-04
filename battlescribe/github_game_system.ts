import { GameSystemFiles } from "~/assets/shared/battlescribe/local_game_system"
import type { BSICatalogueLink, BSIData } from "./bs_types"
import type { BooksDate } from "./bs_versioning"
import { getBlob, getTree, GitTree, normalizeSha, parseGitHubUrl } from "./github"
import { getDataObject } from "./bs_main"
import { convertToJson, getExtension } from "./bs_convert"


export class GithubGameSystemFiles extends GameSystemFiles {
    tree?: GitTree
    constructor(public url: string, public sha: string) {
        super()
    }

    async getTree() {
        if (this.tree) return this.tree;
        const { githubName, githubOwner } = parseGitHubUrl(this.url)
        const sha = await normalizeSha(githubOwner, githubName, this.sha)
        const tree = await getTree(githubOwner, githubName, sha)
        this.tree = tree
        return tree;

    }
    async getData(catalogueLink: BSICatalogueLink, booksDate?: BooksDate | undefined): Promise<BSIData> {
        const current = await super.getData(catalogueLink, booksDate)
        try {
            const obj = getDataObject(current)
            const { tree } = await this.getTree()
            const treeFile = tree.find(o => o.path === obj.fullFilePath)
            if (treeFile?.url && treeFile.path && treeFile.sha !== obj.sha) {
                const extension = getExtension(treeFile.path);
                const { content } = await getBlob(treeFile.url)
                const json = await convertToJson(content, extension);
                const data = getDataObject(json)
                data.fullFilePath = treeFile.path;
                data.sha = treeFile.sha;
                if (json.gameSystem) {
                    this.setSystem(json)
                } else if (json.catalogue) {
                    this.setCatalogue(json)
                }
                console.log(`Updated ${treeFile.path} sha: ${obj.sha} -> ${treeFile.sha}`)
                return json
            }
        } catch (e) {
            console.error(e)
        }
        return current;
    }
}