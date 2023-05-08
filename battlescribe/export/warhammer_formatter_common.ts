import type { Instance } from "../bs_instance";
import { sortByDescending, removePrefix, add, addOne, countKeys, addObj, replaceKey } from "../bs_helpers";
import { prefixIf } from "../bs_helpers";
import {
  getTimesString,
  numberToStringWithPlusOrMinus,
  shortCategoryName,
  stripNumber,
  StringBuilder,
  parentMult,
} from "./warhammer_formatter_helpers";

export const SKIP_CATEGORIES = ["Configuration", "Stratagems"];
export const STRATAGEM_SKIP_UNITS = ["Detachment Command Cost"];
export const SKIP_WOUNDS = ["MONSTER", "VEHICLE", "CHARACTER"];
export const COUNT_WOUNDS = ["MONSTER", "VEHICLE"];
export const SKIP_GROUPS = new Set(["", "Abilities", "Weapon", "Unit", "Stratagem", "Psyker"]);
export const FACTIONS_USED_SELECTORS = new Set([
  "Craftworld Selection", //Aeldari - Craftworlds
  "Obsession", //Aeldari - Drukhari
  "Saedath Characterisation", //Aeldari - Harlequins
  "Legion", //Chaos - Chaos Space Marines
  "Chaos Allegiance", //Chaos - Daemons
  "Plague Company", //Chaos - Death Guard
  "Cults of the Legion", //Chaos - Thousand Sons
  "Order Convictions", //Imperium - Adepta Sororitas
  "**Chapter Selector**", //Imperium - Adeptus Astartes - Blood Angels
  // "**Chapter Selector**", //Imperium - Adeptus Astartes - Dark Angels
  // "**Chapter Selector**", //Imperium - Adeptus Astartes - Imperial Fists
  // "**Chapter Selector**", //Imperium - Adeptus Astartes - Iron Hands
  // "**Chapter Selector**", //Imperium - Adeptus Astartes - Raven Guard
  // "**Chapter Selector**", //Imperium - Adeptus Astartes - Salamanders
  // "**Chapter Selector**", //Imperium - Adeptus Astartes - Space Wolves
  // "**Chapter Selector**", //Imperium - Adeptus Astartes - Ultramarines
  // "**Chapter Selector**", //Imperium - Adeptus Astartes - White Scars
  "Regimental Doctrine", //Imperium - Adeptus Astra Telepathica
  "Detachment Type / Shield Host", //Imperium - Adeptus Custodes
  "Forge World Choice", //Imperium - Adeptus Mechanicus
  "Regimental Doctrine", //Imperium - Astra Militarum
  // "Regimental Doctrine", //Imperium - Death Korps of Krieg
  // "Regimental Doctrine", //Imperium - Elysian Drop Troops
  "Brotherhood", //Imperium - Grey Knights
  "Chivalric Oath", //Imperium - Imperial Knights
  "Questor Allegiance", //Imperium - Imperial Knights
  "League", //Leagues of Votann
  "Dynasty Choice", //Necrons
  "Clan Kultur", //Orks
  "Sept Choice", //T'au Empire
  "Hive Fleet", //Tyranids
  "Cult Creed", //Tyranids - Genestealer Cults
  "Subfaction", //Chaos - World Eaters
  "Faction Selection", //Imperium - Agents of the Imperium
]);
export const FORCE_OPTIONS_SELECTORS = new Set(["Arks of Omen Compulsory Type"]);

