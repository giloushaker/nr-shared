import { unzip } from "unzipit";
import { XMLParser } from "fast-xml-parser";
import { hashFnv32a, to_snake_case } from "./bs_helpers";

export function xmlToJson(data: string) {
  try {
    // remove self-closing tags (<image />)
    data = data.replace(/<[a-zA-Z0-9]+ *[/]>/g, "");
  } catch {}
  const options = {
    ignoreAttributes: false,
    attributeNamePrefix: "",
    attrNodeName: false,
    textNodeName: "$text",
    ignoreNameSpace: true,
    parseNodeValue: true,
    parseAttributeValue: true,
    trimValues: true,
    parseTrueNumberOnly: false,
    arrayMode: false,
  };
  return new XMLParser(options).parse(data);
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
export function BSXmlToJson(data: string) {
  const result = xmlToJson(data);
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
      throw new Error("Extension not supported");
  }
}
