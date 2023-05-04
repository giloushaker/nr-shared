import { getCondition, getConditionPercent } from "../bs_condition";
import { getRepeat } from "../bs_condition";
import type { BSIExtraConstraint } from "../bs_main";
import type {
  BSICondition,
  BSIConditionGroup,
  BSIConstraint,
  BSIModifier,
  BSIModifierGroup,
  BSIQuery,
  BSIRepeat,
} from "../bs_types";
import {
  conditionsEnabled,
  numConditions,
  setConditionsEnabled,
  modifiersEnabledTimes,
  setChildsEnabled,
} from "./reactive_helpers";
import type {
  QueryReactive,
  ParentCondition,
  ParentRepeat,
  ParentModifier,
  HasConstraintCallback,
  ParentTotal,
  HasModifierCallback,
  HasExtraConstraintCallback,
} from "./reactive_types";

interface MakeReactiveModifiersResult {
  foundQueries: QueryReactive[];
  foundModifiers: ReactiveModifier[];
}
interface MakeReactiveConstraintsResult {
  foundQueries: QueryReactive[];
  foundConstraints: ReactiveConstraint[];
}
export function resetInstanceOfConditions(query: QueryReactive) {
  if (query.source.field === "instanceOf" || query.source.field === "notInstanceOf") {
    (query as ReactiveCondition).query = 0;
  }
}
export class ReactiveCondition implements QueryReactive, ParentTotal {
  source: BSICondition;
  parent?: ParentCondition;
  computed: boolean;
  enabled: boolean;
  query: number;

  total?: number;
  totalQuery?: ReactiveTotalQuery;
  constructor(condition: BSICondition, parent?: ParentCondition) {
    this.source = condition;
    this.parent = parent;
    this.enabled = conditionsEnabled(parent);
    this.query = 0;
    if (condition.percentValue) {
      this.total = 0;
    }
    this.computed = false;
  }
  totalChanged(_new: number): void {
    this.total = _new;
    this.update();
  }
  setEnabled(_new: boolean) {
    this.enabled = _new;
    this.update();
  }
  queryChanged(_new: number, _old?: number) {
    if (this.source.scope === "ancestor") {
      this.query! += _new - _old!;
    } else {
      this.query = _new;
    }
    this.update();
  }
  compute(): boolean {
    if (!this.enabled) return false;
    if (this.source.percentValue) {
      return getConditionPercent(this.source.type, this.source.value, this.query, this.total!);
    } else {
      return getCondition(this.source.type!, this.query, this.source.value, this.source.scope);
    }
  }
  update() {
    const old = this.computed;
    this.computed = this.compute();
    if (old !== this.computed) {
      if (this.parent) {
        this.parent.conditionsChanged(this.computed, old);
      }
    }
  }
}

export class ReactiveConditionGroup {
  conditions?: ReactiveCondition[];
  conditionGroups?: ReactiveConditionGroup[];

  source: BSIConditionGroup;
  enabled: boolean;
  parent?: ParentCondition;
  truthyConditions: number;
  status: boolean;
  computed!: boolean;
  constructor(group: BSIConditionGroup, parent?: ParentCondition) {
    this.source = group;
    this.enabled = conditionsEnabled(parent);
    this.parent = parent;
    this.truthyConditions = 0;
    this.status = 0 === numConditions(group);
    this.computed = false;
  }
  setEnabled(_new: boolean) {
    this.enabled = _new;
    setConditionsEnabled(this, _new);
    this.update();
  }
  conditionsChanged(_new: boolean, old: boolean) {
    if (_new && !old) ++this.truthyConditions;
    if (!_new && old) --this.truthyConditions;
    if (this.source.type === "or") {
      this.status = this.truthyConditions > 0;
    } else {
      this.status = this.truthyConditions === numConditions(this.source);
    }
    this.update();
  }
  compute(): boolean {
    return this.enabled && this.status;
  }
  update() {
    const old = this.computed;
    this.computed = this.compute();
    if (old !== this.computed) {
      if (this.parent) {
        this.parent.conditionsChanged(this.computed, old);
      }
    }
  }
  conditionsEnabled(): boolean {
    return this.enabled;
  }
}

