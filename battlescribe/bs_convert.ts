import { ZipEntry, unzip } from "unzipit";
import { X2jOptionsOptional, XMLParser } from "fast-xml-parser";
import {
  fix_xml_object,
  hashFnv32a,
  removePrefix,
  removeSuffix,
  to_snake_case,
} from "./bs_helpers";

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
    isArray: (
      tagName: string,
      jPath: string,
      isLeafNode: boolean,
      isAttribute: boolean
    ) => {
      return (
        !isAttribute && tagName !== "catalogue" && tagName !== "gameSystem"
      );
    },
  };
  return new XMLParser(options).parse(data);
}

export async function unzipFolder(
  file: string | ArrayBuffer | Blob,
  path: string
) {
  const unzipped = await unzip(file);
  const result = {} as Record<string, string>;
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
    result[file] = await unzipped.entries[entry].text();
  }
  return result;
}

export async function unzipFile(
  file: string | ArrayBuffer | Blob
): Promise<string> {
  const unzipped = await unzip(file);
  for (const entry of Object.values(unzipped.entries)) {
    const data = await entry.text();
    return data;
  }
  throw "unzipFile failed: No Entries";
}

const allowedExtensions = ["gst", "gstz", "xml", "zip", "cat", "catz", "json"];
export function getExtension(extension_or_file: string) {
  const extension = extension_or_file.split(".").pop()!.toLowerCase();
  return extension;
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
