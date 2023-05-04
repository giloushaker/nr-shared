import type { BSICondition, BSIConstraint, BSIQuery, BSIRepeat } from "../bs_types";
import type { ReactiveProfileT, ReactiveRuleT } from "./reactive_info";
import type { ReactiveConstraint, ReactiveModifier, ReactiveExtraConstraint } from "./reactive_modifiers";

export interface ParentCondition {
  conditionsEnabled(): boolean;
  conditionsChanged(_new: boolean, old: boolean): void;
}
export interface ParentModifier {
  modifiersEnabled(): number;
}
export interface ParentInfo {
  infoEnabled(): boolean;
}

export interface ParentRepeat extends ParentCondition {
  repeatChanged(_new: number, old: number): void;
}
export interface HasConstraintCallback {
  onConstraintChanged(constraint: ReactiveConstraint, _new: boolean, old: boolean): void;
}
export interface HasExtraConstraintCallback {
  onExtraConstraintChanged(constraint: ReactiveExtraConstraint, _new: boolean, old: boolean): void;
}
export interface ParentTotal {
  totalChanged(_new: number): void;
}
export interface QueryReactive {
  queryChanged(_new: number, old: number): void;
  source: BSICondition | BSIRepeat | BSIConstraint | BSIQuery;
}
export type HasModifierCallback = {
  onModifierChanged(modifier: ReactiveModifier, _new: number, old: number): void;
};

export interface ReactiveRoot {
  onQueryEnabled: (query: BSIQuery) => unknown;
  onQueryDisabled: (query: BSIQuery) => unknown;
}

export type HasProfileCallback = {
  onProfileChanged: (modifier: ReactiveProfileT, _new: boolean, old: boolean) => unknown;
};
export type HasRuleCallback = {
  onRuleChanged: (modifier: ReactiveRuleT, _new: boolean, old: boolean) => unknown;
};
