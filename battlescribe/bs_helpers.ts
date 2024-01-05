import JSZip, { OutputType } from "jszip";
import { getRandomInt } from "../util";
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
    for (const key in cur) {
      const value = cur[key];
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

export function to_kebab_case(str: string): string {
  return str.trim().toLowerCase().replace(/\s/g, "-");
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
    hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
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
export function findLastIndexOfAssumingSorted<T>(array: T[], _function: (item: T) => boolean): number {
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
export function pushAfterLastOfAssumingSorted<T>(array: T[], value: T, _function: (item: T) => boolean): void {
  const index = findLastIndexOfAssumingSorted(array, _function);
  if (index === -1) array.push(value);
  else array.splice(index + 1, 0, value);
}
export function escapeRegex(str: string) {
  return str.replace(/([.?*+^$[\]\\(){}|-])/g, `\\$1`);
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
if (typeof window === "undefined") {
  gitSha1 = (async (content: string | Buffer) => {
    const gitstring = `blob ${content.length}\0`;
    const shasum = (await import("crypto")).createHash("sha1");
    shasum.update(gitstring);
    shasum.update(content);
    const result = shasum.digest("hex");
    return result;
  }) as any;
} else {
  gitSha1 = (async (content: string | ArrayBuffer): Promise<string> => {
    const gitstring = `blob ${typeof content === "string" ? content.length : content.byteLength}\0`;
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
export function forEachValueRecursive(obj: any, callbackfn: (obj: any) => unknown) {
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
export function forEachPairRecursive(obj: any, callbackfn: (obj: any, key: string) => unknown) {
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
      let match = fieldMatchPatches[currentValue];
      if (!match) {
        if (currentValue !== undefined && fieldMatchPatches["$any"]) {
          match = fieldMatchPatches["$any"];
        } else {
          continue;
        }
      }
      if (!match.$patchConditions || shouldPatch(obj, match.$patchConditions)) {
        if (match.$move) {
          obj[match.$move] = currentValue;
        } else {
          Object.assign(obj, match);
        }
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
    .map((o) => [(getKey(o) ?? "").toString(), o] as [string, T])
    .sort(keyCmp)
    .map(([, v]) => v);
}
export function sortByAscending<T>(array: T[], getKey: (item: T) => Sortable): T[] {
  return array
    .map((o) => [(getKey(o) ?? "").toString(), o] as [string, T])
    .sort(keyCmp)
    .map(([, v]) => v);
}

export function sortByDescending<T>(array: T[], getKey: (item: T) => Sortable): T[] {
  return array
    .map((o) => [(getKey(o) ?? "").toString(), o] as [string, T])
    .sort(keyCmpInversed)
    .map(([, v]) => v);
}
export function findMax<T>(array: T[], getKey: (item: T) => any): T {
  if (!array.length) return undefined as any;
  if (array.length == 1) {
    return array[0];
  }
  let last = array[0];
  let lastVal = getKey(last).toString();
  for (const o of array) {
    const newVal = (getKey(o) ?? "").toString();
    if (newVal.localeCompare(lastVal, undefined, { numeric: true }) === 1) {
      last = o;
      lastVal = newVal;
    }
  }
  return last;
}

export function findMin<T>(array: T[], getKey: (item: T) => any): T {
  if (!array.length) return undefined as any;
  let last = array[0];
  let lastVal = getKey(last).toString();
  for (const o of array) {
    const newVal = (getKey(o) ?? "").toString();
    if (newVal.localeCompare(lastVal, undefined, { numeric: true }) === -1) {
      last = o;
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
export function cleanName(name: string | number | boolean): string {
  return stripNumber(`${name}`).trim();
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
export function flattenRecursive<T>(obj: Recursive<T>, depth = 0, result: Flattened<T> = []): Flattened<T> {
  result.push({ depth: depth, current: obj.self });
  for (const child of obj.childs) {
    flattenRecursive(child, depth + 1, result);
  }
  return result;
}
export function forEachRecursive<T>(obj: Recursive<T>, cb: (o: Recursive<T>) => unknown) {
  for (const child of obj.childs) {
    forEachRecursive(child, cb);
  }
  cb(obj);
}

export function recurseThis<T, K extends keyof T, F = T[K]>(
  obj: T,
  functionName: K,
  maxDepth = 100,
  depth = 0
): F extends () => any ? Recursive<ReturnType<F> extends any[] ? ReturnType<F>[0] : never> : never {
  const result = {
    childs: [] as Recursive<T>[],
    self: obj,
  };

  if (depth < maxDepth) {
    const results = (obj[functionName] as any)() as any[];
    for (const cur of results) {
      result.childs.push(recurseThis(cur, functionName, maxDepth, depth + 1));
    }
  }

  return result as any;
}

type WithParent<T> = T & { parent: WithParent<T> | undefined };
export function recurseFn<T, RT = Recursive<WithParent<T>>>(
  obj: T,
  _function: (obj: T, depth: number) => T[] | undefined,
  maxDepth = 100,
  depth = 0
): RT {
  const result = {
    childs: [] as RT[],
    self: obj,
  };

  if (depth < maxDepth) {
    const results = _function(obj, depth);
    if (results !== undefined) {
      for (const cur of results) {
        const next = recurseFn(cur, _function, maxDepth, depth + 1) as any;
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
type ArrayElement<ArrayType extends readonly unknown[]> = ArrayType extends readonly (infer ElementType)[]
  ? ElementType
  : never;
type ArrayPropertyType<O, KT extends keyof O> = NonNullable<O[KT]> extends unknown[]
  ? ArrayElement<NonNullable<O[KT]>>
  : never;
export function addObjIfMissing<O, KT extends keyof O, T extends ArrayPropertyType<O, KT>>(obj: O, key: KT, val: T) {
  const found = obj[key] as unknown as T[];
  if (found && !found.includes(val)) {
    found.push(val);
    return;
  }
  (obj[key] as unknown as T[]) = [val];
}
export function addObj<O, KT extends keyof O, T extends ArrayPropertyType<O, KT>>(obj: O, key: KT, val: T) {
  const found = obj[key] as unknown as T[];
  if (found) {
    found.push(val);
    return;
  }
  (obj[key] as unknown as T[]) = [val];
}
export function addObjUnique<O, KT extends keyof O, T extends ArrayPropertyType<O, KT>>(obj: O, key: KT, val: T) {
  const found = obj[key] as unknown as T[];
  if (found && found.indexOf(val) === -1) {
    found.push(val);
    return;
  }
  (obj[key] as unknown as T[]) = [val];
}
export function popObj<O, KT extends keyof O, T extends ArrayPropertyType<O, KT>>(obj: O, key: KT, val: T) {
  const found = obj[key] as unknown as T[];
  if (found) {
    const idx = found.indexOf(val);
    if (idx >= 0) {
      found.splice(idx, 1);
    }
    return;
  }
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
  const regexStr = `^(?=.*${words.map((word) => `(?=.*${word})`).join("")}).*$`;
  const regx = new RegExp(regexStr, "i");
  return regx;
}

export function generateBattlescribeId(): string {
  return [getRandomInt(0xffff), getRandomInt(0xffff), getRandomInt(0xffff), getRandomInt(0xffff)]
    .map((o) => o.toString(16))
    .join("-");
}

// function like pythons zips
export function* enumerate_zip<T, U>(a: T[], b: U[]) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    yield [a[i], b[i]] as [T, U];
  }
  return;
}

export function escapeXml(str: any): string {
  return str.toString().replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function zipCompress<T extends OutputType>(nameInZip: string, content: string, type: T) {
  var zip = new JSZip();
  zip.file(nameInZip, content);
  const result = await zip.generateAsync({ type: type, compression: "DEFLATE" });
  return result;
}

export function debouncePromise(func: (...args: any[]) => unknown, delay: number) {
  let timeoutId: NodeJS.Timeout;

  return function (...args: any[]) {
    clearTimeout(timeoutId);

    return new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        const result = func(args);
        resolve(result);
      }, delay);
    });
  };
}
export interface hasParent<T> {
  parent?: T | undefined;
}
export function findSelfOrParentWhere<T extends hasParent<T>>(self: T, fn: (node: T) => boolean): T | undefined {
  let current = self as T | undefined;
  while (current && !Object.is(current, current.parent)) {
    if (fn(current)) return current;
    current = current.parent;
  }
  return undefined;
}
export function findParentWhere<T extends hasParent<T>>(self: T, fn: (node: T) => any): T | undefined {
  let current = self.parent;
  while (current && !Object.is(current, current.parent)) {
    if (fn(current)) return current;
    current = current.parent;
  }
  return undefined;
}
export function forEachParent<T extends hasParent<T>>(self: T, cb: (node: T) => unknown) {
  let current = self.parent;
  while (current) {
    if (!current || cb(current) === false) {
      break;
    }
    current = current.parent;
  }
}

export function first<T>(arr: Iterable<T>): T | undefined {
  for (const item of arr) {
    return item;
  }
}
export function has<T>(arr: Iterable<T>, _item: T): boolean {
  for (const item of arr) {
    if (_item === item) return true;
  }
  return false;
}

export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
export function arrayIf(bool: boolean | undefined | string | number | null | object, obj: any) {
  return bool ? [obj] : [];
}

export function inBounds(n: number, min: number, max: number) {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}
