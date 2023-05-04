import type { ErrorMessage } from "../error_manager";
import type { GameSystem } from "./game_system";
import { leanName } from "../util";
import AlgoSettings from "../army/algo_settings";

import { sortByDescending } from "../battlescribe/bs_helpers";
import type { BooksDate } from "../battlescribe/bs_versioning";
import type { NRAssociationInstance } from "../battlescribe/bs_association";

type CostIndex = { [key: string]: ICost };

export interface ICost {
  name: string;
  value: number;
  typeId: string;
}

export interface IModel {
  name: string;
}
export interface IUnit {
  uid: string;
  id: string;
  name: string;
  getStartingCosts(calculateCosts?: string): Promise<ICost[]> | ICost[];
  getModels?: () => IModel[];
  isHidden(roster?: IArmyRoster): boolean;
  source?: any;
  getBook: () => IArmyBook;
}

export interface ICategory {
  id: string;
  uid: string;
  name: string;
  getAvailableUnits(): IUnit[];
  isHidden(roster?: IArmyRoster): boolean;
}

export interface IForce {
  id: string;
  name: string;
  getAvailableCategories(): ICategory[];
}

export interface ListTextFormat {
  rosterName?: string;
  playerName?: string;
  teamName?: string;
  insertName?: boolean;
  format?: string;
  unitCostsAfterOptions?: boolean;
  catRecap?: boolean; // Category recap
  noCost?: boolean; // Do not show costs in details
  unitCategoryNum?: boolean;
  asText?: boolean; // By default html is exported, this indicates we should export text instead
  pdfExport?: boolean;
  includeConstants?: boolean;
}

export interface IArmyBook {
  getId(): number;
  getLastUpdated(): string | undefined;
  getIdSystem(): number;
  getName(): string;
  getShort(): string;
  getVersion(): string;
  getRevision(): string;
  getSystem(): GameSystem;
  createRoster(costs: ICost[]): IArmyRoster;
  loadRosterFromJson(json: any, booksDate?: BooksDate): Promise<IArmyRoster>;
  getCosts(): ICost[];
  getForces(): IForce[];
  // getWikiContent(): WikiContent;
}

export interface IArmyRoster extends IArmyEntry {
  getIncludedBooks(): number[];
  initVars(settings: AlgoSettings): void;
  getForces(): IArmyForce[];
  getAvailableForces(): IForce[];
  toJson(): any;
  validateArmy(): ErrorMessage[];
  calcTotalCosts(): ICost[];
  getMaxCosts(): ICost[];
  setMaxCosts(costs: ICost[]): void;
  insertForce(book: IArmyBook | null, id: string | null): IArmyForce | null;
  exportArmy(textFormat: ListTextFormat): string;
  hasMultipleCatalogues(): boolean;
  forEachIncludeInactive(callback: (elt: IArmyEntry) => void): void;
  getPointsCost(): number;
}

export interface IArmyForce extends IArmyEntry {
  getParentRoster(): IArmyRoster;
  getCategories(): IArmyCategory[];
  insertUnit(settings: AlgoSettings, unit: IUnit, clone: IArmyUnit | null): IArmyUnit | null;
  insertForce(book: IArmyBook | null, id: string | null): IArmyForce | null;
  calcTotalCosts(): ICost[];
  // getParentCatalogueName(): string;
  delete(settings: AlgoSettings): void;
  getAvailableCategories(): ICategory[];
  getAvailableForces(): IArmyForce[];
}

export interface IArmyCategory extends IArmyEntry {
  getParentForce(): IArmyForce;
  getParentRoster(): IArmyRoster;
  calcTotalCosts(): ICost[];
  getUnits(): IArmyUnit[];
  getAvailableUnits(): IUnit[];
}

export interface IArmyUnit extends IArmyEntry {
  toJsonObject(): any;
  getParentCategory(): IArmyCategory;
  getParentForce(): IArmyForce;
  getParentRoster(): IArmyRoster;
  getOptions(): IArmyOption[];
  isScoring(): boolean;
  calcOptionsList(): string;
  calcTotalCosts(): ICost[];
  calcTotalUnitSize(): number;
  applyModifications(settings: AlgoSettings): void;
  dupe(): Promise<Array<ErrorMessage> | null>;
  delete(settings: AlgoSettings): number;
  updateDisplayStatus(): void;
  getCategoryIcon(): string | null;
  displayProfiles?: boolean;
}

