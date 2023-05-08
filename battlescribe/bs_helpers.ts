import type { BSIProfile, BSICharacteristic } from "./bs_types";

export type Modify<T, R> = Omit<T, keyof R> & R;
export function stripNumber(str: string): string {
  return str.replace(/[0-9]+ *[.-] *(.*)/, "$1");
}
export function fix_xml_object(obj: any): void {
  const O = [obj]; // ensure that f is called with the top-level object
  while (O.length) {
    const cur: any = O.pop();
    // processing
    for (const [key, value] of Object.entries(cur)) {
      if (Array.isArray(value) && value.length === 1) {
        const container_object = value[0];
        const values = Object.values(container_object);
        if (values.length === 1 && Array.isArray(values[0])) {
          cur[key] = values[0];
        }
      }
    }
    const dollar = cur.$;
    delete cur.$;
    if (cur && typeof cur === "object") {
      O.push(...Object.values(cur)); //search all values deeper inside
    }
    if (dollar) {
      Object.assign(cur, dollar);
    }
  }
}

export function to_snake_case(str: string): string {
  return str.toLowerCase().replace(/\s/g, "_");
}
export function delete_path_related_characters(str: string): string {
  const str1 = str.replace(/([\ :])/g, "_");
  return str1.replace(/([\\\/\$\@\~\'\"\`\ \:])/g, "");
}

export function hashFnv32a(str: string, seed = 198209835): number {
  /*jshint bitwise:false */
  let i,
    l,
    hval = seed === undefined ? 0x811c9dc5 : seed;

  for (i = 0, l = str.length; i < l; i++) {
    hval ^= str.charCodeAt(i);
    hval +=
      (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
  }

  return hval >>> 0;
}
/**
 * Returns the index of the last found item which comparator function returns true for
 * If nothing returned true, returns `-1`
 * Assumes that the array is sorted
 * @param array
 * @param _function Function to compare `T`, returns true if equal.
 */
export function findLastIndexOfAssumingSorted<T>(
  array: T[],
  _function: (item: T) => boolean
): number {
  let found = -1;
  const array_length = array.length;
  for (let i = 0; i < array_length; i++) {
    if (_function(array[i])) {
      found = i;
    } //
    else if (found) {
      return found;
    }
  }
  return found;
}
/**
 * Adds an item after the lastIndexOf found which matches the comparator function
 * Assumes that the array is sorted
 * Pushes at the end of the array if nothing matches
 * @param array
 * @param value The item to add
 * @param _function Function to compare `T`, returns true if equal.
 */
export function pushAfterLastOfAssumingSorted<T>(
  array: T[],
  value: T,
  _function: (item: T) => boolean
): void {
  const index = findLastIndexOfAssumingSorted(array, _function);
  if (index === -1) array.push(value);
  else array.splice(index + 1, 0, value);
}
export function escapeRegex(str: string) {
  return str.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
}

export function groupBy<V>(
  items: V[],
  callbackfn: (item: V) => string | number = (o: any) => o.toString()
): { [key: string]: V[] } {
  const result = {} as any;
  for (let i = 0; i < items.length; i++) {
    const current = items[i];
    const key = callbackfn(current);
    const arr = result[key];
    if (!arr) {
      result[key] = [current];
    } //
    else {
      arr.push(current);
    }
  }
  return result;
}
let gitSha1: (content: string | Buffer | ArrayBuffer) => Promise<string>;
if (process.server) {
  gitSha1 = (async (content: string | Buffer) => {
    const gitstring = `blob ${content.length}\0`;
    const shasum = require("crypto").createHash("sha1");
    shasum.update(gitstring);
    shasum.update(content);
    const result = shasum.digest("hex");
    return result;
  }) as any;
} else {
  gitSha1 = (async (content: string | ArrayBuffer): Promise<string> => {
    const gitstring = `blob ${
      typeof content === "string" ? content.length : content.byteLength
    }\0`;
    const encoder = new TextEncoder();
    const data = encoder.encode(gitstring + content);
    const hash = await crypto.subtle.digest("SHA-1", data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }) as any;
}
export { gitSha1 };
/**
 * Recursively Calls callbackfn(value) for each object in the provided object
 * Travels Arrays but callbackfn(value) is not called on the array object itself
 * @param obj The object.
 * @param callbackfn The function to call with each value
 */
export function forEachValueRecursive(
  obj: any,
  callbackfn: (obj: any) => unknown
) {
  const stack = [obj];
  while (stack.length) {
    const current = stack.pop()!;

    for (const value of Object.values(current)) {
      if (value && typeof value === "object") {
        stack.push(value);
      }
    }
    if (!Array.isArray(current)) {
      callbackfn(current);
    }
  }
}
/**
 * Recursively Calls callbackfn(value, key) for each object in the provided object
 * Travels Arrays but callbackfn is not called with the array object itself
 * @param obj The object.
 * @param callbackfn The function to call with each value
 */
export function forEachPairRecursive(
  obj: any,
  callbackfn: (obj: any, key: string) => unknown
) {
  const stack = [obj];
  while (stack.length) {
    const current = stack.pop()!;
    if (!isObject(current)) continue;

    for (const key of Object.keys(current)) {
      const value = current[key];
      if (isObject(value)) {
        //Array
        if (Array.isArray(current)) {
          for (const _value of value) {
            callbackfn(_value, key);
            stack.push(value);
          }
        }
        // Object
        else {
          callbackfn(value, key);
          stack.push(value);
        }
      }
      // Primitive
      else {
        callbackfn(value, key);
      }
    }
  }
}

type ValuesToSet = any;
export interface PatchIndex {
  [field: string]: {
    [value: string]: ValuesToSet;
  };
}
export interface PatchCondition {
  type: "if" | "not" | "or";
  field: string;
  value: any;
}
export function shouldPatch(obj: any, conditions: PatchCondition[]): boolean {
  for (const condition of conditions) {
    switch (condition.type) {
      case "or": {
        if (!condition.value.includes(obj[condition.field])) return false;
        break;
      }
      case "not": {
        if (obj[condition.field] === condition.value) return false;
        break;
      }
      case "if":
      default: {
        if (obj[condition.field] !== condition.value) return false;
        break;
      }
    }
  }
  return true;
}
export function patchJson(json: any, patches: PatchIndex): number {
  let changes = 0;
  forEachValueRecursive(json, (obj) => {
    for (const field of Object.keys(patches)) {
      const fieldMatchPatches = patches[field];
      const currentValue = obj[field];
      const match = fieldMatchPatches[currentValue];
      if (!match) continue;
      if (!match.$patchConditions || shouldPatch(obj, match.$patchConditions)) {
        Object.assign(obj, match);
        changes++;
        delete obj.$patchConditions;
        if (match.$patchPush) {
          for (const [key, arr] of Object.entries(match.$patchPush)) {
            const newObject = JSON.parse(JSON.stringify(arr));
            if (!(key in obj)) {
              obj[key] = [];
            }
            if (Array.isArray(newObject)) {
              obj[key].push(...newObject);
            } else {
              obj[key].push(newObject);
            }
          }
          delete obj.$patchPush;
        }
      }
    }
  });
  return changes;
}

export interface BSIGroupedProfile extends BSIProfile {
  big: BSICharacteristic[];
  small: BSICharacteristic[];
}

/**
 * Groups profiles and adds a `big` and `small` field
 * `small` contains any characteristic whose max size is < `bigStringLength`
 * `big`   contains any characteristic whose max size is >= `bigStringLength`
 * @param profiles The profiles to group
 * @param bigStringLength Any string above this length is considered `big`
 */
export function groupProfiles(
  profiles: BSIProfile[],
  bigStringLength = 40
): BSIGroupedProfile[][] {
  const allVisible = (profiles as Array<BSIGroupedProfile>).filter(
    (o) => !o.hidden
  );
  const uniques = hashProfiles(allVisible);

  const groupedByType = groupBy(uniques, (o) => o.typeId);
  for (const key of Object.keys(groupedByType)) {
    const value = groupedByType[key];
    groupedByType[key] = value
      .map((o) => [o.name, o] as [string, BSIGroupedProfile])
      .sort()
      .map(([, v]) => v);
  }
  const profilesByType = Object.values(groupedByType).filter((o) => o.length);
  for (const profiles of profilesByType) {
    const maxes = {} as Record<string, number>;
    for (const profile of profiles) {
      for (const characteristic of profile.characteristics) {
        maxes[characteristic.typeId] = Math.max(
          characteristic.$text?.toString().length || 0,
          maxes[characteristic.typeId] || 0
        );
      }
    }
    for (const profile of profiles) {
      profile.big = [] as BSICharacteristic[];
      profile.small = [] as BSICharacteristic[];
      for (const characteristic of profile.characteristics) {
        const maxCharacteristicLength = maxes[characteristic.typeId];
        if (maxCharacteristicLength > bigStringLength) {
          profile.big.push(characteristic);
        } else {
          profile.small.push(characteristic);
        }
      }
    }
  }

  const result = sortBy(
    profilesByType.filter((o) => o.length),
    (pbt) => pbt[0].typeName
  );
  return result;
}

export function isProfileModified(profile: BSIProfile) {
  for (const characteristic of profile.characteristics) {
    if (
      characteristic.originalValue !== undefined &&
      characteristic.originalValue !== characteristic.$text
    )
      return true;
  }
  return false;
}
export function hashProfile(profile: BSIProfile): string {
  const copy = JSON.parse(JSON.stringify(profile));
  delete copy.id;
  return JSON.stringify(copy);
}
export function indexProfiles<T extends BSIProfile | BSIGroupedProfile>(
  profiles: T[]
): Record<string, T> {
  const hashed: { [hash: string]: T } = {};
  for (const profile of profiles) {
    hashed[hashProfile(profile)] = profile;
  }
  const names: Record<string, number> = {};

  const modifieds = [];
  for (const profile of Object.values(hashed)) {
    if (isProfileModified(profile)) {
      modifieds.push(profile);
      continue;
    }
    // Unmodified Profiles
    names[profile.name] = 1;
  }

  for (const profile of modifieds) {
    const num = names[profile.name] || 1;
    names[profile.name] = num + 1;
    const end = `[${num}]`;
    if (!profile.name.endsWith(end)) profile.name += end;
  }
  return hashed;
}

export function getProfilesFromIndex<T extends BSIProfile | BSIGroupedProfile>(
  index: Record<string, T>
): T[] {
  const result = [];
  const modifieds = [];
  for (const profile of Object.values(index)) {
    if (!isProfileModified(profile)) result.push(profile);
    else modifieds.push(profile);
  }
  result.push(...modifieds);
  return result as any;
}

export function hashProfiles<T extends BSIProfile | BSIGroupedProfile>(
  profiles: T[]
): T[] {
  const hashed = indexProfiles(profiles);
  return getProfilesFromIndex(hashed);
}

export function keyCmp([a]: any, [b]: [string, any]) {
  return a.localeCompare(b, undefined, { numeric: true });
}
export function keyCmpInversed([a]: [string, any], [b]: [string, any]) {
  return b.localeCompare(a, undefined, { numeric: true });
}
export interface Sortable {
  toString: () => string;
}

export function sortBy<T>(array: T[], getKey: (item: T) => Sortable): T[] {
  return array
    .map((o) => [getKey(o).toString(), o] as [string, T])
    .sort(keyCmp)
    .map(([, v]) => v);
}
export function sortByAscending<T>(
  array: T[],
  getKey: (item: T) => Sortable
): T[] {
  return array
    .map((o) => [getKey(o).toString(), o] as [string, T])
    .sort(keyCmp)
    .map(([, v]) => v);
}

export function sortByDescending<T>(
  array: T[],
  getKey: (item: T) => Sortable
): T[] {
  return array
    .map((o) => [getKey(o).toString(), o] as [string, T])
    .sort(keyCmpInversed)
    .map(([, v]) => v);
}
export function findMax<T>(array: T[], getKey: (item: T) => any): T {
  if (!array.length) return undefined as any;
  let last = array[0];
  let lastVal = getKey(last).toString();
  for (const v of array) {
    const newVal = getKey(v).toString();
    if (newVal.localeCompare(lastVal, undefined, { numeric: true }) === 1) {
      last = v;
      lastVal = newVal;
    }
  }
  return last;
}

export function findMin<T>(array: T[], getKey: (item: T) => any): T {
  if (!array.length) return undefined as any;
  let last = array[0];
  let lastVal = getKey(last).toString();
  for (const v of array) {
    const newVal = getKey(v).toString();
    if (newVal.localeCompare(lastVal, undefined, { numeric: true }) === -1) {
      last = v;
      lastVal = newVal;
    }
  }
  return last;
}
// Removes all values form setA with are in setB
export function diffSet<T>(_setA: Set<T>, _setB: Set<T>): T[] {
  const result = [];
  for (const v of _setB.values()) {
    if (!_setA.delete(v)) {
      result.push(v);
    }
  }
  for (const v of _setA.values()) {
    result.push(v);
  }
  return result;
}
class NoObserveCache {
  lock = 0;
  max = 1;
  get [Symbol.toStringTag](): string {
    return "ObjectNoObserve";
  }
}

export class CacheEvent<T> {
  id: string;
  cache!: T;
  no_vue = new NoObserveCache();
  cache_valid = false;
  constructor(
    cache: T,
    max = 1,
    private fn: (...args: any[]) => unknown,
    private thisArg: any
  ) {
    this.cache = cache;
    this.no_vue.max = max;
    this.id = fn.name;
  }
  invalidate(...args: any[]): void {
    this.cache_valid = false;
    if (this.no_vue.lock === 0) this.fn.call(this.thisArg, ...args);
  }
  can_proceed(): boolean {
    if (this.no_vue.lock >= this.no_vue.max) {
      // console.warn("prevented loop");
      return false;
    }
    if (this.cache_valid) {
      return false;
    }
    this.no_vue.lock += 1;
    return true;
  }
  set_cache(obj: T) {
    this.cache = obj;
    this.cache_valid = true;
  }
  end(obj: T): T {
    this.cache = obj;
    this.no_vue.lock -= 1;
    this.cache_valid = true;
    return obj;
  }
  result(): T {
    return this.cache;
  }
}

export class Cache<T> {
  cache!: T;
  no_vue = new NoObserveCache();
  cache_valid = false;
  constructor(cache: T, max = 1, public id: string) {
    this.cache = cache;
    this.no_vue.max = max;
  }
  invalidate(): void {
    this.cache_valid = false;
  }
  can_proceed(): boolean {
    if (this.no_vue.lock >= this.no_vue.max) {
      return false;
    }
    if (this.cache_valid) return false;

    this.no_vue.lock += 1;
    return true;
  }
  set_cache(obj: T) {
    this.cache = obj;
    this.cache_valid = true;
  }
  end(obj: T): T {
    this.cache = obj;
    this.no_vue.lock -= 1;
    this.cache_valid = true;
    return obj;
  }
  result(): T {
    return this.cache;
  }
}

export function suffixIf(value: any, suffix: string): string {
  if (value) return value.toString() + suffix;
  return "";
}
export function prefixIf(prefix: string, value: any): string {
  if (value) return prefix + value.toString();
  return "";
}
export function surroundIf(prefix: string, value: any, suffix: string): string {
  if (value) return prefix + value.toString() + suffix;
  return "";
}
export function betweenIf(value1: any, between: string, value2: any): string {
  if (value1 && value2) return `${value1}${between.toString()}${value2}`;
  return `${value1}${value2}`;
}
export function textIf(condition: any, value1: any): string {
  return condition ? value1 : "";
}
export function cleanName(name: string): string {
  return stripNumber(name).trim();
}
export function replaceKey(obj: Record<string, any>, key: string, to: string) {
  if (key in obj) {
    obj[to] = obj[key];
    delete obj[key];
  }
}
export function countKeys(strings: string[]): Record<string, number> {
  const result = {} as Record<string, number>;
  for (const key of strings) {
    result[key] = 1 + (result[key] || 0);
  }
  return result;
}

export type Recursive<T> = { self: T; childs: Recursive<T>[] };
export type Flattened<T> = Array<{ depth: number; current: T }>;
export function flattenRecursive<T>(
  obj: Recursive<T>,
  depth = 0,
  result: Flattened<T> = []
): Flattened<T> {
  result.push({ depth: depth, current: obj.self });
  for (const child of obj.childs) {
    flattenRecursive(child, depth + 1, result);
  }
  return result;
}

export function recurseThis<T, K extends keyof T, F = T[K]>(
  obj: T,
  functionName: K,
  maxDepth = 3,
  depth = 0
): F extends () => any
  ? Recursive<ReturnType<F> extends any[] ? ReturnType<F>[0] : never>
  : never {
  const result = {
    childs: [] as Recursive<T>[],
    self: obj,
  };

  if (depth < maxDepth) {
    const results = (obj[functionName] as any)() as any[];
    for (const cur of results) {
      result.childs.push(recurseThis(cur, functionName, depth + 1));
    }
  }

  return result as any;
}

type WithParent<T> = T & { parent: WithParent<T> | undefined };
export function recurseFn<T, RT = Recursive<WithParent<T>>>(
  obj: T,
  _function: (obj: T) => T[] | undefined,
  maxDepth = 3,
  depth = 0
): RT {
  const result = {
    childs: [] as RT[],
    self: obj,
  };

  if (depth < maxDepth) {
    const results = _function(obj);
    if (results !== undefined) {
      for (const cur of results) {
        const next = recurseFn(cur, _function, depth + 1) as any;
        next.self.parent = obj;
        result.childs.push(next as RT);
      }
    }
  }

  return result as any;
}

export function clone<T>(obj: T): T {
  return Object.create(obj as any);
}
export function copy<T>(obj: T): T {
  return Object.assign(Object.create(Object.getPrototypeOf(obj)), obj);
}

export function arrayRemove<T>(arr: T[], obj: T): boolean {
  const index = arr.findIndex((o) => o === obj);
  if (index !== -1) {
    arr.splice(index, 1);
    return true;
  }
  return false;
}

export function addObj<T>(obj: Record<string, T[]>, key: string, val: T) {
  const found = obj[key];
  if (found) found.push(val);
  else obj[key] = [val];
}

export function add(obj: any, key: string, amount = 1) {
  const prev = obj[key] || 0;
  const next = amount + prev;
  if (amount === 0) {
    delete obj[key];
  } else {
    obj[key] = next;
  }
  return prev;
}
export function remove(obj: any, key: string, amount = 1) {
  const prev = obj[key] || 0;
  const next = prev - amount;
  if (next === 0) {
    delete obj[key];
  } else {
    obj[key] = next;
  }
  return next;
}

/** return the previous value */
export function addOne(obj: any, key: string) {
  const prev = obj[key] || 0;
  obj[key] = 1 + prev;
  return prev;
}

/** return the resulting value */
export function removeOne(obj: any, key: string) {
  const prev = obj[key] || 0;
  const next = prev - 1;
  if (next === 0) {
    delete obj[key];
  } else {
    obj[key] = next;
  }
  return next;
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function isObject(value: any): value is Object {
  return value && typeof value === "object";
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function isDefaultObject(value: any): value is Object {
  return !Boolean(Object.getPrototypeOf(Object.getPrototypeOf(value)));
}

export function removePrefix(from: string, prefix: string): string {
  if (from.startsWith(prefix)) {
    return from.substring(prefix.length);
  }
  return from;
}
export function removeSuffix(from: string, suffix: string): string {
  if (from.endsWith(suffix)) {
    return from.substring(0, from.length - suffix.length);
  }
  return from;
}

export function makeNoObserve(obj: any) {
  Object.defineProperty(obj, Symbol.toStringTag, {
    get: function () {
      return "ObjectNoObserve";
    },
  });
}

/**
 *
 * @returns all values which are in set A but not B
 */
export function setMinus<T>(setA: Set<T>, setB: Set<T>): Set<T> {
  const result = new Set<T>();
  for (const v of setA.values()) {
    if (!setB.has(v)) {
      result.add(v);
    }
  }
  return result;
}

export function combineArrays<T>(arrays: Array<T[] | undefined>): T[] {
  const result = [] as T[];
  for (const arr of arrays) {
    if (arr) result.push(...arr);
  }
  return result;
}

export function arraysEqual(a: any[], b: any[]) {
  if (a.length !== b.length) return false;

  // If you don't care about the order of the elements inside
  // the array, you should sort both arrays here.
  // Please note that calling sort on an array will modify that array.
  // you might want to clone your array first.

  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function textSearchRegex(query: string) {
  const words = escapeRegex(query).split(" ");
  const regexStr = `^(?=.*\\b${words.join(".*)(?=.*\\b")}).*$`;
  const regx = new RegExp(regexStr, "i");
  return regx;
}
