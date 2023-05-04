import type { IArmyOption } from "../../shared/systems/army_interfaces";
import type { Base, Link } from "./bs_main";
import type { BSIConstraint } from "./bs_types";
import { HeaderInstance, Instance } from "./bs_instance";
import { getIn } from "./bs_condition";
import { sortByDescending } from "./bs_helpers";
import { ReactiveConstraint } from "./reactive/reactive_modifiers";
function ignoreAmount(option: IArmyOption) {
  return option.isUnit() || option.isForce();
}

export function getMin(option: Instance): number | undefined {
  if (option.isHidden()) return undefined;
  const nums = option
    .getMinConstraints(true)
    .filter((o) => o.typeId === "selections" && o.value >= 0)
    .map((o) => o.value);
  return nums.length ? Math.max(...nums) : undefined;
}

export function getMax(option: Instance): number | undefined {
  if (option.isHidden()) return 0;
  const nums = option
    .getMaxConstraints(true)
    .filter((o) => o.typeId === "selections" && o.value >= 0)
    .map((o) => o.value);
  return nums.length ? Math.min(...nums) : undefined;
}

function autoCheckPriority(option: Instance, group: Instance, defaultId?: string): number {
  if (defaultId && option.getOptionIds().includes(defaultId)) {
    return 1000;
  }

  // Highest Level
  const groupIndex = option.getParentGroups().findIndex((o) => o === group);
  if (groupIndex !== undefined) {
    return groupIndex;
  }
  return -1;
}

function getAmountToAdd(missing: number, optionCurrent: number, optionMax?: number): number {
  if (missing <= 0) return 0;
  const nested_max = optionMax;
  const nested_status = optionCurrent;
  const nested_possible = nested_max === undefined ? missing : nested_max - nested_status;
  const nested_add = Math.min(nested_possible, missing);
  return nested_add;
}
function hasSource(option: Instance, source: Base | Link): boolean {
  return option.source === source || option.source?.target === source;
}

function findUnit(option: Instance, source: Base): Instance | undefined {
  for (const category of option.getAvailableCategories()) {
    for (const unit of category.getAvailableUnits()) {
      if (hasSource(unit, source)) {
        return unit;
      }
    }
  }
}

export function skipAutoCheck(option: Instance, ignoreSettings?: boolean): boolean {
  const roster = option.getParentRoster();
  if (roster.selector.is_loading) return true;
  if (ignoreSettings) return false;
  if (roster.lastChecked === undefined) return true;
  if (roster.canAutocheck === false) return true;
  if (roster.canModifyOtherUnit === false) {
    if (option.findParent((o) => o.uid === roster.lastCheckedEntry) === undefined) {
      return true;
    }
  }
  return false;
}

export function autoCheckCreation(option: Instance) {
  if (!option.isListLoading()) _autoCheckCreation(option);
}
function _autoCheckCreation(option: Instance) {
  if (option.isForce()) autoCheckCreationForce(option);
  else if (option.isGroup()) autoCheckCreationGroup(option);
  else if (option.source.isEntry()) autoCheckCreationEntry(option);
}
function autoCheckCreationForce(force: Instance) {
  const roster = force.getParentRoster();
  const roster_extra = roster.getModifiedExtraConstraints();
  const roster_extra_units = roster_extra.filter((o) => o.source.parent.isUnit());
  const force_extra = force.getModifiedExtraConstraints();
  const force_extra_units = force_extra.filter((o) => o.source.parent.isUnit());
  const added = new Set<string>();
  for (const extra1 of roster_extra_units) {
    if (!extra1.computed) continue;
    const unit = findUnit(force, extra1.source.parent);
    if (!unit) {
      console.log(`Couldn't find unit ${extra1.source.parent.getName()} in ${force.getName()}`);
      continue;
    }
    if (added.has(unit.getId())) {
      continue;
    }
    force.insertUnit(debugSettings, unit);
    added.add(unit.getId());
  }
  for (const extra2 of force_extra_units) {
    if (!extra2.computed) continue;
    const unit = findUnit(force, extra2.source.parent);
    if (!unit) {
      console.log(`Couldn't find unit ${extra2.source.parent.getName()} in ${force.getName()}`);
      continue;
    }
    if (added.has(unit.getId())) {
      continue;
    }
    force.insertUnit(debugSettings, unit);
    added.add(unit.getId());
  }

  for (const category of force.getAvailableCategories()) {
    const category_extra = category.getModifiedExtraConstraints();
    const category_extra_units = category_extra.filter((o) => o.source.parent.isUnit());

    for (const extra of category_extra_units) {
      if (!extra.computed) continue;

      const unit = category.getAvailableUnits().find((o) => hasSource(o, extra.source.parent));
      if (!unit) {
        console.log(`Couldn't find unit ${extra.source.parent.getName()} in ${force.getName()}`);
        continue;
      }
      if (added.has(unit.getId())) {
        continue;
      }
      force.insertUnit(debugSettings, unit);
      added.add(unit.getId());
    }
  }
}

