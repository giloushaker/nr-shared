import { unzip } from "unzipit";
import { X2jOptionsOptional, XMLParser, XMLBuilder, XmlBuilderOptionsOptional } from "fast-xml-parser";
import { forEachValueRecursive, hashFnv32a, isObject, removePrefix, to_snake_case } from "./bs_helpers";
import { rootToJson, getDataObject, goodJsonArrayKeys } from "./bs_main";
import { BSICatalogue, BSIGameSystem } from "./bs_types";
import { Catalogue } from "./bs_main_catalogue";

import _containerTags from "./containerTags.json";
import { entries } from "~/assets/json/entries";

const escapedHtml = /&(?:amp|lt|gt|quot|#39|apos);/g;
const htmlUnescapes = {
  "&amp;": "&",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

const unescape = (string: string) =>
  escapedHtml.test(string) ? string.replace(escapedHtml, (match) => htmlUnescapes[match]) : string;

const containerTags = _containerTags as Record<string, string>;
const containers = {} as Record<string, string>;
for (const key in containerTags) {
  containers[containerTags[key]] = key;
}
const allowed = {} as Record<string, Set<string> | string>;
for (const [key, value] of Object.entries(entries)) {
  if (typeof value.allowedChildrens === "string") {
    allowed[key] = value.allowedChildrens;
  } else {
    allowed[key] = new Set(value.allowedChildrens);
  }
}

export function xmlToJson(data: string, arrayKeys: Set<string>) {
  const options: X2jOptionsOptional = {
    allowBooleanAttributes: true,
    ignoreAttributes: false,
    attributeNamePrefix: "",
    textNodeName: "$text",
    parseAttributeValue: true,
    processEntities: false,
    parseTagValue: false,
    ignoreDeclaration: true,
    isArray: (tagName: string, jPath: string, isLeafNode: boolean, isAttribute: boolean) => {
      return !isAttribute && tagName in containers;
    },
    attributeValueProcessor: (name, val) => unescape(val),
    tagValueProcessor: (name, val) => unescape(val),
  };
  return new XMLParser(options).parse(data);
}

export async function unzipFolder(file: string | ArrayBuffer | Blob, path: string) {
  const unzipped = await unzip(file);
  const result = {} as Record<string, ArrayBuffer | string>;
  console.log("unzipping folder", unzipped, "path", path);
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
  const unzipped = await unzip(file);
  for (const entry of Object.values(unzipped.entries)) {
    const data = await entry.text();
    return data;
  }
  throw "unzipFile failed: No Entries";
}

const zipExtensions = ["gstz", "zip", "catz"];
const allowedExtensions = ["gst", "gstz", "xml", "zip", "cat", "catz", "json"];
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
  sharedRules: "shareRule",
  sharedProfiles: "sharedProfile",
  sharedInfoGroups: "sharedInfoGroup",
  sharedSelectionEntries: "sharedSelectionEntry",
  sharedSelectionEntryGroups: "sharedSelectionEntryGroup",
} as Record<string, string>;
/**
 * Converts a {profiles: [{profile: {}}]} to {profiles: [{}]}
 * From https://github.com/BlueWinds/bsd-schema/blob/main/index.js
 */

function normalize(x: any) {
  for (let attr in x) {
    if (x[attr] === "") {
      delete x[attr];
    } else if (containerTags[attr] && x[attr]) {
      if (attr in oldBuggedTypes) {
        const normal = x[attr][containerTags[attr]];
        const old = x[attr][oldBuggedTypes[attr]];
        x[attr] = [...(Array.isArray(normal) ? normal : []), ...(Array.isArray(old) ? old : [])];
      } else {
        x[attr] = x[attr][containerTags[attr]];
      }
      x[attr]?.forEach(normalize);
    }
  }
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
  const lookup = entries as Record<string, any>;
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
  const result = xmlToJson(data, goodJsonArrayKeys);
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
export const stringArrayKeys = new Set(["readme", "comment", "description"]);
const skipKeys = new Set(["?xml", "$text", "_"]);
function renestChilds(obj: any) {
  for (const [key, value] of Object.entries(obj)) {
    if (stringArrayKeys.has(key)) {
      obj[key] = Array.isArray(value) ? value : [value];
    } else if (Array.isArray(value) && !skipKeys.has(key)) {
      obj[key] = [{ [toSingle(key)]: value }];
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
        if (skipKeys.has(key) || stringArrayKeys.has(key)) continue;
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
  putAttributesIn$(getDataObject(json));
  const options: XmlBuilderOptionsOptional = {
    textNodeName: "$text",
    format: true,
    attributeNamePrefix: "_",
    ignoreAttributes: false,
    suppressBooleanAttributes: false,
    suppressEmptyNode: true,
  };
  const builder = new XMLBuilder(options);
  const xml = builder.build(json);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` + xml;
}
