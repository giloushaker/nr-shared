import type { BSIData } from "./bs_types";
import type { CatalogueExtraInfo } from "./bs_book";
import { parseString } from "xml2js";
import { fix_xml_object, hashFnv32a, to_snake_case } from "./bs_helpers";

export function xml_to_json(string: string): any {
  let sresult;
  string = string.toString();
  try {
    string = string.replace(/<[a-zA-Z0-9]+ *[/]>/g, "");
  } catch {
    console.log("?");
    console.log(string);
  }
  parseString(
    string,
    {
      valueProcessors: [parseValue],
      attrValueProcessors: [parseValue],
      emptyTag: [],
      xmlns: false,
      charkey: "$text",
    },
    function (err, result) {
      // processed data
      sresult = result;
    }
  );
  fix_xml_object(sresult);
  return sresult;
}

function parseValue(str: string): any {
  switch (str) {
    case "True":
    case "true":
      return true;
    case "False":
    case "false":
      return false;
    default:
      if (isNaN(str as any)) {
        return str;
      }

      const float = parseFloat(str);
      if (isFinite(float) && str.includes("+") == false) return float;

      return str;
  }
}

export function bs_to_json<DataT = BSIData & CatalogueExtraInfo>(string: string): DataT {
  const sresult = xml_to_json(string);
  let type = "catalogue";
  if (!sresult.catalogue) {
    type = "gameSystem";
    sresult.playable = 0;
    sresult.id = 1000;
  } else {
    sresult.playable = 1;
    sresult.id = hashFnv32a(sresult.catalogue.id);
    sresult.include = [1000];
  }

  const cat = sresult[type];
  sresult.name = cat.name;
  sresult.short = to_snake_case(cat.name);
  sresult.playable = !Boolean(cat.library);
  sresult.version = cat.battleScribeVersion;
  sresult.nrversion = cat.revision;

  return sresult;
}