function autoCheckCreationGroup(option: Instance) {
  option.getOptions().forEach((o) => _autoCheckCreation(o));

  const min = getMin(option);
  if (min === undefined) return;

  const options = option.getOptions();
  // Filter non defaultSelectionEntryId here to remove initial 'choices'
  const sorted = sortByDescending(options, (o) => autoCheckPriority(o, option, option.source.defaultSelectionEntryId));
  for (const nested_option of sorted) {
    // if (nested_option.isHidden()) continue;
    const missing = min - option.getSelfAmountElseChilds();
    if (missing <= 0) break;
    const nested_status = nested_option.getAmount();
    const nested_add = getAmountToAdd(missing, nested_status, getMax(nested_option));
    nested_option.amount = nested_status + nested_add;
    // console.debug(
    //   "autoCheckCreationGroup",
    //   `${nested_option.getName()} has been enabled x${nested_status + nested_add}`
    // );

    if (!nested_option.selector.isInstanced) {
      _autoCheckCreationChilds(nested_option);
    }
  }
}
function autoCheckCreationAssociations(option: Instance) {
  for (const association of option.getAssociations()) {
    association.autoCheckOnInit();
  }
}
function _autoCheckCreationChilds(option: Instance) {
  option.getChildInstancesIncludingExtra().forEach((o) => _autoCheckCreation(o));
}
export function autoCheckCreationChilds(option: Instance) {
  if (!option.isListLoading()) {
    _autoCheckCreationChilds(option);
    autoCheckCreationAssociations(option);
  }
}
function autoCheckCreationEntry(option: Instance) {
  if (ignoreAmount(option)) {
    _autoCheckCreationChilds(option);
    autoCheckCreationAssociations(option);
  } else {
    const num = getMin(option);
    const max = getMax(option);
    if (max === 0) return;
    if (num !== undefined) {
      if (option.isSubUnit()) {
        const amount = option.selector.instances.length;
        const toAdd = num - amount;
        for (let i = 0; i < toAdd; i++) {
          const instance = option.selector.addInstance();
          _autoCheckCreationChilds(instance);
        }
      } else {
        option.amount = num;
      }
    }
    _autoCheckCreationChilds(option);
    autoCheckCreationAssociations(option);
  }
}

// Could ignore settings
export function autoCheckWhenZero(option: Instance, ignoreSettings?: boolean) {
  if (skipAutoCheck(option, ignoreSettings)) return;
  if (!option.isQuantifiable() || option.getAmount() > 0 || option.isHidden()) return;
  const min = getMin(option);
  if (min !== undefined) {
    const log = option.getAmount() && min > 0;
    option.setAmount(debugSettings, min);
    if (log) {
      autocheckLog(option, `${option.getName()} has been enabled`);
    }
    // console.debug("autoCheckWhenZero", `${option.getName()} has been enabled`);
  }
  option.getOptions().forEach((o) => _autoCheckCreation(o));
}

export function autoCheckOnHideOrMaxZero(option: Instance) {
  if (skipAutoCheck(option)) return;
  if (option.isQuantifiable() && !option.isUnit() && !option.isSubUnit()) {
    if (option.isHidden() || getMax(option) === 0) {
      const log = option.getAmount() && option.state.propagate;
      option.setAmount(debugSettings, 0);
      if (log) {
        autocheckLog(option, `${option.getName()} has been disabled`, true);
      }
      // console.debug("autoCheckOnHideOrMaxZero", `${option.getName()} has been enabled`);
    }
  }
}