export class ReactiveModifier implements ParentRepeat, ParentCondition {
  conditions?: ReactiveCondition[];
  conditionGroups?: ReactiveConditionGroup[];
  repeats?: ReactiveRepeat[];

  source: BSIModifier;
  enabled: number;
  activeConditions: number;
  status: boolean;
  repeat: number;
  computed!: number;
  instance?: HasModifierCallback;

  queries?: QueryReactive[];
  parent?: ParentModifier;
  constructor(modifier: BSIModifier, parent?: ParentModifier) {
    this.source = modifier;
    this.enabled = modifiersEnabledTimes(parent);
    this.activeConditions = 0;
    this.status = 0 === numConditions(modifier);
    this.repeat = 0;
    this.computed = 0;
    this.parent = parent;
  }
  setEnabled(_new: number) {
    this.enabled = _new;
    setConditionsEnabled(this, _new > 0);
    this.update();
  }
  conditionsChanged(_new: boolean, old: boolean) {
    if (_new && !old) ++this.activeConditions;
    if (!_new && old) --this.activeConditions;
    this.status = this.activeConditions === numConditions(this.source);
    this.update();
  }
  repeatChanged(_new: number, old: number) {
    this.repeat += _new - old;
    this.update();
  }
  conditionsEnabled(): boolean {
    return this.enabled as any;
  }
  compute(): number {
    if (this.status) {
      return (this.repeats?.length ? this.repeat : 1) * this.enabled;
    }
    return 0;
  }
  update() {
    const old = this.computed;
    this.computed = this.compute();
    if (old !== this.computed) {
      this.instance?.onModifierChanged(this, this.computed, old);
    }
  }
  setCallback(instance: HasModifierCallback, immediate = false) {
    this.instance = instance;
    if (immediate && this.computed) {
      this.instance?.onModifierChanged(this, this.computed, 0);
    }
  }
}
export class ReactiveModifierGroup implements ParentModifier, ParentRepeat, ParentCondition {
  conditions?: ReactiveCondition[];
  conditionGroups?: ReactiveConditionGroup[];
  modifiers?: ReactiveModifier[];
  modifierGroups?: ReactiveModifierGroup[];
  repeats?: ReactiveRepeat[];

  source: BSIModifierGroup;
  enabled: number;
  truthyConditions: number;
  status: boolean;
  repeat: number;
  computed!: number;

  queries?: QueryReactive[];
  parent?: ParentModifier;
  constructor(group: BSIModifierGroup, parent?: ParentModifier) {
    this.source = group;
    this.enabled = modifiersEnabledTimes(parent);
    this.truthyConditions = 0;
    this.status = 0 === numConditions(group);
    this.repeat = 0;
    this.parent = parent;
  }

