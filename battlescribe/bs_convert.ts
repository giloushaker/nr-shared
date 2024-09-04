import { unzip } from "unzipit";
import { X2jOptions, XMLParser, XMLBuilder, XmlBuilderOptions } from "fast-xml-parser";
import { forEachValueRecursive, hashFnv32a, isObject, removePrefix, to_snake_case } from "./bs_helpers";
import { rootToJson, getDataObject, goodJsonArrayKeys } from "./bs_main";
import type { BSICatalogue, BSIGameSystem } from "./bs_types";
import type { Catalogue } from "./bs_main_catalogue";
export const containerTags = {
  categories: "category",
  catalogueLinks: "catalogueLink",
  categoryEntries: "categoryEntry",
  categoryLinks: "categoryLink",
  characteristics: "characteristic",
  characteristicTypes: "characteristicType",
  conditions: "condition",
  conditionGroups: "conditionGroup",
  constraints: "constraint",
  costs: "cost",
  costLimits: "costLimit",
  costTypes: "costType",
  entryLinks: "entryLink",
  forceEntries: "forceEntry",
  infoGroups: "infoGroup",
  infoLinks: "infoLink",
  forces: "force",
  modifiers: "modifier",
  modifierGroups: "modifierGroup",
  profiles: "profile",
  profileTypes: "profileType",
  publications: "publication",
  repeats: "repeat",
  rules: "rule",
  selections: "selection",
  selectionEntries: "selectionEntry",
  selectionEntryGroups: "selectionEntryGroup",
  sharedInfoGroups: "infoGroup",
  sharedProfiles: "profile",
  sharedRules: "rule",
  sharedSelectionEntries: "selectionEntry",
  sharedSelectionEntryGroups: "selectionEntryGroup",

  associations: "association",
} as Record<string, string | undefined>;
export const textNodeTags = new Set(["description", "readme", "comment"]);
export const textArrayTags = new Set(["alias"]);
import { entries } from "./entries";