export interface PreparedInstance {
  types: string[];
  name: string;
  strCost: string;
  cost: number;
  number: number;
  type: string;
  children: PreparedInstance[];
  totalCost: number;
  constant: boolean;
  parent: Instance;
  cpCost: number;
}
export function groupDuplicateOptions(str: string, JOIN = ", "): string {
  const options = str.split(JOIN);
  const factored: Record<string, number> = {};
  for (const elt of options) {
    if (factored[elt] == undefined) {
      factored[elt] = 1;
    } else {
      factored[elt]++;
    }
  }
  const res: string[] = [];
  for (const elt in factored) {
    const name = elt;
    const n = factored[name];
    if (n >= 2) {
      let factoredName = `${n} ${name}`;
      factoredName = factoredName.replace(/^(.*)[(]([0-9]+)[)]$/, `$1(${n}*$2)`);
      res.push(factoredName);
    } else {
      res.push(name);
    }
  }
  return res.join(", ");
}
export function prepareInstance(opt: Instance): PreparedInstance | null {
  const mult = parentMult(opt);
  const amount = opt.getAmount() * mult;
  if (amount == 0) {
    return null;
  }

  const res: PreparedInstance = {
    name: "",
    strCost: "",
    number: 0,
    cost: 0,
    type: "",
    types: getTypes(opt, SKIP_GROUPS),
    children: [],
    totalCost: 0,
    constant: false,
    parent: opt,
    cpCost: getCPCost(opt),
  };

  if (!opt.isGroup()) {
    const cost = getPointsCost(opt);
    res.number = amount;
    res.strCost = `(${cost * mult * amount})`;
    res.cost = cost;
    res.name = opt.getName();
    res.type = getGroupType(opt);
    res.totalCost = cost * mult;
    res.constant = opt.isConstant();
  }
  for (const child of opt.getChildren() || []) {
    if (child.isConstant()) continue;
    if (child.getName() === "Warlord") continue;
    const subOptions = prepareInstance(child);
    if (subOptions) res.children.push(subOptions);
    if (!child.isModel()) continue;

    // We replace the cost of Models with the cost of their  weapons
    let constantChildrenCost = 0;
    const weaponList: string[] = [];
    const weaponChildren: Instance[] = [];

    for (const child_option of child.getChildren().filter((elt) => elt.amount >= 1)) {
      if (child.selector.getSelectionsCountSum() > 1 || isWeapon(child_option)) {
        for (let i = 0; i < child_option.amount; ++i) {
          weaponList.push(child_option.name);
          constantChildrenCost += getPointsTotalCost(child_option);
        }
        weaponChildren.push(child_option);
      }
    }

    if (subOptions) {
      subOptions.totalCost = constantChildrenCost;
      if (weaponList.length >= 1) {
        const groupedWeapons = Object.entries(countKeys(weaponList)).map(([label, count]) => {
          return count > 1 ? `${count}x ${label}` : label;
        });

        const match = subOptions.name.match(/w\/\s*(.*)/);
        const optionFromName = match ? match[1] : null;
        // check if any weapon within the wepaonlist contains optionFromName as a substring
        const optionIsInWeapons =
          optionFromName && weaponList.find((elt) => elt.includes(optionFromName)) !== undefined;

        // replace "w/ ${...}" with the weapons if what is after w/ is within the weapon list
        // otherwise, append w/ + list of weapons after such that:
        // Warrior w/ medipack, ["sword", "gun"] ->  Warrior w/ medipack w/ sword and gun
        // Warrior w/ sword, ["sword", "gun"] ->  Warrior w/ sword and gun
        if (optionIsInWeapons) {
          subOptions.name = `${subOptions.name.replace(/(.*) [wW][/].*/, "$1")} w/ ${groupedWeapons.join(" and ")}`;
        } else {
          subOptions.name = `${subOptions.name} w/ ${groupedWeapons.join(" and ")}`;
        }
      }
      if (!subOptions.totalCost) {
        subOptions.strCost = "";
      } else if (subOptions.number > 1) {
        subOptions.strCost = `(${subOptions.totalCost}*${subOptions.number})`;
      } else {
        subOptions.strCost = `(${subOptions.totalCost})`;
      }
      subOptions.children = subOptions.children.filter((elt) => {
        return weaponChildren.includes(elt.parent) == false;
      });
    }
  }

  return res;
}
export function isWeapon(schild: Instance): boolean {
  const unitProfiles = schild.getAllModifiedProfiles().find((prf) => prf.typeName == "Weapon");
  if (unitProfiles) return true;
  if (schild.getParentGroups().find((o) => o.getName().toLowerCase().includes("weapon")) !== undefined) {
    return true;
  }
  const name = schild.getName();
  if (name.toLowerCase() === "storm shield") return true;
  return false;
}
export function getCost(elt: Instance, typeId: string): number {
  const res = elt.getCosts().find((cost) => cost.typeId == typeId || cost.name === typeId)?.value || 0;
  return res;
}
export function getTotalCost(elt: Instance, typeId: string): number {
  const res = elt.calcTotalCosts().find((cost) => cost.typeId == typeId || cost.name === typeId)?.value || 0;
  return res;
}
export function getPointsCost(elt: Instance): number {
  return getCost(elt, "points");
}
export function getPL(elt: Instance): number {
  return getCost(elt, " PL");
}
export function getCPCost(elt: Instance): number {
  return getCost(elt, "CP");
}
export function getPointsTotalCost(elt: Instance): number {
  return getTotalCost(elt, "points");
}
export function getBaseModelCost(unit: Instance): { cost: number; min: number } {
  const model = { cost: 0, min: 1 };
  unit.forEach((elt) => {
    if (elt.isModel()) {
      model.cost = getPointsCost(elt);
      if (elt.getMinConstraints().length == 1) {
        model.min = elt.getMinConstraints()[0].value + 1;
      } else {
        if (elt.getParent()?.getMinConstraints().length == 1) {
          model.min = elt.getParent().getMinConstraints()[0].value + 1;
        }
      }
    }
  });

  return model;
}
export function hasProfile(child: Instance, profileName: string): boolean {
  const prf = child.getModifiedProfiles();
  console.log(
    child.getName(),
    prf.map((o) => o.typeName)
  );
  for (const elt of prf) {
    if (elt.typeName == profileName) return true;
  }
  return false;
}
export function getTypes(child: Instance, skip: Set<string>): string[] {
  const set = new Set<string>();
  const prf = child.getModifiedProfiles();
  for (const elt of prf) {
    if (!skip.has(elt.typeName)) {
      set.add(elt.typeName);
    }
  }
  if (!skip.has("Warlord Trait") && isWarlordTrait(child)) set.add("Warlord Trait");
  if (!skip.has("Relic") && isRelic(child)) set.add("Relic");
  if (!skip.has("Stratagem") && isStratagem(child)) set.add("Stratagem");
  return [...set];
}
export function getGroupType(child: Instance): string {
  const prf = child.getModifiedProfiles();
  for (const elt of prf) {
    return elt.typeName;
  }
  return "";
}
export function unitCodeName(elt: Instance): string {
  let unit = elt;
  if (elt.isUnit() == false) {
    unit = elt.getParentUnit();
  }
  if (unit) {
    const cat = elt.getParentCategory();
    if (cat) {
      let n = 1;
      for (const x of cat.getUnits()) {
        if (x == unit) {
          break;
        }
        n++;
      }
      return shortCategoryName(cat.getName()) + n;
    }
  }
  return "??";
}
export function isStratagem(option: Instance): number | undefined {
  const cpCost = option.getCosts().find((elt) => elt.name == "CP")?.value || 0;
  return cpCost < 0 ? cpCost : undefined;
}
export function getStratagems(roster: Instance, includeCategoryShort = false): string {
  const allStratagems: Record<string, number> = {};
  const categoryCounts = {} as Record<string, number>;

  for (const category of getCategories(roster)) {
    const categoryName = category.getName();
    for (const unit of category.getUnits()) {
      addOne(categoryCounts, categoryName);
      if (STRATAGEM_SKIP_UNITS.includes(unit.getName())) continue;
      unit.forEach((elt) => {
        if (elt.amount >= 1) {
          const cpCost = isStratagem(elt);
          if (cpCost !== undefined) {
            let name = removePrefix(elt.getName(), "Stratagem:").trim() + `(${cpCost}CP)`;
            if (includeCategoryShort) {
              name = `${shortCategoryName(categoryName)}${categoryCounts[categoryName]}: ${name}`;
            }
            allStratagems[name] = 1 + (allStratagems[name] || 0);
          }
        }
      });
    }
  }

  return Object.entries(allStratagems)
    .map(([name, count]) => (count > 1 ? `${count}x ${name}` : name))
    .join(", ");
}
export interface GroupedStrInstances {
  name: string;
  children: PreparedInstance[];
}
export function getPsychicPowers(unit: Instance, includeCost = true): string[] | null {
  const res: string[] = [];

  unit.forEach((child) => {
    if (child.amount) {
      const prfs = child.getModifiedProfiles();
      for (const prf of prfs) {
        if (prf.typeName == "Psychic Power") {
          const cpCost = child.getCosts().find((o) => o.name === "CP")?.value || 0;
          const cpCostString = cpCost && includeCost ? `(${cpCost}CP)` : "";
          res.push(prf.name + cpCostString);
        }
      }
    }
  });

  if (res.length == 0) {
    return null;
  }
  return res;
}
export function getRelics(unit: Instance): string | null {
  const res: string[] = [];
  unit.forEach((child) => {
    if (child.amount && isRelic(child)) {
      res.push(getTimesString(child.amount) + child.getName());
    }
  });

  if (res.length == 0) {
    return null;
  }
  return `Relics: ${res.join(", ")}`;
}
export function getWarlordTraits(unit: Instance): string | undefined {
  const res: string[] = [];

  unit.forEach((child) => {
    if (child.amount && !child.isGroup()) {
      const isTrait = isWarlordTrait(child);
      if (isTrait) {
        const cpCost = child.getCosts().find((o) => o.name === "CP")?.value || 0;
        const cpCostString = cpCost ? `(${cpCost}CP)` : "";
        res.push(stripNumber(removeGroupName(child.getName(), "Warlord Trait")) + cpCostString);
      }
    }
  });

  if (res.length == 0) {
    return undefined;
  }
  return res.join(", ");
}
export function getUnits(rosterOrForce: Instance, unitName?: string, categoryName?: string): Instance[] {
  const result = [];
  const forces = rosterOrForce.isForce() ? [rosterOrForce] : rosterOrForce.getForces();
  for (const force of forces) {
    for (const category of force.getCategories()) {
      if (categoryName && category.getName() !== categoryName) continue;
      for (const unit of category.getUnits()) {
        if (unitName && unit.getName() !== unitName) continue;
        result.push(unit);
      }
    }
  }
  return result;
}
export function getCategories(rosterOrForce: Instance): Instance[] {
  const result = [];
  const forces = rosterOrForce.isForce() ? [rosterOrForce] : rosterOrForce.getForces();
  for (const force of forces) {
    for (const category of force.getCategories()) {
      result.push(category);
    }
  }
  return result;
}
export function getActualUnits(rosterOrForce: Instance, unitName?: string): Instance[] {
  const result = [];
  const forces = rosterOrForce.isForce() ? [rosterOrForce] : rosterOrForce.getForces();
  for (const force of forces) {
    for (const category of force.getCategories()) {
      if (SKIP_CATEGORIES.includes(category.getName())) continue;
      for (const unit of category.getUnits()) {
        if (unitName && unit.getName() !== unitName) continue;
        result.push(unit);
      }
    }
  }
  return result;
}
export function getWarlord(roster: Instance): Instance | undefined {
  return getUnits(roster).find((o) => isWarlord(o));
}
export function getWarlordAndTrait(roster: Instance): string {
  const warlord = getWarlord(roster);
  const strWarlord = warlord?.getName() || "No Warlord";
  const trait = warlord ? getWarlordTraits(warlord) : "";
  return `${strWarlord}${prefixIf(" - ", trait)}`;
}
export function isWarlordTrait(elt: Instance): boolean {
  if (isStratagem(elt)) return false;
  if (elt.getName().toLowerCase().includes("warlord trait")) return true;
  if (elt.getParentGroups().find((o) => o.getName().toLowerCase().includes("warlord trait"))) return true;
  return false;
}
export function isRelic(elt: Instance): boolean {
  const relics = ["Relic", "Sorcerous Arcana"];
  if (!elt.getParent()) {
    return false;
  }
  const name = elt.getName().toLowerCase();
  if ((!elt.isGroup() && name.includes("relic:")) || name.includes("relic)")) {
    return true;
  }
  for (const relic of relics) {
    if (elt.getParent().getName().includes(relic)) {
      return true;
    }
  }
  return false;
}
export function calcCPstring(roster: Instance): string {
  const numbers = [] as number[];
  let total = 0;
  roster.forEach((elt) => {
    if (elt.amount >= 1) {
      const cost = elt.getCosts().find((elt) => elt.name == "CP");
      if (cost?.value) {
        const num = cost.value * elt.getSelectionCount("root");
        numbers.push(num);
        total += num;
      }
    }
  });

  const math = numbers
    .sort()
    .reverse()
    .map((o) => numberToStringWithPlusOrMinus(o))
    .join("");
  return `${removePrefix(math, "+")} = ${total}CP`;
}
export function getTothelast(roster: Instance): string | null {
  const allUnits: Instance[] = [];

  roster.forEach((elt) => {
    if (elt.isUnit() && SKIP_CATEGORIES.includes(elt.getParentCategory().getName()) == false) {
      allUnits.push(elt);
    }
  });

  allUnits.sort((u1: Instance, u2: Instance) => {
    const cu1 = getPointsTotalCost(u1);
    const cu2 = getPointsTotalCost(u2);
    if (cu1 > cu2) {
      return -1;
    }
    return 1;
  });

  const highests: string[] = [];
  let n = 0;
  for (let i = 0; i < allUnits.length; i++) {
    const current = allUnits[i];
    if (n == 3) {
      break;
    }

    highests.push(unitCodeName(current));
    if (i == 0 || getPointsTotalCost(current) != getPointsTotalCost(allUnits[i - 1])) {
      n++;
    }
  }
  return highests.join(", ");
}
export function getAbhorTheWitch(roster: Instance, psyker = 2, character = 3): string | null {
  let res = 0;
  roster.forEach((elt) => {
    if (elt.isUnit() && elt.getAmount() >= 1) {
      const cats = elt.getAllSecondaries();
      if (cats.find((elt) => elt.toLocaleLowerCase() == "psyker")) {
        const isCharacter = cats.find((elt) => elt.toLocaleLowerCase() == "character");
        res += isCharacter ? character : psyker;
      }
    }
  });
  if (res == 0) {
    return null;
  }
  return `${res} pts`;
}
export function getAssassination(roster: Instance): string | null {
  let result = 0;
  roster.forEach((elt) => {
    if (!elt.isUnit() || !elt.getAmount()) return;
    const cats = elt.getAllSecondaries();
    const foundCharacter = cats.find((elt) => elt.toLocaleLowerCase() == "character");
    if (!foundCharacter) return;
    const foundWarlord = cats.find((elt) => elt.toLocaleLowerCase() == "warlord");
    result += foundWarlord ? 4 : 3;
  });

  return result ? `${result} pts` : null;
}
export function getTitanic(roster: Instance): string | null {
  let res = 0;
  roster.forEach((elt) => {
    if (elt.isUnit() && elt.getAmount() >= 1) {
      const cats = elt.getAllSecondaries();
      if (cats.find((elt) => elt.toLocaleLowerCase() == "titanic")) {
        res++;
      }
    }
  });
  if (res == 0) return null;

  let fres = 0;
  if (res >= 1) fres = 4;
  if (res >= 2) fres = 9;
  if (res >= 3) fres = 15;

  return `${fres} pts`;
}
export function getPointValue(pointsMap: Array<[number, number]>, wounds: number): number {
  for (const [min, pts] of pointsMap) {
    if (wounds >= min) {
      return pts;
    }
  }
  return 0;
}
export function getBringItDown(roster: Instance, pointsMap: Record<number, number>): string {
  let res = 0;
  const pointsSorted: Array<[number, number]> = sortByDescending(Object.entries(pointsMap), ([k]) => k) as any;
  roster.forEach((elt) => {
    if (elt.isUnit() && elt.getAmount() >= 1) {
      const tags = elt.getAllSecondaries();

      const isEligible = tags.find((elt) => elt.toLowerCase() == "monster" || elt.toLowerCase() == "vehicle");
      if (!isEligible) return;

      for (const model of getAllModels(elt)) {
        const w = getWMonsterVehicle(model);
        const pts = getPointValue(pointsSorted, w);
        res += pts;
        console.log(`[BRING IT DOWN] ${pts} - ${model.getName()} (${w} wounds)`);
      }
    }
  });
  return `${res} pts`;
}
export function isWarlord(unit: Instance): boolean {
  const cats = unit.getAllSecondaries();
  const warlord = cats.filter((cat) => cat.toLowerCase() == "warlord");
  return warlord.length >= 1;
}
export function getMaxPoints(roster: Instance): number {
  const rosterMaxPts = roster.getMaxCosts().find((elt) => elt.name == "pts")?.value;
  if (rosterMaxPts) return rosterMaxPts;
  const battleSize = getUnits(roster, "Battle Size", "Configuration")[0];
  if (battleSize) {
    const details = battleSize.calcOptionsList();
    const numbers = details.match(/([0-9]+)/g);
    if (numbers) {
      return Math.max(...numbers.map((o) => parseInt(o)));
    }
  }
  return 2000;
}
export function getAllModels(inst: Instance): Instance[] {
  const res: Instance[] = [];
  inst.forEach((elt) => {
    if (elt.getSelfAmountElseChildsRecursive() && elt.isModel()) {
      res.push(elt);
    }
  });

  return res;
}
export function isVehicle(instance: Instance) {
  return Boolean(
    instance
      .getAllSecondaries()
      .map((o) => o.toUpperCase())
      .includes("VEHICLE")
  );
}
export function skipW(instance: Instance) {
  return Boolean(
    instance
      .getAllSecondaries()
      .map((o) => o.toUpperCase())
      .find((o) => SKIP_WOUNDS.includes(o))
  );
}
export function eligibleW(instance: Instance) {
  return Boolean(
    instance
      .getAllSecondaries()
      .map((o) => o.toUpperCase())
      .find((o) => COUNT_WOUNDS.includes(o))
  );
}
export function getWMonsterVehicle(instance: Instance): number {
  const multiplier = instance.getSelectionCount("root");
  let current = instance;

  // Gets the wounds on an unit or its parents, then multiplies by multiplier
  while (current && !current.isCategory() && !current.isForce() && !current.isCatalogue() && !current.isRoster()) {
    for (const profile of current.getModifiedProfiles()) {
      const found = profile.characteristics.find((o) => o.name === "W");
      if (!found) continue;
      const parsedW = parseInt(found.$text.toString());
      if (parsedW && isFinite(parsedW)) {
        return parsedW * multiplier;
      }
    }

    current = current.getParent();
  }

  return 0;
}
export function getWNoMonsterVehicleCharacter(instance: Instance): number {
  const multiplier = instance.getSelectionCount("root");
  let current = instance;

  // Gets the wounds on an unit or its parents, then multiplies by multiplier
  while (current && !current.isCategory() && !current.isForce() && !current.isCatalogue() && !current.isRoster()) {
    if (!skipW(current)) {
      let profileW: number | undefined;
      for (const profile of current.getModifiedProfiles()) {
        const found = profile.characteristics.find((o) => o.name === "W");
        if (!found) continue;
        const parsedW = parseInt(found.$text.toString());
        profileW = isNaN(parsedW) ? 0 : parsedW;
      }

      if (profileW !== undefined) {
        return profileW * multiplier;
      }
    }

    current = current.getParent();
  }

  return 0;
}
export function getNoPrisonners(roster: Instance): string {
  let totalWounds = 0;
  const counts = {};
  for (const unit of getActualUnits(roster)) {
    if (skipW(unit)) continue;
    for (const model of getAllModels(unit)) {
      if (skipW(model)) continue;
      const wounds = getWNoMonsterVehicleCharacter(model);
      add(counts, `${wounds} ${model.getName()}`);
      totalWounds += wounds;
    }
    console.log(
      "[NO PRISONERS]:\n" +
        Object.entries(counts)
          .map(([k, v]) => `${v}x ${k}`)
          .join("\n") +
        `\ntotal: ${totalWounds}`
    );
  }

  let points = Math.floor(totalWounds / 10);
  if (totalWounds >= 50) {
    points++;
  }
  if (totalWounds >= 100) {
    points++;
  }
  return `${points} pts (${totalWounds} wounds)`;
}
export function hasGameType(roster: Instance, str: string): boolean {
  for (const force of roster.getForces()) {
    const config = force.getCategories().find((o) => o.getName() === "Configuration");
    if (!config) continue;
    const gametypes = config.getUnits().filter((o) => o.getName().toLowerCase().replace(/ /g, "").includes("gametype"));
    for (const gametype of gametypes) {
      if (gametype.calcOptionsList().includes(str)) return true;
    }
  }
  return false;
}
export function getFromSelectors(instance: Instance, selectors: Set<string>): Set<string> {
  const result = new Set<string>();
  const forces = instance.isForce() ? [instance] : instance.getForces();
  for (const force of forces) {
    for (const cat of force.getCategories()) {
      for (const unit of cat.getUnits()) {
        // Add factions from configuration
        const name = unit.getName();
        if (!selectors.has(name)) continue;
        for (const opt of unit.getOptions()) {
          for (const faction of opt.calcOptionsList(undefined, undefined, undefined, true)) {
            result.add(faction);
          }
        }
      }
    }
  }
  return result;
}
export function getFromSelectorsGrouped(instance: Instance, selectors: Set<string>): Record<string, Set<string>> {
  const grouped: Record<string, string[]> = {};
  const forces = instance.isForce() ? [instance] : instance.getForces();
  for (const force of forces) {
    for (const cat of force.getCategories()) {
      for (const unit of cat.getUnits()) {
        // Add factions from configuration
        const name = unit.getName();
        if (!selectors.has(name)) continue;
        for (const opt of unit.getOptions()) {
          for (const faction of opt.calcOptionsList(undefined, undefined, undefined, true)) {
            addObj(grouped, name, faction);
          }
        }
      }
    }
  }
  for (const key in grouped) {
    (grouped as unknown as Record<string, Set<string>>)[key] = new Set<string>(grouped[key]);
  }
  return grouped as unknown as Record<string, Set<string>>;
}
export function getFactionsFromSelectors(instance: Instance): Set<string> {
  return getFromSelectors(instance, FACTIONS_USED_SELECTORS);
}
export function getForceConfigFromSelectors(instance: Instance): Record<string, Set<string>> {
  const result = getFromSelectorsGrouped(instance, FORCE_OPTIONS_SELECTORS);
  replaceKey(result, "Arks of Omen Compulsory Type", "Compulsory Type");
  return result;
}
export function getFactionsUsed(roster: Instance): string {
  const factions = getFactionsFromSelectors(roster);
  const config: string[] = [];
  for (const force of roster.getForces()) {
    for (const cat of force.getCategories()) {
      for (const unit of cat.getUnits()) {
        // Add factions from secondary categories
        const secondaries = unit.getAllSecondaries();
        for (const sec of secondaries) {
          if (sec.startsWith("Faction: ") && !sec.includes("<")) {
            const cat = sec.substring(9, sec.length).trim();
            if (cat.length >= 1) {
              factions.add(cat);
            }
          }
        }
      }
    }
  }
  return [...factions]
    .sort((elt1, elt2) => {
      let w1 = 0;
      let w2 = 0;
      if (roster.getBook().getName().includes(elt1)) {
        w1 = 10;
      }
      if (roster.getBook().getName().includes(elt2)) {
        w2 = 10;
      }
      if (roster.getBook().getName().startsWith(elt1)) {
        w1 = 15;
      }
      if (roster.getBook().getName().startsWith(elt2)) {
        w2 = 15;
      }

      if (config.includes(elt1)) {
        w1 = 5;
      }
      if (config.includes(elt2)) {
        w2 = 5;
      }
      if (w1 > w2) {
        return -1;
      }
      return 1;
    })
    .join(", ");
}
export function grantsKeywords(option: Instance): string[] | null {
  const secondaries = option.getAllSecondaries();
  return secondaries.length ? secondaries : null;
}

