import nodefetch from "node-fetch";

type URL = string;
export interface BattleScribeDataIndex {
  $schema: URL;
  name: string;
  description: string;
  battleScribeVersion: string;
  facebookUrl: URL;
  repositorySourceUrl: URL;
  twitterUrl: URL;
  discordUrl: URL;
  websiteUrl: URL;
  feedUrl: URL;
  githubUrl: URL;
  repositories: BattleScribeRepoData[];
}
export interface BattleScribeRepoData {
  name: string;
  description: string;
  battleScribeVersion: string;
  version: string;
  lastUpdated: string;
  lastUpdateDescription: string;
  indexUrl: URL;
  repositoryUrl: URL;
  repositoryGzipUrl: URL;
  repositoryBsrUrl: URL;
  githubUrl: URL;
  feedUrl: URL;
  bugTrackerUrl: URL;
  reportBugUrl: URL;
  archived: boolean;
  repositoryFiles: BattleScribeFile[];
}

export interface BattleScribeFile {
  id: string;
  name: string;
  type: "gamesystem" | "catalogue";
  revision: number;
  battleScribeVersion: string;
  fileUrl: URL;
  githubUrl: URL;
  bugTrackerUrl: URL;
  reportBugUrl: URL;
  authorName: string;
  authorContact: string;
  authorUrl: URL;
}

export function github_contents_api(user: string, repo: string, dir?: string) {
  return `https://api.github.com/repos/${user}/${repo}/contents` + (dir ? `/${dir}` : "");
}

// unused
export async function github_download_blob(blob_url: string): Promise<Buffer> {
  const fetched = await nodefetch(blob_url);
  const content = (await fetched.json()) as any;
  return Buffer.from(content.content, content.encoding);
}

export async function fetch_bs_repos_data(): Promise<BattleScribeDataIndex> {
  const url =
    "https://github.com/BSData/gallery/releases/latest/download/bsdata.catpkg-gallery.json" ||
    `https://battlescribedata.appspot.com/repos`;
  const response = await nodefetch(url);
  if (!response.ok) {
    throw Error("Unable to fetch repos from appspot");
  }
  const result = (await response.json()) as BattleScribeDataIndex;
  return result;
}

export async function fetch_bs_repos_datas(bypass_cors = false): Promise<BattleScribeDataIndex> {
  const urls = [
    "https://github.com/BSData/gallery/releases/download/index-v1/bsdata.catpkg-gallery.json",
    `https://battlescribedata.appspot.com/repos`,
  ];

  const result = {} as Record<string, BattleScribeRepoData>;
  let firstResponse = null as BattleScribeDataIndex | null;
  for (const url of urls) {
    try {
      const _url = bypass_cors ? `https://corsproxy.io/?${encodeURIComponent(url)}` : url;
      console.log(url);

      const response = await nodefetch(_url);

      if (!response.ok) {
        console.log("Unable to fetch repos from appspot");
      }
      const fetched = (await response.json()) as BattleScribeDataIndex;
      if (!firstResponse) {
        firstResponse = fetched;
      }
      for (const repo of fetched.repositories || []) {
        if (!(repo.name in result)) {
          result[repo.name] = repo;
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
  if (!firstResponse) {
    throw new Error("Unable to fetch repos from any of the provided repo urls");
  }
  firstResponse.repositories = Object.values(result);
  return firstResponse;
}