const escapedHtml = /&(?:amp|lt|gt|quot|#39|apos);/g;
const htmlUnescapes = {
  "&amp;": "&",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
} as Record<string, string | undefined>;

const unescape = (string: string) =>
  escapedHtml.test(string) ? string.replace(escapedHtml, (match) => htmlUnescapes[match]!) : string;

const containers = {} as Record<string, string>;
for (const key in containerTags) {
  containers[containerTags[key]!] = key;
}
const allowed = {} as Record<string, Set<string> | string>;
for (const [key, value] of Object.entries(entries)) {
  if (typeof value.allowedChildrens === "string") {
    allowed[key] = value.allowedChildrens;
  } else {
    allowed[key] = new Set(value.allowedChildrens);
  }
}
function parseValue(str: string): any {
  switch (str) {
    case "true":
      return true;
    case "false":
      return false;
    default:
      //@ts-ignore
      if (isNaN(str)) {
        return str;
      }

      const float = parseFloat(str);
      if (isFinite(float) && str.includes("+") == false) return float;

      return str;
  }
}
export function xmlToJson(data: string) {
  const options: X2jOptions = {
    allowBooleanAttributes: true,
    ignoreAttributes: false,
    attributeNamePrefix: "",
    textNodeName: "$text",
    processEntities: false,
    parseTagValue: false,
    ignoreDeclaration: true,
    alwaysCreateTextNode: false,
    trimValues: false,
    isArray: (tagName: string, jPath: string, isLeafNode: boolean, isAttribute: boolean) => {
      return !isAttribute && (tagName in containers || textArrayTags.has(tagName));
    },
    attributeValueProcessor: (name: string, val: string) => {
      return parseValue(unescape(val));
    },
    tagValueProcessor: (name: string, val: string) => {
      return unescape(val);
    },
  };
  return new XMLParser(options).parse(data);
}

export async function unzipFolder(file: string | ArrayBuffer | Blob, path: string) {
  const unzipped = await unzip(file);
  const result = {} as Record<string, ArrayBuffer | string>;

  for (const entry in unzipped.entries) {
    const value = unzipped.entries[entry];
    if (value.isDirectory) {
      // folder
      continue;
    }
    const file = removePrefix(removePrefix(entry, path), "/");
    if (file.startsWith(".")) {
      // git file
      continue;
    }
    const data = isZipExtension(file) ? await value.arrayBuffer() : await value.text();
    result[file] = data;
  }
  return result;
}

export async function unzipFile(file: string | ArrayBuffer | Blob): Promise<string> {
  if (typeof file === "string") {
    var enc = new TextEncoder();
    file = enc.encode(file);
  }
  const unzipped = await unzip(file);
  for (const entry of Object.values(unzipped.entries)) {
    const data = await entry.text();
    return data;
  }
  throw "unzipFile failed: No Entries";
}

const zipExtensions = ["gstz", "zip", "catz"];
const allowedExtensions = ["gst", "gstz", "cat", "catz", "json"];
export function removeExtension(extension_or_file: string) {
  const idx = extension_or_file.lastIndexOf(".");
  if (idx === -1) return extension_or_file;
  return extension_or_file.substring(0, idx);
}
export function getExtension(extension_or_file: string) {
  const extension = extension_or_file.split(".").pop()!.toLowerCase();
  return extension;
}
export function isZipExtension(extension_or_file: string) {
  const extension = getExtension(extension_or_file);
  return zipExtensions.includes(extension);
}
export function isAllowedExtension(file: string) {
  const fileExtension = getExtension(file);
  if (!allowedExtensions.includes(fileExtension)) {
    return false;
  }
  return true;
}
const oldBuggedTypes = {
  sharedRules: "sharedRule",
  sharedProfiles: "sharedProfile",
  sharedInfoGroups: "sharedInfoGroup",
  sharedSelectionEntries: "sharedSelectionEntry",
  sharedSelectionEntryGroups: "sharedSelectionEntryGroup",
} as Record<string, string>;
/**
 * Converts a {profiles: [{profile: {}}]} to {profiles: [{}]}
 * From https://github.com/BlueWinds/bsd-schema/blob/main/index.js
 */

export function normalize(x: any) {
  for (let attr in x) {
    if (x[attr] === "") {
      delete x[attr];
    } else if (containerTags[attr] && x[attr]) {
      if (attr in oldBuggedTypes) {
        const normal = x[attr][containerTags[attr] as string];
        const old = x[attr][oldBuggedTypes[attr]];
        x[attr] = [...(Array.isArray(normal) ? normal : []), ...(Array.isArray(old) ? old : [])];
        x[attr]?.forEach(normalize);
      } else {
        const val = x[attr][containerTags[attr] as string];

        // Remove empty arrays that become an incorrect element
        if (Array.isArray(val)) {
          x[attr] = val;
          x[attr]?.forEach(normalize);
        } else if (isObject(x[attr])) {
          delete x[attr];
        }
      }
    } else if (textNodeTags.has(attr) && typeof x[attr] === "object" && !Array.isArray(x[attr])) {
      x[attr] = x[attr]["$text"] ?? "";
    }
  }
  return x;
}
export function is_allowed(x: any, parentKey: string, k: string) {
  const lookedUp = allowed[k];
  if (typeof lookedUp === "string") {
    return x.target[lookedUp] === parentKey;
  }
  return lookedUp?.has(parentKey);
}
export function clean(x: any, k: string) {
  const lookedUp = allowed[k];
  const allowedChilds = (typeof lookedUp === "string" ? allowed[x[lookedUp]] : lookedUp) as Set<string>;
  for (let attr in x) {
    if (attr in containerTags && Array.isArray(x[attr])) {
      if (allowedChilds && !allowedChilds.has(attr)) {
        delete x[attr];
      } else {
        x[attr].forEach((o: any) => clean(o, attr));
      }
    }
  }
}
const empty = new Set<string>();
export function allowed_children(obj: any, key: string): Set<string> {
  let result = allowed[key];
  if (typeof result === "string") {
    const val = obj[result];
    if (val) {
      const new_key = toPlural(val);
      if (typeof new_key !== "string" || new_key === result) {
        return empty;
      }
      result = allowed[new_key];
    }
  }
  if (!result) {
    return empty;
  }
  return result as Set<string>;
}
export function BSXmlToJson(data: string) {
  const result = xmlToJson(data);
  normalize(getDataObject(result));
  const type = result.catalogue ? "catalogue" : "gameSystem";
  if (!result.catalogue) {
    result.playable = 0;
    result.id = 1000;
  } else {
    result.playable = 1;
    result.id = hashFnv32a(result.catalogue.id);
    result.include = [1000];
  }

  const content = result[type];
  result.name = content.name;
  result.short = to_snake_case(content.name);
  result.playable = !Boolean(content.library);
  result.version = content.battleScribeVersion;
  result.nrversion = content.revision;
  return result;
}

export async function convertToJson(data: any, extension: string) {
  extension = getExtension(extension);
  switch (extension) {
    case "xml":
    case "cat":
    case "gst":
      return BSXmlToJson(data);
    case "zip":
    case "catz":
    case "gstz":
      return BSXmlToJson(await unzipFile(data));
    case "json":
      return JSON.parse(data);
    default:
      throw new Error("Extension not supported " + extension);
  }
}

export function toSingle(key: string) {
  return containerTags[key];
}

export function toPlural(key: string) {
  return containers[key];
}
const skipKeys = new Set(["?xml", "$text", "_"]);
function renestChilds(obj: any) {
  for (const [key, value] of Object.entries(obj)) {
    if (textNodeTags.has(key) || textArrayTags.has(key)) {
      obj[key] = Array.isArray(value) ? value : [value];
    } else if (Array.isArray(value) && !skipKeys.has(key)) {
      obj[key] = [{ [toSingle(key)!]: value }];
    }
  }
}
function putAttributesIn$(first: any) {
  forEachValueRecursive(first, (current) => {
    if (typeof current === "object") {
      renestChilds(current);
    }
  });
  forEachValueRecursive(first, (current) => {
    if (typeof current === "object") {
      for (const [key, value] of Object.entries(current)) {
        if (Array.isArray(value)) continue;
        if (skipKeys.has(key) || textNodeTags.has(key)) continue;
        if (isObject(value)) continue;
        current[`_${key}`] = value;
        delete current[key];
      }
    }
  });
  return first;
}

export function convertToXml(data: BSICatalogue | Catalogue | BSIGameSystem) {
  const json = JSON.parse(rootToJson(data));
  putAttributesIn$(json);
  const options: XmlBuilderOptions = {
    textNodeName: "$text",
    format: true,
    attributeNamePrefix: "_",
    ignoreAttributes: false,
    suppressBooleanAttributes: false,
    suppressEmptyNode: true,
  };
  if (json.gameSystem) {
    json.gameSystem._xmlns = "http://www.battlescribe.net/schema/gameSystemSchema";
  }
  if (json.catalogue) {
    json.catalogue._xmlns = "http://www.battlescribe.net/schema/catalogueSchema";
  }
  const builder = new XMLBuilder(options);
  const xml = builder.build(json);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` + xml;
}
