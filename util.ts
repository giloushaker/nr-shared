import JSZip, { OutputType } from "jszip";

export function getRandomKey(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export function crossRefs(tab1: Array<any>, tab2: Array<any>): boolean {
  if (tab1 == undefined || tab2 == undefined) return false;
  for (const item1 of tab1) {
    for (const item2 of tab2) {
      let str1 = item1;
      if (typeof str1 != "string") {
        str1 = str1.ref;
      }

      let str2 = item2;
      if (typeof str2 != "string") {
        str2 = str2.ref;
      }

      if (str1 == str2) {
        return true;
      }
    }
  }
  return false;
}

export function titleCase(str: string): string {
  const splitStr = str.toLowerCase().split(" ");
  for (let i = 0; i < splitStr.length; i++) {
    // You do not need to check if i is larger than splitStr length, as your for does that for you
    // Assign it back to the array
    splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);
  }
  // Directly return the joined string
  return splitStr.join(" ");
}

export function getRandomInt(max: number): number {
  return Math.floor(Math.random() * Math.floor(max));
}

function isHtml(str: string): boolean {
  // Simple check for common HTML tag patterns
  const pattern = /<[^>]+>/;
  return pattern.test(str);
}

export function stripHtml(originalString: string): string {
  if (!isHtml(originalString)) {
    return originalString;
  }

  if (originalString == null) {
    return "";
  }

  let res = originalString;

  // Spaces and endline
  res = res.replace(/[\t ]+/g, " ");

  // Replace known special characters
  res = res.replace(/&bull;/g, "•");
  res = res.replace(/&nbsp;/g, " ");
  res = res.replace(/−/g, "-");

  // Line Break tags
  res = res.replace(/<br *[/]?>/g, "\n");

  // Remove other tags
  res = res.replace(/(<([^>]+)>)/gi, "");

  // Remove other coded characters
  res = res.replace(/[&][a-zA-Z]+;/g, "");
  return res;
}

export function removeParentGroups(str: string): string {
  let parsedName = str.replace(/[~]\([^)]*\)/g, "");
  parsedName = parsedName.replace(/\([^)]*\)/g, "");
  return parsedName;
}

export function leanName(parsedName: string): string {
  parsedName = parsedName.replace(/[\n\r\t]/g, " ");
  parsedName = parsedName.replace(/[*]/g, "");
  parsedName = parsedName.replace(/[~]\([^)]*\)/g, " ");
  parsedName = parsedName.replace(/\([^)]*\)/g, " ");
  parsedName = parsedName.replace(/^[ ,]+([^ ,].*)/g, "$1");
  while (parsedName.includes("  ")) parsedName = parsedName.replace(/ {2}/g, " ");
  while (parsedName.endsWith(" ")) parsedName = parsedName.substr(0, parsedName.length - 1);
  parsedName = parsedName.replace(/Must take /g, "");
  return parsedName;
}