export interface IArmyOption extends IArmyEntry {
  calcTotalCosts(): ICost[];
  // USED IN VUE
  getLeafMaxCost?: any;
  calcLeafChildrenCost?: any;

  getParentUnit(): IArmyUnit;
  getParentCategory(): IArmyCategory;
  getParentForce(): IArmyForce;
  getParentRoster(): IArmyRoster;
  getOptions(): IArmyOption[];
  showConstraints(): boolean; // shouldn't be in interface
  locallyRestricted(): boolean;
  globallyRestricted(): boolean;
  getAssociations(): NRAssociationInstance[];
}

export interface IConstraint {
  field: string;
  value: number;
  typeId: string;
}
export interface IArmyEntry {
  uid: string;
  getName(translate?: boolean): string;
  getCustomName(): string | undefined;
  setCustomName(name: string): void;
  getId(): string;
  getBook(): IArmyBook;
  getOptionType(): string;
  getOptionsLabel(): string | null | undefined;
  getCosts(): ICost[];
  isHidden(): boolean;
  isCollapsible(): boolean; // shouldn't be in interface
  getDescription(): string | undefined;
  getAmount(): number;

  setAmount(settings: AlgoSettings, n: number): number | null;
  getMinConstraints(): IConstraint[];
  getMaxConstraints(): IConstraint[];
  getUid(): string;
  countVisibleActivatedChildren(): number; // shouldn't be in interface
  isConstant(): boolean;
  getChildren(): IArmyEntry[];
  isSubUnit(): boolean;
  isUnit(): this is IArmyUnit;
  isForce(): this is IArmyForce;
  isGroup(): boolean;
  getParentUnit(): IArmyUnit;
  getTags(): (string | { ref: string; amount: number })[];
  getErrors(): ErrorMessage[];
  calcTotalCostsForOne(): ICost[];

  getParent(): IArmyEntry | null;

  forEachIncludeInactive(cb: (entry: IArmyEntry) => unknown): void;
  isModel(): boolean;
  isCrew(): boolean;
  getModelAmount: () => number;
  getModelName(): string;

  getAllModels(): IArmyEntry[];
}

export interface SetupCategory {
  name: string;
  id_game_system: number;
  ord: number;
  items: SetupCategoryItem[];
  id: string;
}

export interface SetupCategoryItem {
  id: number;
  name: string;
  ord: number;
  id_system_category: string;
  fluff?: string;
  fluffname?: string;
}

export type GameSetup = Record<string, SetupCategoryItem>;

export interface ReportRosterElement {
  totalCost: number;
  amount: number;
  parentUnit?: string;
}
export interface ReportRoster {
  units: Record<string, ReportRosterElement[]>;
  options: Record<string, ReportRosterElement[]>;
  forces: Record<string, ReportRosterElement[]>;
  refs: Record<string, number>;
}

function round(num: number): number {
  return Math.round(num * 100) / 100;
}

export function addCosts(allCosts: ICost[][]): CostIndex {
  const res: CostIndex = {};
  for (const costs1 of allCosts) {
    for (const elt of costs1) {
      if (res[elt.typeId] == undefined) {
        res[elt.typeId] = { typeId: elt.typeId, name: elt.name, value: 0 };
      }
      res[elt.typeId].value += elt.value;
    }
  }
  return res;
}

export function categoryLimit(cat: IArmyCategory | IArmyRoster): string {
  const mint = cat.getMinConstraints().filter((elt) => elt.field != "selections");
  const maxt = cat.getMaxConstraints().filter((elt) => elt.field != "selections");
  const totals = sortByDescending(cat.calcTotalCosts(), (o) => o.name);

  for (const total of [mint, maxt, totals]) {
    if (total) {
      for (const elt of total) {
        elt.typeId = elt.typeId.replace(/.*::(.*)/, "$1");
      }
    }
  }
  let res = "";
  let error = "";

  for (const total of totals) {
    let cur: string | null = null;
    const min = mint.find((elt) => elt.typeId === total.typeId);
    if (min && min.value > 0) {
      if (total.value < min.value) {
        error = "error";
        cur = `<span class='cost error'>${round(total.value)} / ${round(min.value)} ${min.field}</span>`;
      } else {
        cur = `<span class='cost'>${round(total.value)} / ${round(min.value)} ${min.field}</span>`;
      }
    }

    const max = maxt.find((elt) => elt.typeId === total.typeId);
    if (max && max.value > 0) {
      if (total.value > max.value) {
        cur = `<span class='cost error'>${round(total.value)} / ${round(max.value)} ${total.name}</span>`;
      } else {
        cur = `<span class='cost'>${round(total.value)} / ${round(max.value)} ${total.name}</span>`;
      }
    }

    if (cur == null && total.value != 0) {
      cur = `<span class='cost'>${round(total.value)}${total.name}</span>`;
    }
    if (cur) {
      res += cur;
    }
  }

  return `<span class="costList ${error}">${res}</span>`;
}

