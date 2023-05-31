import { BSIData, BSIDataCatalogue, BSIDataSystem, BSICatalogue } from "./bs_types";
import fetch from "node-fetch";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { delete_path_related_characters, hashFnv32a, gitSha1 } from "./bs_helpers";
import { unzip } from "unzipit";
import { GameSystemRow, BookRow } from "../../../assets/shared/types/db_types";
import { saveFileAtDate, getFilePathByTimestamp } from "./bs_versioning_server";
import { CatalogueExtraInfo } from "./bs_book";
import { bs_to_json } from "./bs_xml";
import { BattleScribeFile, BattleScribeRepoData, fetch_bs_repos_data, github_contents_api } from "./bs_import_data";

// -1: errors only
//  0: number of repos/files found
//  1: downloading/updating file
//  2: everything (spam)
const verbosity = -1;

// wanted to put a carriage return but it doesnt work..
function log(_verbosity: number, ...args: any) {
  if (verbosity >= _verbosity) console.log(...args);
}
// unused

export async function fetch_bs_repo_data(url: string): Promise<BattleScribeRepoData> {
  const response = await fetch(url);
  const result = (await response.json()) as BattleScribeRepoData;

  return result;
}

const BS_DATA_CACHE = "static/books/BSDATA_CACHE.json";
export function set_cached_bs_data(root: string, data: Record<string, BattleScribeRepoData>): void {
  log(1, "saving fetched bs data to cache");
  writeFileSync(`${root}/${BS_DATA_CACHE}`, JSON.stringify(data), "utf8");
}
export function get_cached_bs_data(root: string): Record<string, BattleScribeRepoData> {
  const path = `${root}/${BS_DATA_CACHE}`;
  if (!existsSync(path)) return {};
  const f = readFileSync(path, "utf8");
  return JSON.parse(f);
}

const BS_SYSTEMS_CACHE = "static/books/BATTLESCRIBE_SYSTEMS.json";
export function set_cached_systems(root: string, data: Record<string, GameSystemRow>): void {
  log(1, `saving bs systems at ${`${root}/${BS_SYSTEMS_CACHE}`}`);
  writeFileSync(`${root}/${BS_SYSTEMS_CACHE}`, JSON.stringify(data), "utf8");
}
export function get_cached_systems(root: string): Record<string, GameSystemRow> {
  const path = `${root}/${BS_SYSTEMS_CACHE}`;
  if (!existsSync(path)) return {};
  const f = readFileSync(path, "utf8");
  return JSON.parse(f) || {};
}

export async function fetch_github_repo(repo: string, user = "BSData") {
  const url = github_contents_api(user, repo);
  const res = await fetch(url);
  const result = await res.json();
  return result;
}

export async function update_bs_data(
  root: string,
  filter: string | string[] = "*",
  blackList?: string[],
  force?: boolean
): Promise<number> {
  let result = 0;
  if (force) log(0, "Force updating BSData...");
  log(0, "Fetching bs repo data...");
  const new_data = await fetch_bs_repos_data();
  log(1, `Fetching bs repo data done (${Boolean(new_data?.repositories?.length)})`);

  if (!new_data.repositories || new_data.repositories.length < 100) {
    console.warn(
      "https://battlescribedata.appspot.com/#/repos appears to be missing repositories, this should fix itself overtime"
    );
  }
  // Get cached data to avoid unnecesary downloads/fwrites

  log(0, "Getting cached bs repo data...");
  const repo_cache = get_cached_bs_data(root);
  log(1, `Getting cached bs repo data done (${Boolean(repo_cache && Object.keys(repo_cache).length)})`);

  // Get list of repos to update
  const blackListMap = blackList ? new Set(blackList) : undefined;
  let repos = [];
  for (const repo of new_data.repositories) {
    if (!repo.name) {
      console.error("Found repo with no name", repo);
      continue;
    }
    if (blackListMap?.has(repo.name)) continue;

    repos.push(repo);
  }

  const skipFilters = filter === "*";
  if (!Array.isArray(filter)) filter = filter.split(" ");

  const foundLength = repos.length;
  if (!skipFilters) repos = repos.filter((repo) => filter.includes(repo.name));

  const totalFiltered = foundLength - repos.length;

  log(0, `Found ${repos.length} repos ${totalFiltered ? `(${totalFiltered} filtered out)` : ""}`);
  const system_cache = get_cached_systems(root);

  const filteredLength = repos.length;
  repos = repos.filter((repo) => {
    const cached_repo = repo_cache[repo.name];
    if (force) return true;
    if (cached_repo && cached_repo?.lastUpdated === repo.lastUpdated) return false;
    return true;
  });

  const n_up_to_date = filteredLength - repos.length;
  if (n_up_to_date) log(0, `Found ${n_up_to_date}/${filteredLength} repos already up to date`);

  // Update each repo
  let index = 0;
  for (const repo of repos) {
    const logString = ` ${repo.name}... (${index}/${repos.length})`;
    index += 1;
    log(1, `Updating${logString}`);
    try {
      const { updated, data } = await update_bs_repo(root, repo, system_cache, logString, force);
      set_cached_systems(root, system_cache);
      repo_cache[repo.name] = data;
      set_cached_bs_data(root, repo_cache);
      if (updated) ++result;
    } catch (e) {
      console.log(e);
    }
  }
  log(0, `Done`);
  return result;
}