export function dateFormat(date: Date | string): string {
  if (typeof date === "string") {
    date = new Date(date);
  }

  const year = date.getFullYear().toString().padStart(4, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function dateTimeFormat(p: Date | string): string {
  const date = new Date(p);
  const year = date.getUTCFullYear().toString();
  let month = (date.getUTCMonth() + 1).toString();
  let day = date.getUTCDate().toString();
  const hour = date.getUTCHours();
  const minutes = date.getUTCMinutes();

  // add leading zeros if necessary
  if (month.length === 1) {
    month = "0" + month;
  }
  if (day.length === 1) {
    day = "0" + day;
  }

  return year + "-" + month + "-" + day + ` ${hour}:${minutes}`;
}

export function copyJsData(tsObject: any, json: any): void {
  for (const field in json) {
    if (!Array.isArray(json[field]) && json[field] != null) {
      tsObject[field] = json[field];
    }
  }
}

export function insertRulePrefix(sys: any, rule: { id: string }, book: string | null = null): string {
  if (rule.id.includes("-")) {
    return rule.id;
  }
  const folders = [
    "al",
    "bh",
    "cl",
    "de",
    "dh",
    "dl",
    "eos",
    "he",
    "hg",
    "id",
    "koe",
    "mh",
    "ok",
    "ong",
    "sa",
    "se",
    "ud",
    "vc",
    "vs",
    "wdg",
    "ls",
    "np",
    "er",
    "df",
    "rulebook",
    "special",
    "custom",
    "giants",
  ];

  if (book) {
    folders.sort((elt) => {
      if (elt == book) return -1;
      return 1;
    });
  }
  for (const prefix of folders) {
    const fullID = `${prefix}-${rule.id}`;
    const frule = sys.rules.rules[fullID];
    if (frule) {
      return fullID;
    }
  }
  return rule.id;
}

export function nameToRuleId(title: string, sys: any = null, book: string | null = null): string {
  const res = leanName(title)
    .toLowerCase()
    .replace(/ /g, "_")
    .replace(/[^a-zA-Z0-9_]+/g, "")
    .replace(/_x$/, "");
  if (sys == null) {
    return res;
  }
  return insertRulePrefix(sys, { id: res }, book);
}

export function toInt(val: string | number): number {
  if (typeof val == "number") {
    return val;
  }
  return parseInt(val);
}

export interface NumberedOption {
  n: number;
  name: string;
  parent: NumberedOption | null;
}

export function splitOptionList(str: string): string[] {
  const regex = / *,(?![^(]*\)) */;
  const splitString = str.split(regex);
  return splitString;
}

export function parseOption(text: string, parent: NumberedOption | null = null): NumberedOption[] {
  const resarray: NumberedOption[] = [];
  const res: NumberedOption = {
    n: 1,
    name: "",
    parent: parent,
  };
  text = text.replace(/[0-9]+ [–-] /, "");
  const match = text.match(/^(([0-9+]+x?) )?(.*)$/);
  if (!match || match.length != 4) {
    return [];
  }
  res.name = match[3];
  const leaned = leanName(res.name).toUpperCase();
  if (leaned.match(/^[SEMC][SEMC]?[SEMC]?$/)) {
    if (leaned.includes("C")) {
      resarray.push({ name: "Champion", n: 1, parent: null });
    }
    if (leaned.includes("M")) {
      resarray.push({ name: "Musician", n: 1, parent: null });
    }
    if (leaned.includes("E") || leaned.includes("S")) {
      resarray.push({ name: "Standard Bearer", n: 1, parent: null });
    }
  } else {
    if (res.name === "BSB") {
      res.name = "Battle Standard Bearer";
    }
    if (match[2] != null) {
      res.n = parseInt(match[2]);
    }

    resarray.push(res);
  }

  const matchP = text.match(/[(](.*)[)]/);
  if (matchP && matchP.length >= 2) {
    const suboptions = splitOptionList(matchP[1]);
    for (const elt of suboptions) {
      resarray.push(...parseOption(elt, res));
    }
  }

  // Parametered options
  return resarray;
}

export function arrayToIndex(arr: any[], field = "id"): any {
  const res: any = {};
  for (const item of arr) {
    res[item[field]] = item;
  }
  return res;
}

export function findSysIndex(lib: any, id_book: number): any {
  for (const sys of lib.array) {
    if (sys.books.index[id_book]) return sys.id;
  }
  return null;
}

export function logError(e: any): void {
  console.error(e);
}

export function logInfo(e: any): void {
  console.log(`INFO: ${e}`);
}

export function shallowCopy(res: any, obj: any): any {
  for (const field in obj) {
    if (typeof obj[field] != "object") {
      res[field] = obj[field];
    }
  }
  return res;
}

export function calcBattlepointsWobj(battlepoints: number[], obj: number): number[] {
  const wobj = [battlepoints[0], battlepoints[1]];
  if (obj != 0) {
    if (obj == 1) {
      wobj[0] += 3;
      wobj[1] -= 3;
    } else {
      wobj[0] -= 3;
      wobj[1] += 3;
    }
  }
  return wobj;
}

export interface CalculatedBP {
  diff: number;
  diffPercent: number;
  battlepoints: number[];
  objective: number;
  battlepointsWobj: number[];
  vp: number[];
}

/*
 ** obj: 0 if noone won, 1 if p1 won, 2 if p2 won
 */
export function calcBattlepoints(maxCost: number, p1vp: number, p2vp: number, obj: number): CalculatedBP {
  const scores = [
    [5, 10],
    [10, 11],
    [20, 12],
    [30, 13],
    [40, 14],
    [50, 15],
    [70, 16],
    [100, 17],
  ];
  const p1 = p1vp;
  const p2 = p2vp;
  const val = p1 - p2;
  const perc = Math.abs(val / maxCost) * 100;
  let found = 0;
  for (const val of scores) {
    if (perc <= val[0]) {
      break;
    }
    found++;
  }

  if (found >= 8) {
    found = 7;
  }

  let p1Score = scores[found][1];
  let p2Score = 20 - p1Score;

  if (val < 0) {
    const tmp = p1Score;
    p1Score = p2Score;
    p2Score = tmp;
  }

  const res = {
    diff: val,
    diffPercent: Math.floor(perc),
    battlepoints: [p1Score, p2Score],
    objective: obj,
    battlepointsWobj: null as any,
    vp: [p1vp, p2vp],
  };

  res.battlepointsWobj = calcBattlepointsWobj(res.battlepoints, res.objective);
  return res;
}

export function closest500(n: number): number {
  return Math.round(n / 500) * 500;
}

export function baseLog(x: number, y: number): number {
  return Math.log(y) / Math.log(x);
}

export function bookUrl(id_sys: number | string, id: number | string, date?: string | null) {
  let res = `/api/rpc?m=books_get_book&id_sys=${id_sys}&id=${id}`;

  if (date != null) {
    res += "&date=" + date;
  }

  return res;
}

// from https://stackoverflow.com/questions/3665115/how-to-create-a-file-in-memory-for-user-to-download-but-not-through-server
export function download(filename: string, mimeType: any, content: BlobPart) {
  const a = document.createElement("a");
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  a.setAttribute("href", url);
  a.setAttribute("download", filename);
  a.setAttribute("target", "_blank");
  a.click(); // Start downloading
}

// @ts-ignore
export async function zip<T extends OutputType>(filename: string, content: string, type: T = "blob") {
  const zip = new JSZip();
  zip.file(filename, content);
  const result = await zip.generateAsync<T>({ type: type, compression: "DEFLATE" });
  return result;
}

const dateStrings = {
  Y: " year",
  Ys: " years",
  M: " month",
  Ms: " months",
  D: " day",
  Ds: " days",
  h: " hour",
  hs: " hours",
  m: " minute",
  ms: " minutes",
  s: " second",
  ss: " seconds",
  now: " just now",
  ago: " ago",
  ago_pre: "",
};
export function timeSince(date: Date, strings: typeof dateStrings = dateStrings): string | undefined {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  let interval = Math.floor(seconds / 31536000); // years
  if (interval >= 2) return interval + strings.Ys;
  if (interval >= 1) return interval + strings.Y;

  interval = Math.floor(seconds / 2592000); // months
  if (interval >= 2) return interval + strings.Ms;
  if (interval >= 1) return interval + strings.M;

  interval = Math.floor(seconds / 86400); // days
  if (interval >= 2) return interval + strings.Ds;
  if (interval >= 1) return interval + strings.D;

  interval = Math.floor(seconds / 3600); // hours
  if (interval >= 2) return interval + strings.hs;
  if (interval >= 1) return interval + strings.h;

  interval = Math.floor(seconds / 60); // minutes
  if (interval >= 2) return interval + strings.ms;
  if (interval >= 1) return interval + strings.m;

  // seconds
  if (seconds >= 2) return seconds + strings.ss;
  if (seconds >= 1) return seconds + strings.s;

  return undefined;
}
export function getTimeAgoString(date?: Date | string, strings: typeof dateStrings = dateStrings): string {
  if (!date) return "";
  if (typeof date === "string") date = new Date(date);
  const time = timeSince(date);
  if (!time) return strings.now;
  return `${strings.ago_pre}${timeSince(date)}${strings.ago}`;
}

export function systemToString(name: string, version?: string | number) {
  return name + (version ? ` (${version})` : "");
}

export interface LogHookMessage {
  type: "warn" | "log" | "error";
  trace?: string;
  args: any[];
}
export class LogHook {
  messages: Array<LogHookMessage> = [];
  _log: typeof console.log | undefined;
  _warn: typeof console.warn | undefined;
  _error: typeof console.error | undefined;
  intercept?: boolean;
  constructor() {
    //
  }
  log(...args: any[]) {
    this.messages.push({
      type: "log",
      args: args,
    });
    if (!this.intercept) this._log!(...args);
  }
  warn(...args: any[]) {
    this.messages.push({
      type: "warn",
      args: args,
    });
    if (!this.intercept) this._warn!(...args);
  }
  error(...args: any[]) {
    this.messages.push({
      type: "error",
      args: args,
      trace: new Error().stack?.substring("Error".length),
    });
    if (!this.intercept) this._error!(...args);
  }
  hook(): this {
    this._log = console.log.bind(console);
    this._warn = console.warn.bind(console);
    this._error = console.error.bind(console);
    console.log = this.log.bind(this);
    console.warn = this.warn.bind(this);
    console.error = this.error.bind(this);
    return this;
  }
  collect(unhook = true): Array<LogHookMessage> {
    if (unhook) this.unhook();
    return this.messages;
  }
  unhook() {
    if (this._log && this._warn && this._error) {
      console.log = this._log;
      console.warn = this._warn;
      console.error = this._error;
      delete this._log;
      delete this._warn;
      delete this._error;
    }
  }
  static replay(messages: Array<LogHookMessage>) {
    for (const message of messages || []) {
      switch (message.type) {
        case "log":
          console.log(...message.args);
          break;
        case "warn":
          console.warn(...message.args);
          break;
        case "error":
          console.error(...message.args, message.trace);
          break;
        default:
          continue;
      }
    }
  }
}

export function groupArray<T>(arr: T[], cols: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += cols) {
    result.push(arr.slice(i, i + cols));
  }
  return result;
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffledArray = [...array];
  for (let i = shuffledArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
  }
  return shuffledArray;
}

export function prettifyTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const formattedDays = days > 0 ? `${days}d ` : "";
  const formattedHours = hours % 24;
  const formattedMinutes = minutes % 60;
  const formattedSeconds = seconds % 60;

  const timeString = `${formattedDays}${formattedHours}:${formattedMinutes
    .toString()
    .padStart(2, "0")}:${formattedSeconds.toString().padStart(2, "0")}`;

  return timeString;
}

