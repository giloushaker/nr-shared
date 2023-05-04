import type { Instance } from "./bs_instance";
import { sortByDescending } from "./bs_helpers";

function ignoreAmount(option: Instance) {
  return option.isUnit() || option.isForce();
}

function getMin(option: Instance): number | undefined {
  if (option.isHidden()) return undefined;
  const nums = option
    .getMinConstraints(true)
    .filter((o) => o.typeId === "selections" && o.value >= 0)
    .map((o) => o.value);
  return nums.length ? Math.max(...nums) : undefined;
}

function getMax(option: Instance): number | undefined {
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

export async function autoCheckCreationAsync(option: Instance) {
  if (!option.isListLoading()) await _autoCheckCreationAsync(option);
}
async function _autoCheckCreationAsync(option: Instance) {
  if (option.isGroup()) await autoCheckCreationGroupAsync(option);
  else if (option.source.isEntry()) await autoCheckCreationEntryAsync(option);
}

async function autoCheckCreationGroupAsync(option: Instance) {
  await new Promise((resolve) => setImmediate(resolve));

  for (const opt of option.getOptions()) {
    await autoCheckCreationAsync(opt);
  }

  const min = getMin(option);
  if (min === undefined) return;

  const options = option.getOptions();
  // Filter non defaultSelectionEntryId here to remove initial 'choices'
  const sorted = sortByDescending(options, (o) => autoCheckPriority(o, option, option.source.defaultSelectionEntryId));
  for (const nested_option of sorted) {
    const missing = min - option.getSelfAmountElseChilds();
    if (missing <= 0) break;
    const nested_status = nested_option.getAmount();
    const nested_add = getAmountToAdd(missing, nested_status, getMax(nested_option));
    nested_option.amount = nested_status + nested_add;
    if (!nested_option.selector.isInstanced) {
      await _autoCheckCreationChildsAsync(nested_option);
    }
  }
}
async function _autoCheckCreationChildsAsync(option: Instance) {
  for (const child of option.getChildInstancesIncludingExtra()) {
    await _autoCheckCreationAsync(child);
  }
}
export async function autoCheckCreationChildsAsync(option: Instance) {
  if (!option.isListLoading()) await _autoCheckCreationChildsAsync(option);
}

async function autoCheckCreationEntryAsync(option: Instance) {
  await new Promise((resolve) => setImmediate(resolve));
  if (ignoreAmount(option)) {
    await _autoCheckCreationChildsAsync(option);
  } else {
    const num = getMin(option);
    const max = getMax(option);
    if (max === 0) return;
    if (num !== undefined) {
      option.amount = num;
    }
    await _autoCheckCreationChildsAsync(option);
  }
}