// export function has_bs_file(root: string, gamerepo: string, gst: string, file: string, revision?: number): boolean {
//   const path = book_path(root, gamerepo, gst, file, revision);
//   return existsSync(path);
// }

export function hasBsFile(root: string, game: string, gst: string, file: string, date?: Date): boolean {
  return getFilePathByTimestamp(getBookPath(root, game, gst, file), date) !== undefined;
}

export function getPossibleCataloguePaths(root: string, gamerepo: string, gsts: string[], file: string) {
  const result = gsts.map((gst) => getBookPath(root, gamerepo, gst, file));
  return result;
}
export function hasBsCatalogue<DataT = BSIData>(
  root: string,
  gamerepo: string,
  gsts: string[],
  file: string,
  date: string,
  revision: number
): (DataT & CatalogueExtraInfo) | false {
  const paths = getPossibleCataloguePaths(root, gamerepo, gsts, file);
  const parsedDate = new Date(date);
  for (const path of paths) {
    const found = getFilePathByTimestamp(path, parsedDate);
    if (found) {
      try {
        const j = JSON.parse(readFileSync(found).toString()) as DataT & CatalogueExtraInfo;
        if (j.nrversion >= revision) return j;
        if (j.meta !== CURRENT_ROW_META) return j;
      } catch (e) {
        continue;
      }
    }
  }
  return false;
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
export function makeBookRow(
  file: BattleScribeFile | BSICatalogue,
  gstname: string,
  lastUpdated: string,
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

type GameSystemRowIndex = Record<string, GameSystemRow>;
function getNewOrOldSystem(_new: GameSystemRowIndex, old: GameSystemRowIndex, name: string): GameSystemRow {
  const pathname = delete_path_related_characters(name);
  let system = _new[pathname];
  if (!system) {
    system = old[pathname];
    if (!system) throw Error(`couldnt find system object for catalogue ${pathname}`);
    _new[pathname] = system;
  }
  return system;
}

function addOrOverwriteBook(system: GameSystemRow, book: BookRow) {
  const mapped = {} as Record<string, BookRow>;
  for (const o of system.books) {
    mapped[o.id] = o;
  }
  mapped[book.id] = book;
  system.books = Object.values(mapped);
}

export async function update_bs_repo(
  root: string,
  repo: BattleScribeRepoData,
  systemIndex: Record<string, GameSystemRow>,
  logString?: string,
  force?: boolean
): Promise<{ updated: number; data: BattleScribeRepoData }> {
  const game_systems_to_update = [];
  const catalogues_to_update = [];
  const systems_updated: Record<string, GameSystemRow> = {};
  let current = 0;
  let result = 0;
  const repo_data = await fetch_bs_repo_data(repo.repositoryUrl);
  log(1, `found ${repo_data.repositoryFiles.length} files in ${repo.name}`);
  const gamesystems = repo_data.repositoryFiles.filter((o) => o.type === "gamesystem");
  const catalogues = repo_data.repositoryFiles.filter((o) => o.type === "catalogue");

  const gst_id_index: Record<string, string> = {};
  gamesystems.forEach((o) => (gst_id_index[o.id] = o.name));

  //=======================//
  // Get Systems to Update //
  //=======================//
  for (const gst_file of gamesystems) {
    // Check if already downloaded
    const gstFile = hasBsCatalogue<BSIDataSystem>(
      root,
      repo.name,
      [gst_file.name],
      gst_file.name,
      repo.lastUpdated,
      gst_file.revision
    );

    if (!gstFile || force || gstFile.meta !== CURRENT_ROW_META) {
      game_systems_to_update.push(gst_file);
    } // Add a similar BookRow if already downloaded
    else {
      const pathname = delete_path_related_characters(gst_file.name);
      systems_updated[pathname] = makeSystemRowFromFileData(
        repo.name,
        gst_file,
        repo.lastUpdated,
        gstFile.lastUpdated || repo.lastUpdated,
        gstFile.meta
      );
    }
  }

  //================//
  // Update Systems //
  //================//
  log(0, `found ${game_systems_to_update.length} .gst to update in ${repo.name}`);
  const total = game_systems_to_update.length;
  for (const gst_file of game_systems_to_update) {
    log(1, `updating${logString} ${gst_file.name} (${(current += 1)}/${total})`);
    const gst_root = await downloadAndConvertBsFile<BSIDataSystem>(gst_file.fileUrl);
    if (!gst_root || !gst_root.gameSystem) {
      throw Error(`failed to import gst ${gst_file.fileUrl} (import_bs_file() returned undefined or invalid object)`);
    }

    const gst = gst_root.gameSystem;
    const pathname = delete_path_related_characters(gst.name);

    const row = makeSystemRowFromFileData(repo.name, gst_file, repo.lastUpdated, repo.lastUpdated);
    systems_updated[pathname] = row;

    gst_root.meta = CURRENT_ROW_META;
    gst_root.short = repo.name;
    gst_root.version = pathname;
    gst_root.lastUpdated = repo.lastUpdated;
    gst_root.bsid = gst.id;

    gst_root.url = `https://api.github.com/repos/BSData/${repo.name}/git/blobs/${gst_root.xml_hash}`;
    await writeBsGameSystem(root, repo.name, gst_root, new Date(repo.lastUpdated));
    ++result;
  }

  //==========================//
  // Get Catalogues to Update //
  //==========================//
  for (const cat_file of catalogues) {
    // Check if already downloaded
    const catFile = hasBsCatalogue<BSIDataCatalogue>(
      root,
      repo.name,
      Object.values(gst_id_index),
      cat_file.name,
      repo.lastUpdated,
      cat_file.revision
    );
    if (!catFile || force || catFile.meta !== CURRENT_ROW_META) {
      catalogues_to_update.push(cat_file);
    } // Add a similar BookRow if already downloaded
    else {
      const system = getNewOrOldSystem(
        systems_updated,
        systemIndex,
        gst_id_index[catFile.gameSystemId || (catFile as any).bsid]
      );
      const row = makeBookRow(
        cat_file,
        system.name,
        catFile.lastUpdated || repo.lastUpdated,
        catFile.playable,
        catFile.meta
      );
      addOrOverwriteBook(system, row);
    }
  }

  //===================//
  // Update Catalogues //
  //===================//
  log(0, `found ${catalogues_to_update.length} .cat to update in ${repo.name}`);
  const total_cat = catalogues_to_update.length + game_systems_to_update.length;
  for (const cat_file of catalogues_to_update) {
    log(1, `updating${logString} ${cat_file.name} (${(current += 1)}/${total_cat})...`);
    const cat_root = await downloadAndConvertBsFile<BSIDataCatalogue>(cat_file.fileUrl);
    if (!cat_root || !cat_root.catalogue) {
      throw Error(`failed to import cat ${cat_file.fileUrl} (import_bs_file() returned undefined or invalid object)`);
    }
    const cat = cat_root.catalogue;
    const gst = gst_id_index[cat.gameSystemId];
    const gstpathname = delete_path_related_characters(gst);
    const pathname = delete_path_related_characters(cat.name);
    cat_root.gstpath = getSystemRelativePath(repo.name, gstpathname);
    cat_root.path = pathname;
    cat_root.gameSystemId = cat_root.catalogue.gameSystemId;
    cat_root.lastUpdated = repo.lastUpdated;
    cat_root.bsid = cat.id;
    cat_root.meta = CURRENT_ROW_META;
    cat_root.url = `https://api.github.com/repos/BSData/${repo.name}/git/blobs/${cat_root.xml_hash}`;
    await writeBsCatalogue(root, repo.name, gst, cat_root, new Date(repo.lastUpdated));

    const system = getNewOrOldSystem(systems_updated, systemIndex, gst_id_index[cat_root.catalogue!.gameSystemId]);
    const row = makeBookRow(cat, system.name, cat_root.lastUpdated, cat_root.playable);
    addOrOverwriteBook(system, row);
    ++result;
  }

  // write systems updated to systemIndex (this is at the end so the whole repo gets redownloaded if something throws)
  for (const [id, system] of Object.entries(systems_updated)) {
    system.last_updated = repo.lastUpdated;
    systemIndex[id] = system;
  }

  return { updated: result, data: repo_data };
}

export async function unzipFile(file: string | ArrayBuffer | Blob): Promise<string> {
  const unzipped = await unzip(await file);
  for (const entry of Object.values(unzipped.entries)) {
    const arrayBuffer = await entry.arrayBuffer();
    const nodeBuffer = Buffer.from(arrayBuffer);
    const data = nodeBuffer.toString();
    return data;
  }
  throw "unzipFile failed: No Entries";
}

/**
 * @param url Url pointing to a battlescribe `.catz` or `.gstz` file
 * @returns {BSIData} the file converted to json, with `.xml_hash` corresponding to the XML file's Sha1 (the same one as git hashobject)
 */
export async function downloadAndConvertBsFile<DataT = BSIData>(
  url: string
): Promise<(DataT & CatalogueExtraInfo) | undefined> {
  log(1, `downloading ${url}`);
  const res = await fetch(url);

  log(2, `unzipping`);
  const unzipped = await unzip(await res.arrayBuffer());

  const result = [] as Array<DataT & CatalogueExtraInfo>;
  for (const entry of Object.values(unzipped.entries)) {
    const arrayBuffer = await entry.arrayBuffer();
    const nodeBuffer = Buffer.from(arrayBuffer);
    const data = nodeBuffer.toString();
    const hash = await gitSha1(nodeBuffer);

    log(2, `converting to json, xml hash = ${hash}`);
    const as_json = bs_to_json<DataT>(data) as DataT & CatalogueExtraInfo;
    as_json.xml_hash = hash.trim();
    result.push(as_json);
  }
  return result[0];
}

export function getSystemRelativePath(game: string, gst: string) {
  gst = delete_path_related_characters(gst);
  game = delete_path_related_characters(game);
  return `${game}/${gst}.json`;
}

export function getBookPath(root: string, game: string, gst: string, name: string) {
  game = delete_path_related_characters(game);
  gst = delete_path_related_characters(gst);
  name = delete_path_related_characters(name);
  return `${root}/static/books/${game}/${gst}/${name}${name.endsWith(".json") ? "" : ".json"}`;
}

async function githubFetchIsOk(url: string) {
  const res = await fetch(url, {
    method: "HEAD",
    headers: {
      Authorization: "token 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",
    },
  });
  return res.ok;
}

export async function writeBsGameSystem(root: string, game: string, gst: BSIDataSystem, date: Date) {
  if (gst.gameSystem) {
    const copy: any = {};
    Object.assign(copy, gst);
    if (copy.url && (await githubFetchIsOk(copy.url))) {
      // delete copy.gameSystem;
    } else {
      console.log(copy.url + ": 404");
      delete copy.url;
    }
    writeBsFile(root, copy, game, gst.gameSystem.name, gst.gameSystem.name, date);
  }
}

export async function writeBsCatalogue(root: string, game: string, gst: string, cat: BSIDataCatalogue, date: Date) {
  if (cat.catalogue) {
    const copy: any = {};
    Object.assign(copy, cat);
    if (copy.url && (await githubFetchIsOk(copy.url))) {
      // delete copy.catalogue;
    } else {
      console.log(copy.url + ": 404");
      delete copy.url;
    }

    writeBsFile(root, copy, game, gst, cat.catalogue.name, date);
  }
}
export function writeBsFile(root: string, data: BSIData, game: string, gst: string, name: string, date: Date) {
  const actualData = JSON.stringify(data);

  saveFileAtDate(getBookPath(root, game, gst, name), actualData, date);
}
