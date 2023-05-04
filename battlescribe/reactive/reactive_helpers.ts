import type { ReactiveInfoGroup, ReactiveInfoLink, ReactiveProfile, ReactiveRule } from "./reactive_info";
import type {
  ReactiveCondition,
  ReactiveConditionGroup,
  ReactiveModifier,
  ReactiveModifierGroup,
  ReactiveRepeat,
} from "./reactive_modifiers";
import type { ParentModifier, ParentCondition, ParentInfo } from "./reactive_types";

interface HasConditions {
  conditions?: any[];
  conditionGroups?: any[];
}
interface ReactiveChilds {
  conditions?: ReactiveCondition[];
  conditionGroups?: ReactiveConditionGroup[];
  modifiers?: ReactiveModifier[];
  modifierGroups?: ReactiveModifierGroup[];
  repeats?: ReactiveRepeat[];
  infoGroups?: ReactiveInfoGroup[];
  infoLinks?: ReactiveInfoLink[];
  profiles?: ReactiveProfile[];
  rules?: ReactiveRule[];
}

export function setConditionsEnabled(obj: ReactiveChilds, _new: boolean) {
  if (obj.conditions) obj.conditions.forEach((o) => o.setEnabled(_new));
  if (obj.conditionGroups) obj.conditionGroups.forEach((o) => o.setEnabled(_new));
  if (obj.repeats) obj.repeats.forEach((o) => o.setEnabled(_new));
}
export function setChildsEnabled(obj: ReactiveChilds, _new: number) {
  if (obj.modifiers) obj.modifiers.forEach((o) => o.setEnabled(_new));
  if (obj.modifierGroups) obj.modifierGroups.forEach((o) => o.setEnabled(_new));
}
export function setInfoEnabled(obj: ReactiveChilds, _new: boolean) {
  if (obj.infoGroups) obj.infoGroups.forEach((o) => o.setEnabled(_new));
  if (obj.infoLinks) obj.infoLinks.forEach((o) => o.setEnabled(_new));
  if (obj.profiles) obj.profiles.forEach((o) => o.setEnabled(_new));
  if (obj.rules) obj.rules.forEach((o) => o.setEnabled(_new));
}

export function numConditions(obj: HasConditions): number {
  return (obj.conditions?.length || 0) + (obj.conditionGroups?.length || 0);
}

export function modifiersEnabledTimes(obj?: ParentModifier): number {
  if (obj === undefined) return 1;
  return obj.modifiersEnabled();
}
export function modifiersEnabled(obj?: ParentModifier): boolean {
  if (obj === undefined) return true;
  return obj.modifiersEnabled() > 0;
}
export function infoEnabled(obj?: ParentInfo): boolean {
  if (obj === undefined) return true;
  return obj.infoEnabled();
}
export function conditionsEnabled(obj?: ParentCondition): boolean {
  return obj === undefined || obj.conditionsEnabled();
}
