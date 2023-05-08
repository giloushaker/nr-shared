import type { ListTextFormat } from "../../systems/army_interfaces";
import type { Instance } from "../bs_instance";
import { sortByAscending, betweenIf } from "../bs_helpers";
import { prefixIf, suffixIf, textIf } from "../bs_helpers";
import { formatCosts } from "./default_formatter";
import {
  makePlural,
  numberToStringWithPlusOrMinus,
  removeCP,
  shortCategoryName,
  StringBuilder,
  stripNumber,
} from "./warhammer_formatter_helpers";
import {
  getPointsCost,
  GroupedStrInstances,
  getMaxPoints,
  getActualUnits,
  getStratagems,
  getWarlordAndTrait,
  hasGameType,
  getUnits,
  SKIP_CATEGORIES,
  getBaseModelCost,
  getPsychicPowers,
  getWarlordTraits,
  isWarlord,
  PreparedInstance,
  calcCPstring,
  removeGroupName,
  getFactionsUsed,
  nephilimSecondaryObjectives,
  arksOfOmenObjectives,
  nachmundSecondaryObjectives,
  getFactionsFromSelectors,
  groupDuplicateOptions,
  prepareInstance,
  getForceConfigFromSelectors,
} from "./warhammer_formatter_common";

const divider = "+++++++++++++++++++++++++++++++++++++++++++++++++";

function groupValue(g: PreparedInstance): number {
  const groupOrder: any = {
    "Psychic Power": -1,
    Weapon: 0,
    Abilities: 1,
    "": 2,
    Unit: 10,
  };
  if (groupOrder[g.type] == null) {
    return 1000;
  }
  return groupOrder[g.type];
}

function sortFunction(g1: PreparedInstance, g2: PreparedInstance): number {
  return groupValue(g1) - groupValue(g2);
}

function preparedInstanceToString(
  instance: PreparedInstance,
  groupedStrings: string[],
  form: ListTextFormat,
  skipHead = false
): string {
  const groups: GroupedStrInstances[] = [];
  const unGroupedChildren: PreparedInstance[] = [];
  const strAmount = instance.number > 1 ? `${instance.number} ` : "";
  const cpCostString = instance.cpCost ? ` (${instance.cpCost}CP)` : "";
  const costString = form.noCost ? cpCostString : instance.strCost;
  const fullName = `${strAmount}${stripNumber(instance.name)}${costString}`;

  let res = skipHead ? [] : [fullName];
  instance.children.sort(sortFunction);
  for (const child of instance.children) {
    let grouped = false;
    const psychic = child.types.length === 1 && child.types[0] === "Psychic Power";

    for (const type of child.types) {
      if (type !== "Psychic Power") {
        grouped = true;
      }
      const group = groups.find((elt) => elt.name == type);
      if (group) {
        group.children.push(child);
      } //
      else if (group == null) {
        groups.push({
          name: type,
          children: [child],
        });
      }

      // Remove (0) from grouped items
      if (child.totalCost == 0) {
        child.strCost = "";
      }
    }

    // put ungrouped instances in ungroupedStrings
    if (!psychic && (!grouped || child.types.length === 0)) {
      if (child.totalCost != 0 || !child.constant) {
        unGroupedChildren.push(child);
      }
    }
  }
  // put non-empty strings in ungroupedStrings
  const ungroupedStrings: string[] = [];
  for (const child of sortByAscending(unGroupedChildren, (o) => o.name)) {
    const val = preparedInstanceToString(child, groupedStrings, form);
    if (val.length >= 1) {
      ungroupedStrings.push(val);
    }
  }

  // convert grouped instances to strings
  for (const group of groups) {
    const sgroup: string[] = [];

    if (group.children.length && group.name != "Psychic Power") {
      for (const child of group.children) {
        sgroup.push(preparedInstanceToString(child, groupedStrings, form));
      }
      groupedStrings.push(`${makePlural(group.name)}: ${sgroup.map((o) => removeGroupName(o, group.name)).join(", ")}`);
    }
  }

  res = res.concat(ungroupedStrings);
  return res.join(", ");
}

