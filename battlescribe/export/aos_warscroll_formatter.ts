import { ICost, ListTextFormat } from "../../systems/army_interfaces";
import { NRAssociationInstance } from "../bs_association";
import { prefixIf, sortByDescending, suffixIf, surroundIf } from "../bs_helpers";
import { Instance } from "../bs_instance";
import { stripHtml } from "../../util";

export function formatCosts(costs: ICost[]): string {
  const sorted = sortByDescending(costs, (cost) => cost.name);
  const txt = sorted
    .filter((o) => o.value)
    .map((o) => `${o.value}`)
    .join(", ");
  return surroundIf("(", txt, ")");
}

export function indent(n: number, indentText = "  ", indentEnd = "• "): string {
  if (n === 0) return "";
  return indentText.repeat(n - 1) + indentEnd;
}

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

export function aos_warscroll_format(roster: Instance, form: ListTextFormat): string {
  const newLine = "<br/>";
  function stars(n: number) {
    let res = "";
    for (let i = 0; i < n + 1; i++) {
      res += "*";
    }
    return res;
  }

  function getCost(costs: ICost[]): number {
    try {
      return costs.filter((cost) => cost.name === "pts")[0].value;
    } catch {
      return 0;
    }
  }

  function allAssociations(elt: Instance) {
    const res: NRAssociationInstance[] = [];
    elt.forEach((sub) => {
      res.push(...sub.associations);
    });
    return res;
  }

  function exportUnit(elt: Instance, battalions?: Instance[], ally = false) {
    const cost = getCost(elt.calcTotalCosts());
    let sstars = "";

    if (battalions) {
      const ass = allAssociations(elt)
        .map((ass) => ass.instances)
        .flat();
      for (let i = 0; i < battalions.length; i++) {
        if (ass.includes(battalions[i])) {
          sstars = stars(i);
        }
      }
    }
    const size = elt.calcTotalUnitSize();
    let res = `${size > 1 ? `${size} ` : ""}${elt.getName()}`;
    if (cost) {
      res += ` (${cost})`;
    }
    res += sstars;
    const options = [];
    if (ally) {
      options.push("Allies");
    }
    options.push(
      ...elt
        .calcOptionsListAOS()
        .split(/, /)
        .map((elt) => elt.trim())
        .filter((elt) => elt.length >= 1)
    );
    return [res, ...options.map((elt) => `<i class='gray'>${elt}</i>`)].join(`${newLine} - `);
  }

  function exportAllegiance(allegianceUnit: Instance, optionsGroup: Instance[]) {
    let name = "Allegiance";
    let allegianceNameId: string | null = null;
    const options: string[] = [];

    if (allegianceUnit && allegianceUnit.getOptions()[0]) {
      const allegianceGroup = allegianceUnit.getOptions()[0];
      if (allegianceGroup.getOptions()[0]) {
        const opt = allegianceGroup.getOptions()[0];
        if (opt) {
          name += `: ${opt.getName()}`;
          allegianceNameId = opt.getId();
        }
      }
    }
    const excluded: string[] = [];
    if (allegianceNameId) {
      excluded.push(allegianceNameId);
    }
    options.push(
      ...allegianceUnit
        .calcOptionsListAOS(false, excluded, true)
        .split(/, /)
        .map((elt) => elt.trim())
        .filter((elt) => elt.length >= 1)
    );

    const strategy = optionsGroup.find((elt) => elt.getName() === "Grand Strategy");
    if (strategy) {
      const strat = strategy.calcOptionsListAOS();
      options.push(`Grand Strategy: ${strat}`);
    }

    const triumphs = optionsGroup.find((elt) => elt.getName() === "Triumphs");
    if (triumphs) {
      const strat = triumphs.calcOptionsListAOS();
      options.push(`Triumphs: ${strat}`);
    }

    let res = `<b><u>${name}</b></u>`;
    if (options.length) {
      res += newLine + "- ";
      res += options.map((elt) => `<i class='gray'>${elt}</i>`).join(`${newLine} - `);
    }
    return res;
  }

  const result = [];

  const playerName = form.playerName && form.playerName.length ? form.playerName : "";
  const rosterName = form.rosterName && form.rosterName.length ? form.rosterName : roster.getName();
  const strRoster =
    suffixIf(playerName, " - ") +
    roster.getBook().getName() +
    prefixIf(" - ", rosterName) +
    prefixIf(" - ", formatCosts(roster.calcTotalCosts()));
  result.push("<b>" + strRoster + "</b>" + newLine);

  const excludeFromUnits = [
    "Battleline",
    "Core Battalion",
    "Behemoth",
    "Artillery",
    "Leader",
    "Scenery",
    "Allegiance",
    "Game Options",
    "Malign Sorcery",
    "Warscroll Battalion",
  ];

  const alliedCategoryNames = ["Leader", "Battleline", "Behemoth", "Artillery", "Other"];

  const alliedForces = roster.getForces().filter((elt) => elt.getName() === "Allies");
  const alliedCategories = alliedForces
    .map((elt) => elt.getCategories().filter((cat) => alliedCategoryNames.includes(cat.getName())))
    .flat();
  const alliedUnits = alliedCategories.map((elt) => elt.getUnits()).flat();

  let reinfornced = 0;
  let drops = 0;
  let allies = 0;
  let wounds = 0;

  for (const force of roster.getForces()) {
    if (force.getName() != "Allies") {
      const leader = force
        .getCategories()
        .filter((elt) => elt.getName() === "Leader")
        .map((elt) => elt.getUnits())
        .flat();
      const battleline = force
        .getCategories()
        .filter((elt) => elt.getName() === "Battleline")
        .map((elt) => elt.getUnits())
        .flat();
      const other = force
        .getCategories()
        .filter((elt) => !excludeFromUnits.includes(elt.getName()))
        .map((elt) => elt.getUnits())
        .flat();
      const battalions = force
        .getCategories()
        .filter((elt) => elt.getName() === "Core Battalion")
        .map((elt) => elt.getUnits())
        .flat();
      const allegiance = force
        .getCategories()
        .filter((elt) => elt.getName() === "Allegiance")
        .map((elt) => elt.getUnits())
        .flat()[0];
      const behemoths = force
        .getCategories()
        .filter((elt) => elt.getName() === "Behemoth")
        .map((elt) => elt.getUnits())
        .flat();
      const artillery = force
        .getCategories()
        .filter((elt) => elt.getName() === "Artillery")
        .map((elt) => elt.getUnits())
        .flat();
      const scenery = force
        .getCategories()
        .filter((elt) => elt.getName() === "Scenery")
        .map((elt) => elt.getUnits())
        .flat();
      const malign = force
        .getCategories()
        .filter((elt) => elt.getName() === "Malign Sorcery")
        .map((elt) => elt.getUnits())
        .flat();
      const options = force
        .getCategories()
        .filter((elt) => elt.getName() === "Game Options")
        .map((elt) => elt.getUnits())
        .flat();

      const units = [leader, battleline, other, behemoths, artillery, alliedUnits];
      reinfornced += sum(
        units.map((unitGroup) =>
          sum(
            unitGroup.map((unit) => {
              let count = 0;
              unit.forEach((inst) => {
                if (inst.getName() === "Reinforced") {
                  count += inst.getAmount();
                }
              });
              return count;
            })
          )
        )
      );

      drops += sum(units.map((unitGroup) => unitGroup.length));

      wounds += sum(
        units.map((unitGroup) =>
          sum(
            unitGroup.map((unit) => {
              let res = 0;

              const models = unit.getAllModels();
              for (const model of models) {
                const profiles = model.getAllModifiedProfiles();
                if (profiles.length == 0) {
                  profiles.push(...unit.getModifiedProfiles());
                }
                for (const prf of profiles) {
                  if (prf.characteristics) {
                    res +=
                      model.getModelAmount() *
                      sum(prf.characteristics.map((char) => (char.name === "Wounds" ? parseInt(`${char.$text}`) : 0)));
                  }
                }
              }

              return res;
            })
          )
        )
      );

      if (allegiance) {
        result.push(`${newLine}${exportAllegiance(allegiance, options)}${newLine}`);
      }
      result.push(`${newLine}<b><u>Leaders</b></u>${newLine}`);
      result.push(...leader.map((elt) => exportUnit(elt, battalions) + newLine));

      const allUnits = [
        {
          units: battleline,
          name: "Battleline",
          allies: ["Battleline"],
        },
        {
          units: other,
          name: "Units",
          allies: ["Other"],
        },
        {
          units: behemoths,
          name: "Behemoth",
          allies: ["Behemoth"],
        },
        {
          units: artillery,
          name: "Artillery",
          allies: ["Artillery"],
        },
      ];

      for (const unitGroup of allUnits) {
        const allies = alliedUnits.filter(
          (unit) =>
            unitGroup.allies.includes(unit.getParentCategory().getName()) && unit.getParentForce().getParent() == force
        );

        if (unitGroup.units.length + allies.length) {
          result.push(`${newLine}`);
          result.push(`<b><u>${unitGroup.name}</b></u>${newLine}`);
          result.push(...unitGroup.units.map((elt) => exportUnit(elt, battalions) + newLine));
          result.push(...allies.map((elt) => exportUnit(elt, battalions, true) + newLine));
        }
      }

      if (scenery.length) {
        result.push(`${newLine}`);
        result.push(`<b><u>Endless Spell and Invocations</b></u>${newLine}`);
        result.push(...malign.map((elt) => exportUnit(elt) + newLine));
      }

      if (scenery.length) {
        result.push(`${newLine}`);
        result.push(`<b><u>Scenery</b></u>${newLine}`);
        result.push(...scenery.map((elt) => exportUnit(elt) + newLine));
      }

      if (battalions.length) {
        result.push(`${newLine}`);
        result.push(`<b><u>Core Battalions</b></u>${newLine}`);
        result.push(...battalions.map((elt, index) => stars(index) + exportUnit(elt) + newLine));
      }
    } else {
      allies += getCost(force.calcTotalCosts());
    }
  }

  result.push(`${newLine}<b>Total:</b> ${getCost(roster.calcTotalCosts())} / ${getCost(roster.getMaxCosts())}`);
  result.push(`${newLine}<b>Reinforced Units:</b> ${reinfornced}`);
  result.push(`${newLine}<b>Allies:</b> ${allies} / ${Math.round(getCost(roster.getMaxCosts()) / 5)}`);
  result.push(`${newLine}<b>Wounds:</b> ${wounds}`);
  result.push(`${newLine}<b>Drops:</b> ${drops}`);
  /*
    Total: 370 / 2000
    Reinforced Units: 0 / 4
    Allies: 0 / 400
    Wounds: 23
    Drops: 3
  */

  const res = result.join("");
  if (form.asText || form.pdfExport) {
    return stripHtml(res);
  } else {
    return res;
  }
}
