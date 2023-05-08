import type { ListTextFormat } from "../../systems/army_interfaces";
import { sortByAscending, addOne, betweenIf } from "../bs_helpers";
import { prefixIf, suffixIf, textIf } from "../bs_helpers";
import { formatCosts, formatCostsSplit } from "./default_formatter";
import {
  numberToStringWithPlusOrMinus,
  removeCP,
  shortCategoryName,
  StringBuilder,
  stripNumber,
} from "./warhammer_formatter_helpers";
import {
  isRelic,
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
  isWarlord,
  PreparedInstance,
  calcCPstring,
  getPL,
  isStratagem,
  getFactionsUsed,
  getPsychicPowers,
  grantsKeywords,
  removeGroupName,
  extractGroupName,
  nachmundSecondaryObjectives,
  nephilimSecondaryObjectives,
  arksOfOmenObjectives,
  getFactionsFromSelectors,
  groupDuplicateOptions,
  prepareInstance,
  getForceConfigFromSelectors,
} from "./warhammer_formatter_common";
import { Instance } from "~/assets/shared/battlescribe/bs_instance";

const DIVIDER = "+++++++++++++++++++++++++++++++++++++++++++++++";
const JOIN = " - ";

function preparedInstanceToString(
  instance: PreparedInstance,
  form: ListTextFormat,
  skipHead = false
): [string, string[]] {
  const groups: GroupedStrInstances[] = [];
  const unGroupedChildren: PreparedInstance[] = [];
  const strAmount = instance.number > 1 ? `${instance.number} ` : "";
  const rawName = stripNumber(instance.name);
  let fullName: string;
  if (isStratagem(instance.parent)) {
    fullName = `[${rawName.replace("Strategem: ", "")} ${instance.cpCost}CP]`;
  } else if (isRelic(instance.parent)) {
    const relicCP = instance.cpCost ? ` ${instance.cpCost}CP` : "";
    fullName = `[Relic${relicCP}] ${rawName.replace("Relic: ", "")}`;
  } else if (instance.types.length) {
    const cpCost = instance.cpCost ? ` ${instance.cpCost}CP` : "";
    const type = extractGroupName(instance.types[0]);
    fullName = `[${type}${cpCost}] ${removeGroupName(rawName, type)}`;
  } else if (grantsKeywords(instance.parent) && !instance.parent.isModel() && !instance.parent.isUnit()) {
    fullName = `${strAmount}${rawName}${!form.noCost && instance.totalCost ? instance.strCost : ""}`;
  } else {
    fullName = `${strAmount}${rawName}${form.noCost ? "" : instance.strCost}`;
  }

  let res = skipHead ? [] : [fullName];

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
    }

    if (!psychic && (!grouped || child.types.length === 0)) {
      if (child.totalCost != 0 || !child.constant) {
        unGroupedChildren.push(child);
      }
    }
  }
  const ungroupedStrings: string[] = [];
  const groupedStrings: string[] = [];
  for (const child of sortByAscending(unGroupedChildren, (o) => o.name)) {
    const [val, grouped] = preparedInstanceToString(child, form);
    groupedStrings.push(...grouped);
    if (val.length >= 1) {
      if (isStratagem(child.parent)) {
        groupedStrings.push(val);
      } else {
        ungroupedStrings.push(val);
      }
    }
  }

  for (const group of groups) {
    if (group.children.length && group.name != "Psychic Power") {
      for (const child of group.children) {
        const [val, grouped] = preparedInstanceToString(child, form);
        if (val.length >= 1) {
          groupedStrings.push(val);
        }
        groupedStrings.push(...grouped);
      }
    }
  }
  res = res.concat(ungroupedStrings);
  return [res.join(JOIN), groupedStrings];
}
const headerSpacing = " - ";
export function warhammer_feq_format(roster: Instance, form: ListTextFormat): string {
  form.unitCategoryNum = true;
  form.noCost = false;
  form.unitCostsAfterOptions = true;
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

  result.addLine(DIVIDER);
  if (form.teamName) result.addLine("TEAM -" + form.teamName);
  if (form.playerName) result.addLine("PLAYER -" + form.playerName);

  result.addLine("TOTAL COMMAND POINTS" + headerSpacing + calcCPstring(roster));
  result.addLine("TOTAL ARMY POINTS" + headerSpacing + rosterPtsCosts);
  result.addLine("ARMY FACTIONS USED" + headerSpacing + getFactionsUsed(roster));
  result.addLine("TOTAL REINFORCEMENT POINTS " + headerSpacing + (getMaxPoints(roster) - rosterPtsCosts));
  result.addLine("TOTAL POWER LEVEL" + headerSpacing + getPL(roster));
  result.addLine("WARLORD & TRAIT" + headerSpacing + getWarlordAndTrait(roster));
  result.addLine("ARMY TRAIT" + headerSpacing + "?");
  result.addLine("NUMBER OF UNITS" + headerSpacing + getActualUnits(roster).length);
  result.addLine("SACRED RITES" + headerSpacing + "?");
  result.addLine("PREBATTLE STRATAGEMS" + headerSpacing + getStratagems(roster, true));

  if (hasGameType(roster, "Chapter Approved: War Zone Nephilim")) {
    result.addLine("SECONDARY (Nephilim):");
    nephilimSecondaryObjectives(result, roster);
  } else if (hasGameType(roster, "Chapter Approved: War Zone Nachmund")) {
    result.addLine("SECONDARY (Nachmund):");
    nachmundSecondaryObjectives(result, roster);
  } else if (hasGameType(roster, "Chapter Approved: Arks of Omen")) {
    result.addLine("SECONDARY (Arks of Omen):");
    arksOfOmenObjectives(result, roster);
  } /**default**/ else {
    result.addLine("SECONDARY (Arks of Omen):");
    arksOfOmenObjectives(result, roster);
  }
  const categoryCounts = {} as Record<string, number>;
  result.addLine(DIVIDER);
  for (const force of roster.getForces()) {
    appendForce(result, force, categoryCounts, form);
  }
  return result.get(form.asText ? "\n" : undefined);
}
function appendForce(
  result: StringBuilder,
  force: Instance,
  categoryCounts: Record<string, number>,
  form: ListTextFormat
) {
  const sCosts = formatCosts(force.calcTotalCosts().filter((o) => o.name !== "CP"));
  const forceCpCost = force.calcTotalCosts().find((o) => o.name == "CP")?.value || 0;
  const battleSizeCPCost =
    getUnits(force, "Battle Size", "Configuration")[0]
      ?.calcTotalCosts()
      ?.find((o) => o.name == "CP")?.value || 0;
  const sCPCost = numberToStringWithPlusOrMinus(forceCpCost - battleSizeCPCost) + "CP";
  const sBook = force.getBook().getName();
  const sName = removeCP(force.getName());
  const sFactions = [...getFactionsFromSelectors(force)].join(", ");

  const sConfig = Object.entries(getForceConfigFromSelectors(force)).map(([k, v]) => `${k}: ${[...v].join(", ")}`);

  result.addLine(`== ${sName} - ${sBook}${prefixIf(" - ", sConfig)} = ${sCPCost}, ${sCosts} == ${sFactions}`);

  for (const category of force.getCategories()) {
    const categoryName = category.getName();
    if (SKIP_CATEGORIES.includes(categoryName)) continue;
    const units = category.getUnits();
    for (const unit of units) {
      addOne(categoryCounts, categoryName);
      appendUnit(result, category, unit, categoryCounts[categoryName], form);
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

  const [sPrepared, grouped] = preparedInstanceToString(str, form, true);
  const powers = getPsychicPowers(unit, false);
  const sPowers = powers ? powers.map((o) => `[PSY] ${o}`).join(JOIN) : "";
  const sOptions = prefixIf(" ", groupDuplicateOptions(sPrepared, JOIN));
  // Options such as: Psychic Powers, Stratagems, Warlord Traits, etc...
  const sExtraOptions = prefixIf(
    JOIN,
    groupDuplicateOptions(betweenIf(grouped.sort().join(JOIN), JOIN, sPowers), JOIN)
  );

  const sUnit = unit.getName();
  const unitSize = unit.calcTotalUnitSize();
  const sUnitSize = textIf(unitSize > 1, `${unitSize} `);
  const sCat = shortCategoryName(category.getName()) + textIf(form.unitCategoryNum, Number(num));

  const unitCost = getPointsCost(unit);
  const sUnitCost = textIf(unitCost, unitCost);
  const sModelCost = textIf(unitSize > 1, textIf(base.cost, `${unitSize}*${base.cost}`));
  const sUnitPts = sModelCost ? `${betweenIf(sUnitCost, "+", sModelCost)}` : `${sUnitCost}`;
  const sPts = textIf(!form.noCost, ` (${sUnitPts})`);

  const sWarlord = textIf(isWarlord(unit), "[WARLORD] ");
  const sCosts = prefixIf(" ", formatCostsSplit(unit.calcTotalCosts()));
  let output: string;
  if (form.unitCostsAfterOptions) {
    output = `${sCat}: ${sWarlord}${sUnitSize}${sUnit} ${sPts}${sOptions}${sCosts}${sExtraOptions}`;
  } else {
    output = `${sCat}: ${sWarlord}${sUnitSize}${sUnit} ${sPts}${sCosts}${sOptions}${sExtraOptions}`;
  }
  result.addLine(output.trim());
}