export function warhammer_wtc_format(roster: Instance, form: ListTextFormat): string {
  form.unitCategoryNum = true;
  form.noCost = false;
  const playerName = form.playerName && form.playerName.length ? form.playerName : "";
  const rosterName = form.rosterName || roster.getName();

  const strRoster = suffixIf(playerName, " - ") + roster.getBook().getName() + prefixIf(" - ", rosterName);

  const result = new StringBuilder();
  if (form["pdfExport"]) {
    result.addLine(strRoster);
    result.addLine("");
  }
  const rosterCosts = roster.calcTotalCosts();
  const rosterPtsCosts = rosterCosts.find((elt) => elt.name.includes("pts"))?.value || 0;
  result.addLine(divider);
  result.addLine("Factions used: " + getFactionsUsed(roster));
  result.addLine("Army Points: " + rosterPtsCosts);
  result.addLine("Reinforcement Points: " + (getMaxPoints(roster) - rosterPtsCosts));
  result.addLine("Number of Units / Killpoints: " + getActualUnits(roster).length);
  result.addLine("Pre Game Stratagems: " + getStratagems(roster));
  result.addLine("Starting Command Points: " + calcCPstring(roster));
  result.addLine("Warlord & Trait: " + getWarlordAndTrait(roster));
  result.addLine("Army Trait: " + "?");

  if (hasGameType(roster, "Chapter Approved: War Zone Nephilim")) {
    result.addLine("Secondary Objectives Information (Nephilim):");
    nephilimSecondaryObjectives(result, roster);
  } else if (hasGameType(roster, "Chapter Approved: War Zone Nachmund")) {
    result.addLine("Secondary Objectives Information (Nachmund):");
    nachmundSecondaryObjectives(result, roster);
  } else if (hasGameType(roster, "Chapter Approved: Arks of Omen")) {
    result.addLine("Secondary Objectives Information (Arks of Omen):");
    arksOfOmenObjectives(result, roster);
  } /**default**/ else {
    result.addLine("Secondary Objectives Information (Arks of Omen):");
    arksOfOmenObjectives(result, roster);
  }

  result.addLine(divider);
  for (const force of roster.getForces()) {
    appendForce(result, force, form);
  }
  return result.get(form.asText ? "\n" : undefined);
}
function appendForce(result: StringBuilder, force: Instance, form: ListTextFormat) {
  result.endLine();
  const sCosts = formatCosts(force.calcTotalCosts().filter((o) => o.name !== "CP"));
  const forceCpCost = force.calcTotalCosts().find((o) => o.name == "CP")?.value || 0;
  const battleSizeCPCost =
    getUnits(force, "Battle Size", "Configuration")[0]
      ?.calcTotalCosts()
      ?.find((o) => o.name == "CP")?.value || 0;
  const sCPCost = numberToStringWithPlusOrMinus(forceCpCost - battleSizeCPCost) + "CP";
  const sBookName = force.getBook().getName();
  const sForceName = removeCP(force.getName());
  const sSelectedFactions = [...getFactionsFromSelectors(force)].join(", ");
  const sConfig = Object.entries(getForceConfigFromSelectors(force)).map(([k, v]) => `${k}: ${[...v].join(", ")}`);
  result.addLine(
    `=== ${sBookName} - ${sForceName}${prefixIf(" - ", sConfig)} = ${sCPCost}, ${sCosts} === ${sSelectedFactions}`
  );

  for (const category of force.getCategories()) {
    if (SKIP_CATEGORIES.includes(category.getName())) continue;
    const units = category.getUnits();
    for (const [index, unit] of Object.entries(units)) {
      appendUnit(result, category, unit, index, form);
    }
    if (units.length) {
      result.endLine();
    }
  }
}
function appendUnit(
  result: StringBuilder,
  category: Instance,
  unit: Instance,
  num: number | string,
  form: ListTextFormat
) {
  const base = getBaseModelCost(unit);

  const str = prepareInstance(unit);
  if (!str) return;

  let groupedStrings: string[] = [];
  const prepared = preparedInstanceToString(str, groupedStrings, form, true);
  const sOptions = groupDuplicateOptions(prepared, ", ");
  groupedStrings = groupedStrings.filter((o) => !o.startsWith("Warlord Traits:") && !o.startsWith("Psychic Powers:"));
  if (unit) {
    const sPsy = getPsychicPowers(unit);
    if (sPsy) groupedStrings.push(`Psychic Powers: ${sPsy.join(", ")}`);
    const sTraits = getWarlordTraits(unit);
    if (sTraits) groupedStrings.push(`Warlord Traits: ${sTraits}`);
  }

  const splitOutput = [] as string[];
  const sCat = shortCategoryName(category.getName()) + textIf(form.unitCategoryNum, Number(num) + 1);
  splitOutput.push(`${sCat}:`);
  const sWarlord = textIf(isWarlord(unit), "(WARLORD)");
  splitOutput.push(sWarlord);
  const unitSize = unit.calcTotalUnitSize();
  if (unitSize > 1) {
    splitOutput.push(`${unitSize}`);
  }
  const sUnit = unit.getName();
  splitOutput.push(sUnit);
  if (!form.noCost) {
    const unitCost = getPointsCost(unit);
    const sUnitCost = textIf(unitCost, unitCost);
    const sModelCost = textIf(unitSize > 1, textIf(base.cost, `${unitSize}*${base.cost}`));
    const sUnitPts = sModelCost ? `${betweenIf(sUnitCost, "+", sModelCost)}` : `${sUnitCost}`;
    splitOutput.push(`(${sUnitPts})`);
  }
  if (sOptions) {
    splitOutput.push(",");
    splitOutput.push(sOptions);
  }
  const relicGroups = groupedStrings.filter((o) => o.toLowerCase().startsWith("relic"));
  const sRelics = relicGroups.length ? relicGroups.join(", ") : "";
  splitOutput.push(sRelics);
  const sCosts = formatCosts(unit.calcTotalCosts());
  splitOutput.push(sCosts);

  result.addLine(
    splitOutput
      .filter((o) => o) // remove empty strings
      .map((o) => o.trim()) // trim spaces
      .join(" ") // join the strings
      .replace(/ +,/g, ",") // remove spaces before commas
  );
  for (const sGroup of groupedStrings) {
    if (relicGroups.includes(sGroup)) continue;
    result.addLine(`--- ${sGroup}`.trim());
  }
}