  setEnabled(_new: number) {
    this.enabled = _new;
    setConditionsEnabled(this, _new > 0);
    this.update();
  }
  conditionsChanged(_new: boolean, old: boolean) {
    if (_new && !old) ++this.truthyConditions;
    if (!_new && old) --this.truthyConditions;
    this.status = this.truthyConditions === numConditions(this.source);
    this.update();
  }
  repeatChanged(_new: number, old: number) {
    this.repeat += _new - old;
    this.update();
  }
  modifiersEnabled(): number {
    return this.computed;
  }
  conditionsEnabled(): boolean {
    return this.enabled as any;
  }
  compute(): number {
    if (this.status) {
      return (this.repeats?.length ? this.repeat : 1) * this.enabled;
    }
    return 0;
  }
  update() {
    const old = this.computed;
    this.computed = this.compute();
    if (old !== this.computed) setChildsEnabled(this, this.computed);
  }
}
export class ReactiveRepeat implements QueryReactive, ParentTotal {
  source: BSIRepeat;
  parent?: ParentRepeat;
  enabled: boolean;
  query: number;
  computed: number;
  total?: number;
  totalQuery?: ReactiveTotalQuery;
  constructor(repeat: BSIRepeat, parent?: ParentRepeat) {
    this.source = repeat;
    this.parent = parent;
    this.enabled = conditionsEnabled(parent);
    this.computed = 0;
    this.query = 0;
    if (repeat.percentValue) {
      this.total = 0;
    }
  }
  setEnabled(_new: boolean) {
    this.enabled = _new;
    this.update();
  }
  queryChanged(_new: number) {
    this.query = _new;
    this.update();
  }
  totalChanged(_new: number) {
    this.total = _new;
    this.update();
  }
  compute(): number {
    if (!this.enabled) return 0;
    return getRepeat(this.source, this.query, this.total);
  }
  update() {
    const old = this.computed;
    this.computed = this.compute();
    if (old !== this.computed) {
      if (this.parent) {
        this.parent.repeatChanged(this.computed, old);
      }
    }
  }
}
export class ReactiveConstraint implements QueryReactive, ParentTotal {
  source: BSIConstraint;
  parent?: HasConstraintCallback;
  /** Computed is true when there should be an error */
  computed: boolean;
  value: number;

  query: number;
  total?: number;
  totalQuery?: ReactiveTotalQuery;
  constructor(constraint: BSIConstraint, parent?: HasConstraintCallback) {
    this.source = constraint;
    this.parent = parent;
    this.computed = false;
    this.query = 0;
    this.value = this.source.value;
    if (constraint.percentValue) {
      this.total = 0;
    }
  }
  valueChanged(_new: number) {
    this.value = _new;
    this.update();
  }
  queryChanged(_new: number) {
    this.query = _new;
    this.update();
  }
  totalChanged(_new: number) {
    this.total = _new;
    this.update();
  }
  compute(): boolean {
    return this.source.percentValue
      ? getConditionPercent(this.source.type, this.value, this.query, this.total!)
      : getCondition(this.source.type, this.query, this.value);
  }
  update() {
    const old = this.computed;
    this.computed = this.compute();
    if (old !== this.computed) {
      if (this.parent) {
        this.parent.onConstraintChanged(this, this.computed, old);
      }
    }
  }
}
export class ReactiveExtraConstraint extends ReactiveConstraint implements HasModifierCallback {
  modifiers?: ReactiveModifier[];
  modifierGroups?: ReactiveModifierGroup[];
  reactiveModifiers = [] as ReactiveModifier[];
  parent?: HasConstraintCallback & HasExtraConstraintCallback;
  queries?: QueryReactive[];
  hidden: boolean;
  source!: BSIExtraConstraint;
  constructor(constraint: BSIExtraConstraint, parent?: HasExtraConstraintCallback) {
    super(constraint, parent as any as HasConstraintCallback);
    this.hidden = constraint.parent.getHidden() || false;
  }
  onModifierChanged(modifier: ReactiveModifier): void {
    if (modifier.source.field === this.source.id) {
      this.value = modify(
        this.source.value,
        this.reactiveModifiers.filter((o) => o.source.field === this.source.id)
      );
    }
    if (modifier.source.field === "hidden") {
      this.hidden = modify(
        this.source.parent.getHidden() || false,
        this.reactiveModifiers.filter((o) => o.source.field === "hidden")
      );
    }
    this.update();
  }
  compute(): boolean {
    if (this.hidden) return false;
    return this.source.percentValue
      ? getConditionPercent(this.source.type, this.value, this.query, this.total!)
      : getCondition(this.source.type, this.query, this.value);
  }
  update() {
    const old = this.computed;
    this.computed = this.compute();
    if (old !== this.computed) {
      if (this.parent) {
        this.parent.onExtraConstraintChanged(this, this.computed, old);
      }
    }
  }
}
// export type ReactiveExtraConstraint = ReactiveConstraint<BSIExtraConstraint>;

