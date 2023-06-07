import { unzip } from "unzipit";
import { X2jOptionsOptional, XMLParser, XMLBuilder, XmlBuilderOptionsOptional } from "fast-xml-parser";
import { fix_xml_object, forEachValueRecursive, hashFnv32a, isObject, removePrefix, to_snake_case } from "./bs_helpers";
import { rootToJson } from "./bs_main";
import { getDataObject } from "./bs_system";
import { BSICatalogue, BSIData, BSIGameSystem } from "./bs_types";
import { Catalogue } from "./bs_main_catalogue";

export function xmlToJson(data: string) {
  try {
    // remove self-closing tags (<image />)
    data = data.replace(/<[a-zA-Z0-9]+ *[/]>/g, "");
  } catch {}
  const options: X2jOptionsOptional = {
    ignoreAttributes: false,
    attributeNamePrefix: "",
    textNodeName: "$text",
    parseAttributeValue: true,
    trimValues: true,
    isArray: (tagName: string, jPath: string, isLeafNode: boolean, isAttribute: boolean) => {
      return !isAttribute && tagName !== "catalogue" && tagName !== "gameSystem";
    },
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
export function BSXmlToJson(data: string) {
  const result = xmlToJson(data);
  fix_xml_object(result);
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
const typeMap = {} as Record<string, string>;
export function toSingle(key: string) {
  if (key in typeMap) {
    return typeMap[key];
  }
  if (key.endsWith("ies")) {
    return key.substr(0, key.length - "ies".length) + "y";
  }
  if (key.endsWith("s")) {
    return key.substr(0, key.length - "s".length);
  } else {
    throw Error(`Couldn't convert "${key}" to non-plural (modify toSingle)`);
  }
}
export function toPlural(key: string) {
  if (key.endsWith("y")) {
    return key.substr(0, key.length - "y".length) + "ies";
  } else {
    return key + "s";
  }
}
export const stringArrayKeys = new Set(["readme", "comment", "description"]);
const skipKeys = new Set(["?xml", "$text", "_"]);
function renestChilds(obj: any) {
  for (const [key, value] of Object.entries(obj)) {
    if (stringArrayKeys.has(key)) {
      obj[key] = Array.isArray(value) ? value : [value];
    } else if (Array.isArray(value) && !skipKeys.has(key)) {
      obj[key] = [{ [toSingle(key)]: value }];
    } else if (key in typeMap) {
      obj[key] = [value];
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
