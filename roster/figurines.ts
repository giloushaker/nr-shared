import { IArmyRoster } from "../systems/army_interfaces";
import { suffixIf } from "../../shared/battlescribe/bs_helpers";
import { blossomJs } from "../blossomJs/wrap";

export interface RosterFigurine {
  name: string;
  catalogue?: string;
  unit?: string;
  amount: number;
}
export interface FigurineMatch {
  name: string;
  unit?: string;
  catalogue?: string;
}
export function figurineMatchToString(match: FigurineMatch) {
  return `${suffixIf(match.catalogue, " / ")}${suffixIf(match.unit, " / ")}${match.name}`;
  // const unitEqName = match.unit === match.name;
  // return `${suffixIf(match.catalogue, " / ")}${suffixIf(unitEqName ? "" : match.unit, " / ")}${match.name}`;
}
export interface Figurine {
  name: string;
  description?: string;
  amount?: number;
  painted?: boolean;
  matches?: FigurineMatch[];
}

export function getFigurinesNamesFromRoster(roster: IArmyRoster): Array<RosterFigurine> {
  const result = [] as Array<RosterFigurine>;

  // units
  for (const force of roster.getForces()) {
    const bookName = force.getBook().getName();
    for (const category of force.getCategories()) {
      for (const unit of category.getUnits()) {
        const name = unit.getModelName();
        unit.forEachIncludeInactive((o) => {
          if (!o.isModel()) return;
          // if (o.isUnit()) return;
          if (!o.getModelAmount()) return;
          result.push({
            amount: o.getModelAmount(),
            name: o.getModelName(),
            unit: name,
            catalogue: bookName,
          });
        });
      }
    }
  }
  return result;
}

/**
 * Returns the figurines in `rosterFigurines` by Index which match the provided `ownedFigurine`
 * @param rosterFigurines The figurines in the roster
 * @param ownedFigurine The figurine to match
 */
function matchFigurines(rosterFigurines: Array<RosterFigurine>, ownedFigurine: Figurine): Array<[number, number]> {
  const result = [] as Array<[number, number]>;
  for (let i = 0; i < rosterFigurines.length; ++i) {
    const figurine = rosterFigurines[i];

    if (!ownedFigurine.matches) continue;
    for (const match of ownedFigurine.matches) {
      if (match.catalogue && match.catalogue !== figurine.catalogue) continue;
      if (match.unit && match.unit !== figurine.unit) continue;
      if (match.name !== figurine.name) continue;
      result.push([i, getMatchWeight(match, figurine)]);
    }
  }
  return result;
}

function splitFigurines<T>(hasAmount: Array<T & { amount?: number }>): T[] {
  const result = [] as T[];
  for (const cur of hasAmount) {
    const amount = cur.amount !== undefined ? cur.amount : 1;
    for (let i = 0; i < amount; ++i) {
      const newObj = amount === 1 ? cur : { ...cur, amount: 1 };
      result.push(newObj);
    }
  }
  return result;
}

function stackReplacer(key: string, value: any) {
  return key === "amount" ? undefined : value;
}

function stackFigurines<T>(hasAmount: Array<T & { amount?: number }>): Array<T & { amount: number }> {
  const result = {} as Record<string, number>;
  const resultRef = {} as Record<string, T & { amount?: number }>;
  for (const cur of hasAmount) {
    const str = JSON.stringify(cur, stackReplacer);
    result[str] = 1 + (result[str] || 0);
    resultRef[str] = cur;
  }

  const actualResult = [];
  for (const [k, v] of Object.entries(resultRef)) {
    const resultAmount = result[k];
    v.amount = resultAmount || 1;

    actualResult.push(v as T & { amount: number });
  }
  return actualResult;
}
function getMatchWeight(match: FigurineMatch, fig: RosterFigurine): number {
  const BASE_WEIGHT = 1000000;
  const MATCH_WEIGHT = 10000;
  let weight = BASE_WEIGHT;
  if (match.catalogue && fig.catalogue === match.catalogue) weight += MATCH_WEIGHT;
  if (match.unit && fig.unit === match.unit) weight += MATCH_WEIGHT;
  if (match.name && fig.name === match.name) weight += MATCH_WEIGHT;
  return weight;
}
export interface PairFigurinesResult {
  missing: RosterFigurine[];
  matches: Array<{
    from: RosterFigurine;
    to: Figurine;
  }>;
}
/**
 * @param rosterFigurines The figurines needed to play the roster
 * @param ownedFigurines The figurines owned by the user
 */
export function pairFigurines(rosterFigurines: Array<RosterFigurine>, ownedFigurines: Figurine[]): PairFigurinesResult {
  // Split Stacked Figurines
  rosterFigurines = splitFigurines(rosterFigurines);
  ownedFigurines = splitFigurines(ownedFigurines);

  // Create Input for Blossom
  const blossomInput = [] as Array<[number, number, number]>;
  const rosterFigBase = ownedFigurines.length;
  for (let i = 0; i < ownedFigurines.length; ++i) {
    const figurine = ownedFigurines[i];
    const matches = matchFigurines(rosterFigurines, figurine);

    // Add an edge from Figurine(a) to rosterNodeIndex(b) for each Match(a to b)
    for (const [matchIndex, weight] of matches) {
      const figurineNodeIndex = i;
      const rosterNodeIndex = rosterFigBase + matchIndex;
      blossomInput.push([figurineNodeIndex, rosterNodeIndex, weight - matches.length]);
    }
  }

  // Compute & Retrieve pairings
  const computed = blossomJs(blossomInput);
  const rosterMatches = Array(rosterFigurines.length).fill(null);
  for (const [indexFrom, indexTo] of computed) {
    const rosterCorrectIndex = indexTo - rosterFigBase;
    rosterMatches[rosterCorrectIndex] = ownedFigurines[indexFrom];
  }

  const result: PairFigurinesResult = {
    missing: [],
    matches: [],
  };
  // Get figurines with null match
  const unmatchedFigurines = [];
  for (let i = 0; i < rosterMatches.length; i++) {
    const match = rosterMatches[i];
    if (match === null) unmatchedFigurines.push(rosterFigurines[i]);
    if (match !== null) {
      const from = rosterFigurines[i];
      const to = match;
      result.matches.push({ from: from, to: to });
    }
  }

  result.missing = stackFigurines(unmatchedFigurines);
  return result;
}
