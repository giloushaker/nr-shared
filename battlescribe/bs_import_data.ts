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
