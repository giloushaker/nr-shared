import { readFileSync, writeFileSync, mkdirSync, lstatSync, rmSync, existsSync } from "fs";
import { dirname } from "path";

type url = string;
export interface DateIndex {
  timestamp?: { [timestamp: string]: url | null };
  revision?: { [revision: number]: url | null };
}

/**
 * @param index the index for search in
 * @returns the latest value in the index
 */
export function getByLatestTimestamp(index: DateIndex): url | null | undefined {
  let resultTime;
  let result;
  if (!index.timestamp) return undefined;
  for (const [time, value] of Object.entries(index.timestamp)) {
    if (!resultTime || time > resultTime) {
      resultTime = time;
      result = value;
    }
  }
  return result;
}

export function toTimeStamp(date?: Date | number | string): string {
  if (date !== undefined) {
    if (typeof date === "string") {
      if (isNaN((date as unknown as number) * 1)) return new Date(date).getTime().toString();
      else return date;
    }
    if (typeof date === "string") return date;
    if (typeof date === "number") return date.toString();
    if (date instanceof Date) return date.getTime().toString();
  }
  return Date.now().toString();
}

/**
 * @returns the first value which's date is less or equal to the provided date
 * - if the date is undefined, returns the latest value possible
 * - if nothing is found: returns undefined
 * - may return null to indicate that something is gone but existed before
 * @param index The index to search in
 * @param date The date to match, if typeof is string, must be a timestamp
 * @param exact Should the date found be an exact match
 */
export function getByTimestamp(
  index: DateIndex,
  date?: Date | number | string | null,
  exact?: boolean
): url | null | undefined {
  if (!date) return getByLatestTimestamp(index);
  const timestamp = toTimeStamp(date);
  if (!index.timestamp) return undefined;
  const entries = Object.entries(index.timestamp);
  entries.sort(compareEntry).reverse();
  if (exact) {
    const found = entries.find((o) => o[0] === timestamp);
    if (found) return found[1];
    return undefined;
  } else {
    const found = entries.find((o) => o[0] <= timestamp);
    if (found) return found[1];
    if (entries.length) return entries[0][1];
    return undefined;
  }
}

export function compareEntry(a: [string, string | null], b: [string, string | null]) {
  return a[0].localeCompare(b[0]);
}

export function addByTimestamp(index: DateIndex, date: Date | string | number, value: url | null) {
  const timestamp = date instanceof Date ? date.getTime() : date.toString();
  if (!index.timestamp) index.timestamp = {};
  index["timestamp"][timestamp] = value;
}
/**
 * @param path the file path
 * @returns the index for that file, or a new one if no index was found
 */
export function getTimestampIndex(path: string): DateIndex {
  const index_path = `${path}/index.json`;
  try {
    const index = JSON.parse(readFileSync(index_path).toString());
    return index;
  } catch (e) {
    return {};
  }
}

export function isDirectory(path: string): boolean {
  try {
    if (lstatSync(path).isDirectory()) {
      return true;
    }
  } catch (e) {}
  return false;
}
/**
 * @returns the path to the file which assiocated date is less or equal to the provided date
 * - if the date is undefined, returns the latest possible
 * - if nothing is found, or an error was thrown during reading, returns undefined
 * - may return null to indicate that something is gone but existed before
 * @param path The path to the folder containing the versions & index.json
 * @param date The date to match, if typeof is string, must be a timestamp
 * @param exact Should the date found be an exact match
 */
export function getFilePathByTimestamp(
  path: string,
  date?: Date | string | null,
  exact?: boolean
): url | null | undefined {
  if (path.endsWith("/")) path = path.substring(0, path.length - 1);
  if (existsSync(path)) {
    if (!isDirectory(path)) {
      return path;
    }
  }
  const index = getTimestampIndex(path);
  const result = getByTimestamp(index, date, exact);
  if (result?.startsWith("./")) return `${path}/${result.substring(1)}`;
  return result;
}

/**
 * @returns the file which is less or equal to the provided date *
 *  - if no date is provided, uses the latest possible
 * - if nothing is found, or an error was thrown during reading, returns undefined
 * - may return null to indicate that something is gone but existed before
 * @param path The path to the folder containing the versions & index.json
 * @param date The date to match, if typeof is string, must be a timestamp
 * @param exact Should the date found be an exact match
 */
export function getFileAtDate(path: string, date?: Date | string | null, exact?: boolean): string | undefined | null {
  const found = getFilePathByTimestamp(path, date, exact);
  if (found === null || found === undefined) return found;
  return readFileSync(found, "utf-8");
}

/**
 * Saves a file and assiociates it with provided date
 * - if no date is provided, uses the current date
 * @param path The path to the folder containing the versions & index.json
 * @param date The date
 */
export function saveFileAtDate(
  path: string,
  data: string | NodeJS.ArrayBufferView,
  date?: Date,
  overwritefileName?: string
) {
  if (!date) date = new Date();
  if (overwritefileName === "index") throw Error("fileName may not be 'index'");
  const dateFormated = overwritefileName || formatDateForFilename(date);

  const fullpath = `${path}/${dateFormated}.json`;
  const relpath = `./${dateFormated}.json`;
  const dir = dirname(fullpath);
  if (existsSync(path)) {
    if (!isDirectory(path)) {
      convertFileToIndex(path);
    }
  } else {
    mkdirSync(dir, { recursive: true });
  }
  const index = getTimestampIndex(path);
  addByTimestamp(index, date, relpath);
  writeFileSync(`${dir}/index.json`, JSON.stringify(index));
  writeFileSync(fullpath, data);
}

export function formatDateForFilename(date: Date) {
  const dateFormated = `${date.getFullYear()}-${
    date.getMonth() + 1
  }-${date.getDate()}-${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
  return dateFormated;
}
export interface QueryOptions {
  [option: string]: any;
}
export interface CommitQueryOptions {
  q?: string; // Filepath
  per_page?: number;
  since?: string; // Date
  until?: string; // Date
  Authorization?: string; // access token, needs full repo rights to read private repos, format: `token ${token}`
}
export function toQuery(obj?: QueryOptions): string {
  if (!obj) return "";
  const result_query = Object.entries(obj)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}="${encodeURIComponent(v.toString())}"`)
    .join("&");
  return result_query;
}

// curl -H "Authorization: token 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" "https://api.github.com/repos/vflam/nuxt-nr/commits?q=package.json&per_page=1&until=2022"
export function githubCommitQuery(user: string, repo: string, options?: CommitQueryOptions) {
  const url = `https://api.github.com/repos/${user}/${repo}/commits?${toQuery(options)}`;
}

export function convertFileToIndex(path: string) {
  console.log(`converting to index ${path}...`);
  try {
    const file = readFileSync(path);
    rmSync(path);
    saveFileAtDate(path, file, new Date(0));
  } catch (e) {}
}
