import type { ReportScore } from "../../../types/db_types";
import { IArmyRoster } from "./army_interfaces";
import { GameSystem } from "../../ts/systems/game_system";
import { calcBattlepoints, CalculatedBP } from "../../shared/util";
import type { ScoringSystem } from "./bs_game_system";

export const defaultScore: ScoringSystem = {
  id: 0,
  name: "Default Scoring",
  score: {
    pts: {
      short: "pts",
      name: "Points",
      min: 0,
      type: "number",
      mod: true,
    },
  },
  primary: "pts",
  objective: null,
};

export function setReportScoreFromBP(old: ReportScore, calculatedBP: CalculatedBP): void {
  old[0]["BP"] = calculatedBP.battlepoints[0];
  old[1]["BP"] = calculatedBP.battlepoints[1];
  old[0]["VP"] = calculatedBP.vp[0];
  old[1]["VP"] = calculatedBP.vp[1];
  old[0]["BPObj"] = calculatedBP.battlepointsWobj[0];
  old[1]["BPObj"] = calculatedBP.battlepointsWobj[1];
  if (old[0] != null && old[0]["VP"] != null && old[1] != null && old[1]["VP"] != null) {
    old[0]["Diff"] = old[0]["VP"] - old[1]["VP"];
    old[1]["Diff"] = old[1]["VP"] - old[0]["VP"];
  }
}
// Functions specific to game systems that automatically modify score values after a change
const systemScoresFunctions: any = {
  t9a: function (scoring: ScoringSystem, roster: (IArmyRoster | null)[], old: ReportScore): void {
    let nobj = 0;
    if (old[0]["Obj"]) {
      nobj = 1;
    }
    if (old[1]["Obj"]) {
      nobj = 2;
    }
    let maxCost = 4500;
    for (let i = 0; i < 2; i++) {
      if (roster[i] != null) {
        maxCost = roster[i]?.getMaxCosts()[0]?.value || 4500;
        break;
      }
    }
    const calculatedBP = calcBattlepoints(maxCost, old[0]["VP"] || 0, old[1]["VP"] || 0, nobj);
    setReportScoreFromBP(old, calculatedBP);
  },

  wh40k: function (scoring: ScoringSystem, roster: IArmyRoster[], old: ReportScore): void {
    if (scoring.id == 2) {
      for (let i = 0; i < 2; i++) {
        old[i]["KP"] = (old[i]["KPS"] || 0) + (old[i]["KPP"] || 0) + (old[i]["KPB"] || 0);
      }
      old[0]["Diff"] = (old[0]["KP"] || 0) - (old[1]["KP"] || 0);
      old[1]["Diff"] = (old[1]["KP"] || 0) - (old[0]["KP"] || 0);
      const diff = Math.abs(old[0]["Diff"]);
      const divided = Math.floor(diff / 5);
      const capped = Math.min(divided, 10);
      old[0]["VP"] = 10 + (old[0]["Diff"] >= 0 ? 1 : -1) * capped;
      old[1]["VP"] = 10 + (old[1]["Diff"] >= 0 ? 1 : -1) * capped;
    }

    if (scoring.id == 1) {
      if (old[0]["VP"] === old[1]["VP"]) {
        old[0]["TP"] = (old[0]["VP"] || 0) + 500;
        old[1]["TP"] = (old[1]["VP"] || 0) + 500;
      } else {
        if ((old[0]["VP"] || 0) > (old[1]["VP"] || 0)) {
          old[0]["TP"] = (old[0]["VP"] || 0) + 1000;
          old[1]["TP"] = old[1]["VP"] || 0;
        } else {
          old[0]["TP"] = old[0]["VP"] || 0;
          old[1]["TP"] = (old[1]["VP"] || 0) + 1000;
        }
      }
      old[0]["VPTaken"] = old[1]["VP"];
      old[1]["VPTaken"] = old[0]["VP"];
    }
  },
};

export function eloRatio(sc1: number, sc2: number): number {
  const max = Math.max(sc1, sc2);
  const diff = Math.abs(sc1 - sc2);
  return diff / max;
}

// Functions specific to game systems that automatically modify score values after a change
export const eloRatioFunctions: any = {
  t9a: function (sc1: number, sc2: number): number {
    const scoreDiff = Math.abs(sc1 - sc2);
    let ratio = Math.sqrt(scoreDiff) / Math.sqrt(10);
    if (scoreDiff == 0) {
      // In case of a draw, the winner is considered the player who has the lowest ELO
      // We give them half the points they would get from a 11-9
      ratio = Math.sqrt(2) / Math.sqrt(10);
      ratio /= 2;
    }
    return ratio;
  },

  wh40k: function (sc1: number, sc2: number): number {
    const scoreDiff = Math.abs(sc1 - sc2);
    let ratio = Math.sqrt(scoreDiff) / Math.sqrt(10);
    if (scoreDiff == 0) {
      // In case of a draw, the winner is considered the player who has the lowest ELO
      // We give them half the points they would get from a 11-9
      ratio = Math.sqrt(2) / Math.sqrt(10);
      ratio /= 2;
    }
    return ratio;
  },
};

export function winCondition(score: ReportScore, fields: string[]): number | null {
  const score1 = score[0];
  const score2 = score[1];
  if (!score1 || !score2) {
    return null;
  }

  for (const field of fields) {
    const sc1 = score1[field];
    const sc2 = score2[field];
    if (sc1 != null && sc2 != null) {
      const diff = sc1 - sc2;
      if (diff > 0) {
        return 0;
      }
      if (diff < 0) {
        return 1;
      }
    }
  }

  return null;
}

export function modifyScore(
  scoring: ScoringSystem,
  roster: (IArmyRoster | null)[],
  sys: GameSystem,
  old: ReportScore
): void {
  const fun = systemScoresFunctions[sys.short];
  if (fun != null) {
    fun(scoring, roster, old);
  }
}