export function shortenString(input: string): string {
  const words = input.split(/\s+/);

  // If the input string has only one word
  if (words.length === 1) {
    // Return the first two characters of that word, in lowercase
    return input.substring(0, 2).toLowerCase();
  }

  // If the input string has more than one word
  return words
    .map((word) => word[0])
    .join("")
    .toLowerCase(); // Convert the final string to lowercase
}

export function getMimeTypeFromBase64(base64String: string) {
  // Regular expression to extract MIME type from the base64 string
  const regex = /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/;
  const match = base64String.match(regex);

  // Return the extracted MIME type or null if not found
  return match ? match[1] : null;
}

export function isDateLessThanNDaysInPast(expiration: Date, n: number): boolean {
  // Get the current date and time
  const now = new Date();

  // Calculate the date that is N days before now
  const nDaysBeforeNow = new Date(now);
  nDaysBeforeNow.setDate(now.getDate() - n);

  // Check if the expiration date is after nDaysBeforeNow and before the current time
  return expiration > nDaysBeforeNow && expiration < now;
}

export function daysBetweenDates(date1: Date, date2: Date): number {
  // Calculate the difference in milliseconds
  const difference = new Date(date2).getTime() - new Date(date1).getTime();

  // Convert the difference from milliseconds to days
  // 1 day = 24 hours/day * 60 minutes/hour * 60 seconds/minute * 1000 milliseconds/second
  const days = Math.floor(difference / (1000 * 60 * 60 * 24));

  return days;
}

export function shortName(input: string): string {
  // Split the string by spaces and underscores.
  const words = input.split(/[\s_]+/);
  // Map over the words to get the first character of each, then join them.
  const abbreviation = words.map((word) => word.charAt(0).toUpperCase()).join("");
  return abbreviation;
}