export function formatCostsLimit(costs: ICost[], limits: ICost[]): string {
  const totals = costs;

  let res = "";

  for (const total of totals) {
    let cur: string | null = null;
    const min = limits.find((elt) => elt.typeId === total.typeId);
    if (min && min.value > 0) {
      if (total.value < min.value) {
        cur = `<span class='cost'>${round(total.value)} / ${round(min.value)} ${total.name}</span>`;
      } else {
        cur = `<span class='cost'>${round(total.value)} / ${round(min.value)} ${total.name}</span>`;
      }
    }

    if (cur == null && total.value != 0) {
      cur = `<span class='cost'>${round(total.value)}${total.name}</span>`;
    }
    if (cur) {
      res += cur;
    }
  }

  return `<span class="costList">${res}</span>`;
}

export function formatCosts(costs: ICost[]): string {
  let res = "";
  costs = sortByDescending(costs, (c) => c.name);
  for (const cost of costs) {
    if (cost.value != 0) {
      let name = "";
      if (cost.name.length != 0) {
        name = " " + cost.name;
      }
      res = `${res}<span class='cost'>${round(cost.value)}${name}</span>`;
    }
  }
  if (res.length == 0) {
    return res;
  }
  return `<span class="costList">${res}</span>`;
}

export function multiplyCosts(costs: ICost[], mult: number): void {
  for (const elt of costs) {
    elt.value *= mult;
  }
}

export function rosterToReport(roster: IArmyRoster): ReportRoster {
  const res: ReportRoster = {
    units: {},
    options: {},
    refs: {},
    forces: {},
  };

  try {
    roster.forEachIncludeInactive((opt) => {
      if (opt.isUnit()) {
        const unit = opt as IArmyUnit;
        if (!res.units[unit.getName(false)]) res.units[unit.getName(false)] = [];
        res.units[unit.getName(false)].push({
          totalCost: unit.calcTotalCosts()[0]?.value || 0,
          amount: unit.getAmount(),
        });
      } else {
        try {
          if (opt.getOptionType() === "numeric" || opt.getOptionType() === "check") {
            const optName = leanName(opt.getName(false));
            if (!res.options[optName]) res.options[optName] = [];
            let parent: IArmyUnit | null = null;
            try {
              parent = opt.getParentUnit();
            } catch {
              parent = null;
            }
            res.options[optName].push({
              totalCost: opt.getCosts()[0]?.value || 0,
              amount: opt.getAmount(),
              parentUnit: parent ? opt.getParentUnit().getName(false) : "",
            });
          }
        } catch (e) {
          console.log(e);
        }
      }

      for (const ref of opt.getTags()) {
        let refString: string | { ref: string; amount: number } = ref;
        let amt = 1;

        if (typeof refString != "string") {
          amt = refString.amount;
          refString = refString.ref;
        }
        if (!res.refs[refString]) {
          res.refs[refString] = 0;
        }
        res.refs[refString] += amt;
      }
    });
  } catch {
    //
  }
  return res;
}

export function isGroup(option: IArmyEntry): boolean {
  return option.getOptionType() === "group";
}

export function hasVisibleChild(hideIsConstant: boolean, option: IArmyOption): boolean {
  const current = [...option.getOptions()] as IArmyOption[];
  for (let i = 0; i < current.length; i++) {
    const current_option = current[i];
    if (!isGroup(current_option) && !current_option.isHidden() && (!hideIsConstant || !current_option.isConstant()))
      return true;
    if (!current_option.isHidden()) {
      current.push(...current_option.getOptions());
    }
  }
  return false;
}

export function hasSelectedChild(option: IArmyOption): boolean {
  const current = [...option.getOptions()] as IArmyOption[];
  for (let i = 0; i < current.length; i++) {
    const cur = current[i];
    if (!isGroup(cur) && cur.getAmount()) return true;
    current.push(...cur.getOptions());
  }
  return false;
}