export function escapeRegex(str: string) {
  return str.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
}

export function extractGroupName(groupName: string): string {
  return groupName.replace(/(s?)([: -]*)$/g, "");
}
export function removeGroupName(optionName: string, groupName: string) {
  // remove s from end of groupName
  const actualGroupName = extractGroupName(groupName);
  // remove groupName + s at end of words and trailing [: ]
  const regex = new RegExp(`^(${escapeRegex(actualGroupName)})(s?)([: ]*)`);
  return optionName.replace(regex, "");
}

export function nachmundSecondaryObjectives(result: StringBuilder, roster: Instance) {
  result.addLine("To the Last: " + getTothelast(roster));
  result.addLine("No Prisoners: " + getNoPrisonners(roster));

  const as = getAssassination(roster);
  if (as) result.addLine("Assassination: " + as);

  const ab = getAbhorTheWitch(roster, 2, 3);
  if (ab) result.addLine("Abhor the Witch: " + ab);

  const br = getBringItDown(roster, {
    15: 3,
    10: 2,
    0: 1,
  });
  if (br) result.addLine("Bring it Down: " + br);

  const ti = getTitanic(roster);
  if (ti) result.addLine("Titanic: " + ti);
}

export function nephilimSecondaryObjectives(result: StringBuilder, roster: Instance) {
  result.addLine("No Prisoners: " + getNoPrisonners(roster));

  result.addLine("Assassination: " + getAssassination(roster) || "0 pts");

  result.addLine("Abhor the Witch: " + getAbhorTheWitch(roster, 2, 3) || "0 pts");

  result.addLine(
    "Bring it Down: " +
      getBringItDown(roster, {
        20: 4,
        15: 3,
        10: 2,
        0: 1,
      })
  );
}
export function arksOfOmenObjectives(result: StringBuilder, roster: Instance) {
  result.addLine("No Prisoners: " + getNoPrisonners(roster));

  result.addLine("Assassination: " + getAssassination(roster) || "0 pts");

  result.addLine("Abhor the Witch: " + getAbhorTheWitch(roster, 2, 3) || "0 pts");

  result.addLine(
    "Bring it Down: " +
      getBringItDown(roster, {
        20: 4,
        15: 3,
        10: 2,
        0: 1,
      })
  );
}