// Could ignore settings when scope is "parent" / "self"
export function autoCheckMax(option: Instance) {
  if (skipAutoCheck(option)) return;
  const nodes = [option, ...option.getParentGroups()];
  const highest = nodes[nodes.length - 1];

  for (const node of nodes) {
    for (const constraint of node.getModifiedConstraints().filter((o) => isMaxOneSelectionsConstraint(o))) {
      if (!constraint.computed) continue;
      const options = getConstraintOptions(node, constraint.source);
      removeOthers(option, options);
    }
    for (const constraint of node.getModifiedExtraConstraints().filter((o) => isMaxOneSelectionsConstraint(o))) {
      if (!constraint.computed) continue;
      const options = getConstraintOptions(node, constraint.source);
      removeOthers(option, options);
    }
  }
  const allSecondaries = highest.getAllSecondariesIds();
  for (const parent of highest.parents) {
    for (const extra of parent.getModifiedExtraConstraints().filter((o) => isMaxOneSelectionsConstraint(o))) {
      if (allSecondaries.has(extra.source.parent.getId())) {
        if (!extra.computed) continue;
        const options = getConstraintOptions(parent, extra.source);
        removeOthers(option, options);
      }
    }
  }
}
function removeOthers(option: Instance, options: Instance[]) {
  let filtered = options.filter((o) => o.selector !== option.selector);
  if (options.length === filtered.length) return;
  const roster = option.getParentRoster();
  if (!roster.canModifyOtherUnit) {
    filtered = filtered.filter((o) => o.findParent((o) => o.uid === roster.lastCheckedEntry));
  }
  // if scope is greater than parent unit, skip?
  for (const toremove of filtered) {
    const log = option.getAmount();
    toremove.setAmount(debugSettings, 0);
    if (log) {
      autocheckLog(toremove, `${toremove.getName()} has been disabled`);
    }
    // console.debug("removeOthers", `${option.getName()} has been disabled`);
  }
}
function getConstraintOptions(option: Instance, constraint: BSIConstraint): Instance[] {
  const constraint_target_id = constraint.childId || option.getId();
  const childs = getIn(
    option,
    constraint.scope,
    true,
    constraint.includeChildSelections,
    constraint.includeChildForces,
    constraint.shared
  );
  const found = childs.filter((instance) => {
    if (!instance.hasFilter(constraint_target_id)) return false;
    if (!instance.amount || instance.isHidden()) return false;
    if (instance.isUnit() || instance.isForce()) return false;
    if (instance instanceof HeaderInstance) return false;
    return true;
  });
  return found;
}

export function isMaxOneSelectionsConstraint(constraint: ReactiveConstraint) {
  if (constraint.value !== 1) return false;
  if (constraint.source.type !== "max") return false;
  if (constraint.source.percentValue) return false;
  if (constraint.source.field !== "selections") return false;
  return true;
}

function autocheckLog(option: Instance, msg: string, force?: boolean) {
  const roster = option.getParentRoster();
  const settings = roster?.settings;
  if (settings && settings.logWarnings !== false) {
    if (!roster.lastCheckedEntry || force || !option.findParent((o) => o.uid === roster.lastCheckedEntry)) {
      settings.logError(0, null, option.getParentUnit(), msg);
    }
  }
}
const debugSettings = { automaticMode: false, disabled: true, manual: false } as any;
export function reset(option: Instance) {
  for (const nested_option of option.getOptions()) {
    if (nested_option.isUnit() || nested_option.isForce() || nested_option.isSubUnit()) {
      nested_option.delete();
    } else {
      reset(nested_option);
    }
  }

  if (!option.isRoster() && !option.isCategory() && !option.isUnit()) {
    option.amount = 0;
  }
}

// (globalThis as any).$check = () => {
//   reset(globalThis.$debugOption);
//   autoCheckCreation($debugOption);
// };
