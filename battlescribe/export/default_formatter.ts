import { ICost, ListTextFormat } from "../../systems/army_interfaces";
import { prefixIf, sortByDescending, suffixIf, surroundIf, flattenRecursive, groupBy } from "../bs_helpers";
import { Instance } from "~/assets/shared/battlescribe/bs_instance";

export function formatCosts(costs: ICost[]): string {
  const sorted = sortByDescending(costs, (cost) => cost.name);
  const txt = sorted
    .filter((o) => o.value)
    .map((o) => `${o.value}${o.name.trim()}`)
    .join(", ");
  return surroundIf("[", txt, "]");
}

export function formatCostsSplit(costs: ICost[]): string {
  const sorted = sortByDescending(costs, (cost) => cost.name);
  const txt = sorted
    .filter((o) => o.value)
    .map((o) => `[${o.value}${o.name.trim()}]`)
    .join("");
  return txt;
}
export function indent(n: number, indentText = "  ", indentEnd = "• "): string {
  if (n === 0) return "";
  return indentText.repeat(n - 1) + indentEnd;
}
function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}
export function default_format(roster: Instance, form: ListTextFormat): string {
  const result = [];
  const newLine = form.asText || form.pdfExport ? "\n" : "<br />";
  const playerName = form.playerName && form.playerName.length ? form.playerName : "";
  const rosterName = form.rosterName && form.rosterName.length ? form.rosterName : roster.getName();
  const strRoster =
    suffixIf(playerName, " - ") +
    roster.getBook().getName() +
    prefixIf(" - ", rosterName) +
    prefixIf(" - ", formatCosts(roster.calcTotalCosts()));
  result.push(strRoster + newLine);

  const hasMultipleCatalogues = roster.hasMultipleCatalogues();
  for (const force of roster.getForces()) {
    const bookName = hasMultipleCatalogues ? force.getBook().getName() : "";

    const strForce =
      `## ${suffixIf(bookName, " - ")}` + `${force.getName()}` + prefixIf(" ", formatCosts(force.calcTotalCosts()));
    result.push(newLine + strForce + newLine);

    for (const category of force.getCategories()) {
      if (!category.getUnits()?.length && !sum(Object.values(category.getTotalCosts()).map((o) => o.value))) continue;

      const strCategory = `### ${category.getName()}` + prefixIf(" ", formatCosts(category.calcTotalCosts()));
      result.push(newLine + strCategory + newLine);

      for (const unit of category.getUnits()) {
        const flat = flattenRecursive(unit.getSubUnits());
        const grouped = groupBy(flat, (o) => o.depth.toString() + JSON.stringify(o.current.toJsonObject()));
        for (const group of Object.values(grouped)) {
          const { current, depth } = group[0];
          const groupRawAmount = group.map((o) => o.current.amount).reduce((a, b) => a + b, 0);
          const groupAmount = groupRawAmount > 1 ? groupRawAmount : 0;
          const detailsString = current.calcOptionsListSkipSubUnits(form.includeConstants);
          const strSubUnit =
            indent(depth, "• ") +
            suffixIf(suffixIf(groupAmount, "x"), " ") +
            current.getName() +
            prefixIf(" ", formatCosts(current.calcTotalCosts())) +
            prefixIf(": ", detailsString);
          result.push(strSubUnit + newLine);
        }
      }
    }
  }
  return result.join("");
}