export class ReactiveTotalQuery {
  source: BSIQuery;
  parent: ParentTotal;
  constructor(source: BSIQuery, parent: ParentTotal) {
    if (source.field.startsWith("limit::")) {
      this.source = {
        scope: "roster",
        field: source.field,
      };
    } else {
      this.source = {
        scope: source.scope,
        field: source.field,
        includeChildSelections: source.includeChildSelections,
        includeChildForces: source.includeChildForces,
        shared: source.shared,
        childId: "any",
      };
    }
    this.parent = parent;
  }
  queryChanged(_new: number) {
    this.parent.totalChanged(_new);
  }
}

export function reactiveCondition(
  condition: BSICondition,
  parent?: ParentCondition,
  foundQueries?: QueryReactive[]
): ReactiveCondition {
  const reactive = new ReactiveCondition(condition, parent);
  if (condition.percentValue) {
    reactive.totalQuery = new ReactiveTotalQuery(condition, reactive);
  }
  if (foundQueries) {
    foundQueries.push(reactive);
    if (reactive.totalQuery) foundQueries.push(reactive.totalQuery);
  }
  reactive.update();
  return reactive;
}
export function reactiveConditionGroup(
  group: BSIConditionGroup,
  parent?: ParentCondition,
  foundQueries?: QueryReactive[],
  foundModifiers?: ReactiveModifier[]
): ReactiveConditionGroup {
  const reactive = new ReactiveConditionGroup(group, parent);
  if (group.conditions) {
    reactive.conditions = group.conditions.map((o) => reactiveCondition(o, reactive, foundQueries));
  }
  if (group.conditionGroups) {
    reactive.conditionGroups = group.conditionGroups.map((o) =>
      reactiveConditionGroup(o, reactive, foundQueries, foundModifiers)
    );
  }
  reactive.update();
  return reactive;
}
export function reactiveModifier(
  modifier: BSIModifier,
  parent?: ParentModifier,
  foundQueries?: QueryReactive[],
  foundModifiers?: ReactiveModifier[]
): ReactiveModifier {
  const reactive = new ReactiveModifier(modifier, parent);
  if (modifier.conditions) {
    reactive.conditions = modifier.conditions.map((o) => reactiveCondition(o, reactive, foundQueries));
  }
  if (modifier.conditionGroups) {
    reactive.conditionGroups = modifier.conditionGroups.map((o) =>
      reactiveConditionGroup(o, reactive, foundQueries, foundModifiers)
    );
  }
  if (modifier.repeats) {
    reactive.repeats = modifier.repeats.map((o) => reactiveRepeat(o, reactive, foundQueries));
  }
  if (foundModifiers) foundModifiers.push(reactive);
  reactive.update();
  return reactive;
}
export function reactiveModifierGroup(
  group: BSIModifierGroup,
  parent?: ParentModifier,
  foundQueries?: QueryReactive[],
  foundModifiers?: ReactiveModifier[]
): ReactiveModifierGroup {
  const reactive = new ReactiveModifierGroup(group, parent);
  if (group.conditions) {
    reactive.conditions = group.conditions.map((o) => reactiveCondition(o, reactive, foundQueries));
  }
  if (group.conditionGroups) {
    reactive.conditionGroups = group.conditionGroups.map((o) =>
      reactiveConditionGroup(o, reactive, foundQueries, foundModifiers)
    );
  }
  if (group.repeats) {
    reactive.repeats = group.repeats.map((o) => reactiveRepeat(o, reactive, foundQueries));
  }
  if (group.modifiers) {
    reactive.modifiers = group.modifiers.map((o) => reactiveModifier(o, reactive, foundQueries, foundModifiers));
  }
  if (group.modifierGroups) {
    reactive.modifierGroups = group.modifierGroups.map((o) =>
      reactiveModifierGroup(o, reactive, foundQueries, foundModifiers)
    );
  }
  reactive.update();
  return reactive;
}
export function reactiveRepeat(
  repeat: BSIRepeat,
  parent?: ParentRepeat,
  foundQueries?: QueryReactive[]
): ReactiveRepeat {
  const reactive = new ReactiveRepeat(repeat, parent);
  if (repeat.percentValue) {
    reactive.totalQuery = new ReactiveTotalQuery(repeat, reactive);
  }
  if (foundQueries) {
    foundQueries.push(reactive);
    if (reactive.totalQuery) foundQueries?.push(reactive.totalQuery);
  }
  reactive.update();
  return reactive;
}
export function modify<T>(_default: T & any, modifiers?: ReactiveModifier[]): T {
  if (!modifiers) return _default;
  for (const reactive of modifiers) {
    if (reactive.computed) {
      const modifier = reactive.source;
      switch (modifier.type) {
        case "set-primary":
          _default = modifier.value;
          break;
        case "unset-primary":
          _default = "(No Category)";
          break;
        case "add":
          _default = true;
          break;
        case "remove":
          _default = false;
          break;
        case "set":
          _default = modifier.value;
          break;
        case "append":
          _default += modifier.value;
          break;
        case "increment":
          _default = (_default || 0) + (modifier.value as number) * reactive.computed;
          break;
        case "decrement":
          _default = (_default || 0) - (modifier.value as number) * reactive.computed;
          break;
      }
    }
  }
  return _default;
}
export function reactiveConstraint(
  constraint: BSIConstraint,
  parent?: HasConstraintCallback,
  foundQueries?: QueryReactive[]
): ReactiveConstraint {
  const reactive = new ReactiveConstraint(constraint, parent);
  if (constraint.percentValue) {
    reactive.totalQuery = new ReactiveTotalQuery(constraint, reactive);
  }
  if (foundQueries) {
    foundQueries.push(reactive);
    if (reactive.totalQuery) foundQueries?.push(reactive.totalQuery);
  }
  reactive.update();
  return reactive;
}

