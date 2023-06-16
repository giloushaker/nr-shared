import type { GameSystemRow, BookRow } from "~/assets/ts/types/db_types";
import { delete_path_related_characters, hashFnv32a, to_snake_case } from "./bs_helpers";
import type { BSICatalogue, BSIDataSystem, BSIGameSystem } from "./bs_types";

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

export const CURRENT_ROW_META = "3";
export function makeSystemRowFromFileData(
  repo_name: string,
  gst_file: BattleScribeFile,
  repoLastUpdated: string,
  fileLastUpdated: string,
  meta = CURRENT_ROW_META
): GameSystemRow {
  const pathname = delete_path_related_characters(gst_file.name);
  return {
    bsid: gst_file.id,
    id: hashFnv32a(gst_file.name),

    short: repo_name,
    name: gst_file.name,
    path: `${repo_name}/${pathname}`,
    engine: "bs",
    books: [makeBookRow(gst_file, gst_file.name, fileLastUpdated, false)],

    nrversion: gst_file.revision,
    last_updated: repoLastUpdated,

    meta: meta,
  } as any;
}
export function makeSystemRowFromJson(system: BSIDataSystem): GameSystemRow {
  const gst_file = system.gameSystem;
  const date = Date.now().toString();
  return {
    bsid: gst_file.id,
    id: hashFnv32a(gst_file.name),
    _id: gst_file.id,
    short: gst_file.name,
    name: gst_file.name,
    path: `${gst_file.name}/${gst_file.name}`,
    engine: "bs",
    books: [makeBookRow(gst_file, gst_file.name, date, false)],

    nrversion: gst_file.revision,
    last_updated: date,

    meta: CURRENT_ROW_META,
  };
}

export function makeBookRow(
  file: BattleScribeFile | BSICatalogue | BSIGameSystem,
  gstname: string,
  lastUpdated: string | undefined,
  playable = true,
  meta = CURRENT_ROW_META
): BookRow {
  const pathname = delete_path_related_characters(file.name);
  return {
    bsid: file.id,
    id: hashFnv32a(file.id),
    id_game_system: hashFnv32a(gstname),

    name: file.name,
    filename: pathname,
    short: pathname,
    playable: playable,

    nrversion: file.revision,
    last_updated: lastUpdated,

    meta: meta,
  };
}
