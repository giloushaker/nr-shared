import { Instance } from "./bs_instance";
import type { Catalogue } from "./bs_main_catalogue";
import type { BSIRule, BSIProfile, BSICharacteristic, BSISelectionCategory, BSICost } from "./bs_types";
import type { ICost } from "../systems/army_interfaces";
import { NRAssociationInstance } from "./bs_association";

const disableRulesAndProfiles = false;
class FormatResult {
  strings: string[];
  constructor() {
    this.strings = [];
  }
  toString(): string {
    return this.strings.join("");
  }
}

export function escapeXml(str: any): string {
  return str.toString().replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function formatAttrs(obj: any) {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${escapeXml(k)}="${escapeXml(v)}"`);
}
function begin(str: FormatResult, line: string, attrs: string[] = []): FormatResult {
  if (line) {
    const attrs_str = `${attrs.join(" ")}`;
    str.strings.push(`<${escapeXml(line)}${attrs_str ? " " + attrs_str : ""}>`);
  }
  return str;
}
function end(str: FormatResult, line: string): FormatResult {
  if (line) str.strings.push(`</${escapeXml(line)}>`);
  return str;
}
function child(str: FormatResult, line: string): FormatResult {
  if (line) str.strings.push(line);

  return str;
}
function line(str: FormatResult, line: string): FormatResult {
  str.strings.push(line);
  str.strings.push("\n");
  return str;
}
function beginEnd(str: FormatResult, line: string, attrs: string[] = [], content?: string | number): FormatResult {
  const attrs_str = `${attrs.join(" ")}`;
  line = escapeXml(line);
  if (line && content) {
    str.strings.push(`<${line}${attrs_str ? " " + attrs_str : ""}>${escapeXml(content)}</${line}>`);
  } else {
    str.strings.push(`<${line}${attrs_str ? " " + attrs_str + " " : ""}/>`);
  }
  return str;
}

function getEntryId(instance: Instance): string {
  const source = instance.source;
  return source.isLink() ? `${source.id}::${source.targetId}` : source.id;
}

function formatForces(forces?: Instance[]): string {
  const result = new FormatResult();
  if (!forces?.length) return result.toString();
  begin(result, "forces");
  for (const force of forces) {
    const catalogue = force.getParentCatalogue();
    const cat = catalogue.source as any as Catalogue;
    const _force = {
      id: force.uid,
      name: force.getName(),
      entryId: getEntryId(force),
      catalogueId: force.catalogueId || getEntryId(catalogue),
      catalogueRevision: force.catalogueRevision || cat.revision,
      catalogueName: force.catalogueName || catalogue.getName(),
    };
    const _categories: BSISelectionCategory[] = force.getCategories().map((category) => {
      return {
        name: category.getName(),
        id: category.uid,
        primary: false,
        entryId: category.source.getId(),
      };
    });
    begin(result, "force", formatAttrs(_force));
    child(result, formatProfiles(force.getModifiedProfiles()));
    child(result, formatRules(force.getModifiedRules()));
    child(result, formatSelections(force.getSelections()));
    child(result, formatCosts(force.getCosts()));
    child(result, formatCategories(_categories));
    child(result, formatForces(force.getForces(false)));
    end(result, "force");
  }
  end(result, "forces");
  return result.toString();
}

function formatRules(rules?: BSIRule[]): string {
  if (disableRulesAndProfiles) return "";
  const result = new FormatResult();

  if (!rules?.length) return result.toString();

  begin(result, "rules");
  for (const rule of rules) {
    const _rule = {
      id: rule.id,
      name: rule.name,
      hidden: rule.hidden,
      //   publicationId: rule.publicationId,
      //   page: rule.page,
    };
    begin(result, "rule", formatAttrs(_rule));
    const desc = Array.isArray(rule.description) ? rule.description.join("\n") : rule.description;
    beginEnd(result, "description", undefined, desc);
    end(result, "rule");
  }
  end(result, "rules");

  return result.toString();
}

function formatCosts(costs?: ICost[]): string {
  const result = new FormatResult();

  if (!costs?.length) return result.toString();
  costs = costs.filter((o) => o.value);
  if (!costs?.length) return result.toString();

  begin(result, "costs");
  for (const cost of costs) {
    const _cost = {
      name: cost.name,
      typeId: cost.typeId,
      value: cost.value,
    };
    beginEnd(result, "cost", formatAttrs(_cost));
  }
  end(result, "costs");

  return result.toString();
}

function formatCharacteristics(characteristics?: BSICharacteristic[]): string {
  const result = new FormatResult();

  if (!characteristics?.length) return result.toString();
  begin(result, "characteristics");
  for (const characteristic of characteristics) {
    const _characteristic = {
      name: characteristic.name,
      typeId: characteristic.typeId,
    };
    beginEnd(result, "characteristic", formatAttrs(_characteristic), characteristic.$text);
  }
  end(result, "characteristics");
  return result.toString();
}

function formatProfiles(profiles?: BSIProfile[]): string {
  if (disableRulesAndProfiles) return "";
  const result = new FormatResult();

  if (!profiles?.length) return result.toString();
  begin(result, "profiles");
  for (const profile of profiles) {
    const _profile = {
      id: profile.id,
      name: profile.name,
      //   publicationId: profile.publicationId,
      //   page: profile.page,
      hidden: profile.hidden,
      typeId: profile.typeId,
      typeName: profile.typeName,
    };

    begin(result, "profile", formatAttrs(_profile));
    child(result, formatCharacteristics(profile.characteristics));
    end(result, "profile");
  }
  end(result, "profiles");
  return result.toString();
}

function formatCategories(categories?: BSISelectionCategory[]): string {
  const result = new FormatResult();

  if (!categories?.length) return result.toString();

  begin(result, "categories");
  for (const category of categories) {
    if (!category.primary) category.primary = false;
    beginEnd(result, "category", formatAttrs(category));
  }
  end(result, "categories");
  return result.toString();
}
function formatAssociations(associations?: NRAssociationInstance[]): string {
  const result = new FormatResult();

  if (!associations?.length) return result.toString();
  associations = associations.filter((o) => o.instances.length);
  if (!associations?.length) return result.toString();
  begin(result, "associations");
  for (const a of associations) {
    for (const inst of a.instances) {
      const _selection = {
        to: inst.uid,
        associationId: a.getId(),
      } as any;
      begin(result, "association", formatAttrs(_selection));
      end(result, "association");
    }
  }
  end(result, "associations");
  return result.toString();
}

function formatSelections(selections?: Instance[]): string {
  const result = new FormatResult();

  if (!selections?.length) return result.toString();
  selections = selections.filter((o) => o.amount);
  if (!selections?.length) return result.toString();
  begin(result, "selections");
  for (const selection of selections) {
    const _selection = {
      id: selection.uid,
      name: selection.getName(),
      entryId: selection.getBattleScribePath(),
      entryGroupId: selection.getBattleScribePath(true) || undefined,
      number: selection.getSelectionCount("root"),
      type: selection.source.getType(),
    } as any;
    begin(result, "selection", formatAttrs(_selection));
    child(result, formatRules(selection.getModifiedRules()));
    child(result, formatProfiles(selection.getModifiedProfiles()));
    child(result, formatAssociations(selection.getAssociations()));
    child(result, formatSelections(selection.getSelections()));
    child(result, formatCosts(Object.values(selection.getTotalCosts())));
    child(result, formatCategories(selection.getSelectionCategories()));
    end(result, "selection");
  }
  end(result, "selections");
  return result.toString();
}

function formatCostLimits(costLimits?: BSICost[]): string {
  const result = new FormatResult();
  if (!costLimits?.length) return result.toString();
  costLimits = costLimits.filter((o) => o.value !== undefined && o.value !== -1);
  if (!costLimits?.length) return result.toString();

  begin(result, "costLimits");
  for (const costLimit of costLimits) {
    const _costLimit = {
      name: costLimit.name,
      typeId: costLimit.typeId,
      value: costLimit.value,
    };
    beginEnd(result, "costLimit", formatAttrs(_costLimit));
  }
  end(result, "costLimits");
  return result.toString();
}

function formatRoster(roster: Instance | any, name?: string): string {
  if (!roster || !isBsExportable(roster)) throw Error("invalid argument: isBsExportable(roster) returned false");
  const actualRoster = roster as Instance;

  const result = new FormatResult();
  line(result, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`);

  const book = actualRoster.getBook();
  const gst = book.system.books.array.find((o) => o.bsid === book.catalogue.gameSystemId);
  if (!gst) throw Error("couldn't find included gst in roster.getBook().system.books.array");
  const _roster = {
    id: actualRoster.uid,
    name: name || actualRoster.getName(),
    battleScribeVersion: "2.03",
    gameSystemId: gst.bsid,
    gameSystemName: gst.name,
    gameSystemRevision: gst.nrversion,
    xmlns: "http://www.battlescribe.net/schema/rosterSchema",
  };
  begin(result, "roster", formatAttrs(_roster));
  child(result, formatCosts(Object.values(actualRoster.getTotalCosts())));
  child(result, formatCostLimits(actualRoster.getMaxCosts()));
  child(result, formatForces(actualRoster.getForces(false)));
  end(result, "roster");
  return result.toString();
}

export function convertRosterToXml(roster: Instance | any, name?: string): string {
  return formatRoster(roster, name);
}
export function isBsExportable(roster: unknown) {
  return roster instanceof Instance;
}