export function makeReactiveModifiers(
  obj: HasModifierCallback,
  modifiers?: Iterable<BSIModifier>,
  modifierGroups?: Iterable<BSIModifierGroup>
) {
  const result = {
    foundQueries: [],
    foundModifiers: [],
  } as MakeReactiveModifiersResult;
  if (modifiers) {
    for (const modifier of modifiers) {
      reactiveModifier(modifier, undefined, result.foundQueries, result.foundModifiers);
    }
  }
  if (modifierGroups) {
    for (const group of modifierGroups) {
      reactiveModifierGroup(group, undefined, result.foundQueries, result.foundModifiers);
    }
  }
  for (const modifier of result.foundModifiers) {
    modifier.setCallback(obj, true);
  }
  return result;
}
export function makeReactiveConstraints(
  obj: HasConstraintCallback,
  constraints?: Iterable<BSIConstraint>
): MakeReactiveConstraintsResult {
  const result = {
    foundQueries: [],
    foundConstraints: [],
  } as MakeReactiveConstraintsResult;
  if (constraints) {
    for (const constraint of constraints) {
      result.foundConstraints.push(reactiveConstraint(constraint, obj, result.foundQueries));
    }
  }
  return result;
}
export function reactiveExtraConstraint(
  obj: HasExtraConstraintCallback,
  constraint: BSIExtraConstraint,
  _foundQueries?: QueryReactive[]
): ReactiveExtraConstraint {
  const reactive = new ReactiveExtraConstraint(constraint, obj);
  const { foundModifiers, foundQueries } = makeReactiveModifiers(
    reactive,
    constraint.modifiers,
    constraint.modifierGroups
  );
  if (constraint.percentValue) {
    reactive.totalQuery = new ReactiveTotalQuery(constraint, reactive);
    foundQueries.push(reactive.totalQuery);
  }
  if (foundQueries) {
    reactive.queries = foundQueries;
  }
  if (_foundQueries) {
    _foundQueries.push(...foundQueries);
  }
  for (const modifier of foundModifiers) {
    reactive.reactiveModifiers.push(modifier);
    modifier.setCallback(reactive, true);
  }
  reactive.update();
  return reactive;
}
