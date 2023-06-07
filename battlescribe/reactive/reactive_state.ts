import { addObj } from "../bs_helpers";
import { getStaticFilters, Base, BSIExtraConstraint } from "../bs_main";
import type {
  BSIConstraint,
  BSIModifier,
  BSIModifierGroup,
  BSIProfile,
  BSIQuery,
  BSICost,
  BSIRule,
  BSIInfoLink,
  BSIInfoGroup,
} from "../bs_types";
import { makeReactiveInfo, ReactiveProfileT, ReactiveRuleT } from "./reactive_info";
import {
  ReactiveModifier,
  makeReactiveModifiers,
  modify,
  ReactiveConstraint,
  ReactiveExtraConstraint,
  makeReactiveConstraints,
  reactiveExtraConstraint,
  reactiveConstraint,
  resetInstanceOfConditions,
  ReactiveConditionGroup,
  ReactiveCondition,
  ReactiveModifierGroup,
  ReactiveRepeat,
} from "./reactive_modifiers";
import { BSNodeScope } from "./reactive_scope";
import {
  HasProfileCallback,
  HasRuleCallback,
  HasConstraintCallback,
  QueryReactive,
  HasExtraConstraintCallback,
} from "./reactive_types";
import { conditionToString, modifierToString } from "../bs_modifiers";

if (typeof $set === "undefined") {
  globalThis.$set = function (o, k, v) {
    o[k] = v;
  };
}
if (typeof $delete === "undefined") {
  globalThis.$delete = function (o, k) {
    delete o[k];
  };
}
function getType(source: Base) {
  if (source.isForce()) return "force";
  if (source.isGroup()) return "group";
  if (source.isEntry()) return "entry";
  return "other";
}
export interface BSNodeStateEvents {
  primaryChanged(newPrimary: string, oldPrimary: string): unknown;
  categoryAdded(newCategory: string): unknown;
  categoryRemoved(oldCategory: string): unknown;

  hiddenChanged(newHidden: boolean, oldHidden: boolean): unknown;
  amountChanged(): unknown;
  costsChanged(): unknown;
  constraintsChanged(): unknown;
  infoChanged(): unknown;
}

/** Contains all (up to date) state for a BS Node
 *  Except associations
 */
export class BSNodeState
  implements HasConstraintCallback, HasRuleCallback, HasProfileCallback, HasExtraConstraintCallback
{
  source: Base;
  scope!: BSNodeScope;
  parent?: BSNodeState;

  // Static
  ids: Set<string>;
  index: Record<string, any>;
  modifiers: Record<string, ReactiveModifier[]>;
  modifiersQueries?: QueryReactive[];
  uid: string;

  // Reactive
  hidden: boolean;
  name: string;
  page: string;
  primary?: string;
  selections: number;
  categories: Set<string>;

  constraints: Record<string, ReactiveConstraint>;
  extraConstraints: Record<string, ReactiveExtraConstraint>;
  costs: Record<string, number>;
  totalCosts: Record<string, number>;

  rules: Array<ReactiveRuleT>;
  profiles: Array<ReactiveProfileT>;
  infoQueries?: QueryReactive[];

  // [founsQueries, Rule&ProfileIds]
  extraInfo?: Record<string, [Array<QueryReactive>, Set<string>]>;
  infoInitialized?: boolean;
  extraRules: Array<ReactiveRuleT>;
  extraProfiles: Array<ReactiveProfileT>;
  events?: BSNodeStateEvents;
  debugleaks = 0;
  propagate: boolean;
  get [Symbol.toStringTag](): string {
    return "ObjectNoObserve";
  }
  /**
   *
   * @param source The source node
   * @param uid unique node id
   * @param parent The parent State
   * @param init Indicate that the state should be static, increasing performance by not inisializing reactive stuff
   * @param events primaryChanged
   */
  constructor(
    source: Base,
    uid: string,
    parent?: BSNodeState,
    init?: boolean,
    propagate?: boolean,
    events?: BSNodeStateEvents
  ) {
    this.source = source;
    this.uid = uid;
    this.parent = parent;
    this.events = events;

    this.name = source.getName();
    this.hidden = source.getHidden() || false;
    this.page = source.getPage() || "";
    this.ids = new Set(getStaticFilters(source));
    if (parent?.source.isCategory()) {
      this.primary = "(No Category)";
    }

    this.index = {};
    this.constraints = {};
    this.extraConstraints = {};
    this.costs = {};
    this.totalCosts = {};
    this.rules = [];
    this.profiles = [];
    this.extraRules = [];
    this.extraProfiles = [];
    this.modifiers = {};
    this.categories = new Set();
    this.selections = 0;
    this.propagate = propagate !== false;

    if (!source.isForce()) {
      const parentIsCategory = this.parent?.source.isCategory();
      for (const category of source.categoryLinksIterator()) {
        this.setDefault(category.targetId, category.target);
        if (category.primary && parentIsCategory) {
          this.setDefault("primary", category.target);
        } else {
          this.categories.add(category.targetId);
        }
      }
      if (parentIsCategory) {
        this.primary = this.parent!.source.getId();
      }
    }
    if (init) {
      this.scope = new BSNodeScope(getType(source), uid, this.parent?.scope, this);
      this.scope.updateMultipliers(1, 0);

      const costScope = this.source.isCategory() ? this.find("force")!.scope : this.scope;
      costScope.addlistener("costType", this.uid, (c: any) => this.onCostTypeAdded(c));

      for (const cost of source.getCosts()) {
        this.setDefault(cost.typeId, cost);
        this.costs[cost.typeId] = cost.value;
        this.onCostTypeAdded(cost.typeId);
      }

      this.scope.updateFilters(this.getFilters());
      this.scope.updateCostFilters(this.getCostFilters());
      this.scope.updateCategories(this.getCategories());
      this.scope.updateCostCategories(this.getCostCategories());
      this.scope.updateCosts(this.costs);
      this.enable();
    } else {
      for (const cost of source.getCosts()) {
        this.costs[cost.typeId] = cost.value;
      }
    }
  }
  initializeInfo(): void {
    if (this.infoInitialized) return;
    this.infoInitialized = true;
    this.addInfo(
      this.source.infoRulesIterator(),
      this.source.infoProfilesIterator(),
      this.source.infoLinksIterator(),
      this.source.infoGroupsIterator()
    );
    return;
  }
  forEachParentGroups(cb: (group: BSNodeState) => unknown) {
    let parent = this.parent;
    while (parent) {
      if (parent.source.isGroup()) {
        cb(parent);
      } else {
        break;
      }
      parent = parent.parent;
    }
  }
  forEachParent(cb: (parent: BSNodeState) => unknown) {
    let current = this.parent;
    while (current) {
      if (!current || cb(current) === false) {
        break;
      }
      current = current.parent;
    }
  }
  getCategories(): Set<string> {
    const result = new Set<string>(this.categories);
    if (this.primary) result.add(this.primary);
    if (this.source.isQuantifiable()) {
      this.forEachParentGroups((group) => {
        group.categories.forEach(result.add, result);
      });
    }
    return result;
  }
  getCostCategories(): Set<string> {
    const result = new Set<string>(this.categories);
    if (this.primary) result.add(this.primary);
    if (this.source.isQuantifiable()) {
      this.forEachParent((group) => {
        if (group.source.isGroup() || group.source.isEntry()) {
          group.categories.forEach(result.add, result);
          if (group.primary) result.add(group.primary);
        }
      });
    }
    return result;
  }
  getFilters(): Set<string> {
    const result = new Set<string>(this.ids);
    if (this.source.isQuantifiable()) {
      this.forEachParentGroups((group) => {
        group.ids.forEach(result.add, result);
      });
    }
    const parent = this.getParent();
    if (parent?.source.isCategory()) {
      const force = this.findParent((o) => o.source.isForce());
      force?.ids.forEach(result.add, result);
    }
    if (this.source.isForce()) {
      result.add(this.source.main_catalogue.id);
    }
    return result;
  }
  getCostFilters(): Set<string> {
    const result = this.getFilters();
    const entry = this.findParent((o) => o.source.isEntry());
    if (entry) {
      const source = entry.source;
      result.add(source.id);
      if (source.isLink()) result.add(source.targetId);
    }
    return result;
  }
  getParent() {
    return this.parent;
  }
  setParent(newParent: BSNodeState) {
    if (this.parent !== newParent) {
      this.disable();
      const previousAmount = this.scope.propagateAmount;
      if (this.scope) {
        this.scope.updateMultipliers(this.scope.amount, 0);
      }
      this.parent = newParent;
      this.scope.parent = this.parent.scope;
      this.onCategoriesChanged();
      this.enable();
      if (this.scope) {
        this.scope.updateFilters(this.getFilters());
        this.scope.updateCostFilters(this.getCostFilters());
        this.scope.updateMultipliers(this.scope.amount, previousAmount);
      }
    }
  }
  findParent(fn: (p: BSNodeState) => any): BSNodeState | undefined {
    let current = this.parent;
    while (current) {
      if (fn(current)) return current;
      current = current.parent;
    }
  }
  find(scope: string, shared?: boolean, extra?: boolean): BSNodeState | undefined {
    if (shared === false) {
      // not Shared just seems to ignore scope? lol
      switch (scope) {
        case "parent":
        case "force":
        case "primary-catalogue":
        case "primary-category":
          // return self.isGroup() ? [self] : [];
          return this.source.isGroup() ? this : this.parent;
        case "self":
        case "roster":
        default:
          // Return same behaviour as share === true
          break;
      }
    }
    switch (scope) {
      case "self":
        return this;
      case "parent":
        return extra ? this : this.findParent((o) => o.source.isRoster() || o.source.isEntry());
      case "primary-category":
        return this.source.isCategory() ? this : this.findParent((o) => o.source.isCategory());
      case "force":
      case "primary-catalogue":
        return this.source.isForce() ? this : this.findParent((o) => o.source.isForce());
      case "roster":
        return this.source.isRoster() ? this : this.findParent((o) => !o.parent);
      case "ancestor": {
        const result = [] as any;
        let current = this as BSNodeState | undefined;
        while (current) {
          result.push(current);
          current = current.parent;
        }
        return result;
      }
      default: /**{Any ID}**/ {
        const source = this.source;
        if (source.isLink() ? source.id === scope || source.targetId === scope : source.id === scope) {
          return this;
        }
        return this.findParent((o) =>
          o.source.isLink() ? o.source.id === scope || o.source.targetId === scope : o.source.id === scope
        );
      }
    }
  }
  setDefault(id: string, value: any) {
    this.index[id] = value;
  }
  getDefault(id: string) {
    return this.index[id].value;
  }
  listen(obj: QueryReactive, query: BSIQuery, extra = false) {
    const scopes = this.find(query.scope, query.shared, extra);
    if (!scopes) {
      // console.warn(
      //   `Couldn't find scope ${fieldToText(this.source, query.scope)}(${
      //     query.scope
      //   }) from ${this.source.getName()}, query:`,
      //   query
      // );
      return;
    }

    for (const { scope } of Array.isArray(scopes) ? (scopes as BSNodeState[]) : [scopes]) {
      scope.listen(query, (n, o) => obj.queryChanged(n, o), obj);
      this.debugleaks += 1;
    }
  }
  unlisten(obj: QueryReactive, query: BSIQuery, extra = false) {
    const scopes = this.find(query.scope, query.shared, extra);
    if (!scopes) return;
    if (Array.isArray(scopes)) {
      for (const { scope } of scopes) {
        scope.unlisten(query, obj);
        this.debugleaks -= 1;
      }
    } else {
      scopes.scope.unlisten(query, obj);
      this.debugleaks -= 1;
    }
  }
  disable() {
    if (this.modifiersQueries) {
      for (const query of this.modifiersQueries) {
        this.unlisten(query, query.source);
        resetInstanceOfConditions(query);
      }
    }
    if (this.infoQueries) {
      for (const query of this.infoQueries) {
        this.unlisten(query, query.source);
        resetInstanceOfConditions(query);
      }
    }
    if (this.constraints) {
      for (const id in this.constraints) {
        const query = this.constraints[id];
        this.unlisten(query, {
          ...query.source,
          childId: query.source.shared === false && !this.source.isCategory() ? this.source.id : this.source.getId(),
        });
      }
    }
    if (this.extraConstraints) {
      for (const id in this.extraConstraints) {
        const constraint = this.extraConstraints[id];
        this.unlisten(constraint, constraint.source, true);
        for (const query of constraint.queries || []) {
          this.unlisten(query, query.source, true);
          resetInstanceOfConditions(query);
        }
      }
    }
    if (this.extraInfo) {
      for (const key in this.extraInfo) {
        const [foundQueries] = this.extraInfo[key];
        for (const query of foundQueries) {
          this.unlisten(query, query.source);
        }
      }
    }
    if (this.source.isQuantifiable()) {
      this.forEachParentGroups((group) => {
        group.scope.removelistener("categories", "categories" + this.uid);
      });
      const entry = this.findParent((o) => o.source.isEntry());
      entry?.scope.removelistener("categories", "categories" + this.uid);
    }
    if (this.source.isGroup()) {
      this.scope.removelistener("::selections::any", "selections" + this.uid);
    }
    if (this.source.isCategory()) {
      this.parent?.scope.removelistener(`s::selections::${this.source.getId()}`, "selections" + this.uid);
    }
    if (this.debugleaks) {
      console.error(`${this.name} leaked queries: ${this.debugleaks}`);
    }
  }
  enable() {
    if (this.modifiersQueries) {
      for (const query of this.modifiersQueries) {
        this.listen(query, query.source);
      }
    }
    if (this.infoQueries) {
      for (const query of this.infoQueries) {
        this.listen(query, query.source);
      }
    }
    if (this.constraints) {
      for (const id in this.constraints) {
        const query = this.constraints[id];
        this.listen(query, {
          ...query.source,
          childId: query.source.shared === false && !this.source.isCategory() ? this.source.id : this.source.getId(),
        });
      }
    }
    if (this.extraConstraints) {
      for (const id in this.extraConstraints) {
        const query = this.extraConstraints[id];
        this.listen(query, query.source, true);
        for (const query2 of query.queries || []) {
          this.listen(query2, query2.source, true);
        }
      }
    }
    if (this.extraInfo) {
      for (const key in this.extraInfo) {
        const [foundQueries] = this.extraInfo[key];
        for (const query of foundQueries) {
          this.listen(query, query.source);
        }
      }
    }
    if (this.source.isQuantifiable()) {
      this.forEachParentGroups((group) => {
        group.scope.addlistener("categories", "categories" + this.uid, () => this.onCategoriesChanged());
      });
      const entry = this.findParent((o) => o.source.isEntry());
      entry?.scope.addlistener("categories", "categories" + this.uid, () => this.onCategoriesChanged());
    }
    if (this.source.isGroup()) {
      this.scope.addlistener("::selections::any", "selections" + this.uid, (n) => this.onGroupSelectionsChanged(n));
    }
    if (this.source.isCategory()) {
      this.parent?.scope.addlistener(`s::selections::${this.source.getId()}`, "selections" + this.uid, (n) =>
        this.onGroupSelectionsChanged(n)
      );
    }
  }
  addModifiers(modifiers: Iterable<BSIModifier>, modifierGroups: Iterable<BSIModifierGroup>) {
    const { foundModifiers, foundQueries } = makeReactiveModifiers(this, modifiers, modifierGroups);
    for (const modifier of foundModifiers) {
      const type = modifier.source.type;
      if (type === "unset-primary" || type === "set-primary") {
        addObj(this.modifiers, "primary", modifier);
      } else if (modifier.source.field === "category") {
        addObj(this.modifiers, modifier.source.value as string, modifier);
      } else {
        addObj(this.modifiers, modifier.source.field, modifier);
      }
      modifier.setCallback(this, true);
    }
    for (const query of foundQueries) {
      this.listen(query, query.source);
    }
    this.modifiersQueries = foundQueries;
  }
  addConstraints(constraints: Iterable<BSIConstraint>) {
    const { foundConstraints, foundQueries } = makeReactiveConstraints(this, constraints);
    for (const reactive of foundConstraints) {
      $set(this.constraints, reactive.source.id, reactive);
    }
    for (const query of foundQueries) {
      this.listen(query, {
        ...query.source,
        childId: query.source.shared === false && !this.source.isCategory() ? this.source.id : this.source.getId(),
      });
    }
  }
  addExtraConstraints(constraints: Iterable<BSIExtraConstraint>) {
    for (const constraint of constraints) {
      const id = `${constraint.id}::${constraint.childId}`;
      if (id in this.extraConstraints) continue;
      const foundQueries = [] as QueryReactive[];
      const reactive = reactiveExtraConstraint(this, constraint, foundQueries);
      $set(this.extraConstraints, id, reactive);
      this.listen(reactive, reactive.source, true);
      for (const query of foundQueries) {
        this.listen(query, query.source, true);
      }
    }
  }
  removeExtraConstraints(constraints: Iterable<BSIExtraConstraint>) {
    for (const constraint of constraints) {
      const reactive = this.extraConstraints[constraint.id];
      if (!reactive) {
        console.log("tried to delete non existent constraint in", this.name, constraint.id, "perhaps duplicate?");
        continue;
      }
      $delete(this.extraConstraints, constraint.id);
      this.unlisten(reactive, reactive.source, true);
      for (const query2 of reactive.queries || []) {
        this.unlisten(query2, query2.source);
      }
    }
  }
  addInfo(
    rules?: Iterable<BSIRule>,
    profiles?: Iterable<BSIProfile>,
    links?: Iterable<BSIInfoLink>,
    groups?: Iterable<BSIInfoGroup>
  ) {
    const { foundProfiles, foundRules, foundQueries } = makeReactiveInfo(this, rules, profiles, links, groups);
    for (const query of foundQueries) {
      this.listen(query, query.source);
    }
    this.rules.push(...foundRules);
    this.profiles.push(...foundProfiles);
  }
  addExtraInfo(
    id: string,
    rules?: Iterable<BSIRule>,
    profiles?: Iterable<BSIProfile>,
    links?: Iterable<BSIInfoLink>,
    groups?: Iterable<BSIInfoGroup>
  ) {
    const { foundProfiles, foundRules, foundQueries } = makeReactiveInfo(this, rules, profiles, links, groups);
    if (foundProfiles.length || foundRules.length) {
      this.extraRules = [];
      this.extraProfiles = [];
      if (!this.extraInfo) this.extraInfo = {};
      for (const query of foundQueries) {
        this.listen(query, query.source);
      }
      const ids = new Set<string>();
      for (const rule of foundRules) {
        this.extraRules.push(rule);
        ids.add(rule.source.id);
      }
      for (const profile of foundProfiles) {
        this.extraProfiles.push(profile);
        ids.add(profile.source.id);
      }
      this.extraInfo[id] = [foundQueries, ids];
    }
  }
  removeExtraInfo(id: string) {
    if (!this.extraInfo || !(id in this.extraInfo)) return;
    const [foundQueries, ids] = this.extraInfo[id];
    for (const query of foundQueries) {
      this.unlisten(query, query.source);
    }

    this.extraProfiles = this.extraProfiles.filter((o) => !ids.has(o.source.id));
    this.extraRules = this.extraRules.filter((o) => !ids.has(o.source.id));
  }

  onModifierChanged(modifier: ReactiveModifier) {
    const field = modifier.source.field;
    switch (field) {
      case "name":
        this.name = modify(this.source.getName(), this.modifiers!.name);
        break;
      case "page":
        this.page = modify(this.source.getPage(), this.modifiers.page);
        break;
      case "hidden":
        const previous = this.hidden;
        this.hidden = modify(this.source.getHidden() || false, this.modifiers.hidden);
        if (this.hidden !== previous) {
          this.onHiddenChanged();
        }
        break;
      case "category":
        const category = modifier.source.value as string;
        switch (modifier.source.type) {
          case "set-primary":
          case "unset-primary":
            const previousPrimary = this.primary;
            if (previousPrimary) {
              // If primary is undefined, it likely means this option cannot have a primary, otherwise it would have a default value

              this.primary = modify(this.source.getPrimaryCategory(), this.modifiers.primary);
              if (previousPrimary !== this.primary) {
                this.onCategoriesChanged();
                if (this.events?.primaryChanged) {
                  this.events.primaryChanged(this.primary!, previousPrimary);
                }
              }
            }
            break;
          default:
            const status = modify(category in this.index, this.modifiers[category]);
            status ? this.categories.add(category) : this.categories.delete(category);
            this.onCategoriesChanged();
            break;
        }
        break;
      default:
        if (field in this.constraints) {
          const constraint = this.constraints[field];
          constraint.valueChanged(modify(constraint.source.value, this.modifiers[field]));
        } //
        else if (field in this.costs) {
          $set(this.costs, field, modify(this.getDefault(field), this.modifiers[field]));
          this.onCostChanged(field);
        }
    }
  }
  /* eslint-disable @typescript-eslint/no-unused-vars */
  onProfileChanged(_modifier: ReactiveProfileT, _new: boolean, _old: boolean) {
    if (this.events?.infoChanged) {
      this.events.infoChanged();
    }
  }
  onRuleChanged(_modifier: ReactiveRuleT, _new: boolean, _old: boolean) {
    if (this.events?.infoChanged) {
      this.events.infoChanged();
    }
  }
  onConstraintChanged() {
    if (this.events?.constraintsChanged) {
      this.events.constraintsChanged();
    }
  }
  onExtraConstraintChanged(_constraint: ReactiveExtraConstraint, _new: boolean, _old: boolean): void {
    if (this.events?.constraintsChanged) {
      this.events.constraintsChanged();
    }
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
  onHiddenChanged() {
    if (this.events?.hiddenChanged) {
      this.events.hiddenChanged(this.hidden, !this.hidden);
    }
  }
  onCategoriesChanged() {
    const [addeds, removeds] = this.scope.updateFilters(this.getFilters());
    this.scope.updateCostFilters(this.getCostFilters());
    this.scope.updateCategories(this.getCategories());
    this.scope.updateCostCategories(this.getCostCategories());
    if (this.events?.categoryAdded) {
      for (const added of addeds) {
        this.events.categoryAdded(added);
      }
    }
    if (this.events?.categoryRemoved) {
      for (const removed of removeds) {
        this.events.categoryRemoved(removed);
      }
    }
    this.scope.getQueue().empty();
  }
  onCostTypeAdded(cost: string) {
    const uid = `${this.uid}::${cost}`;
    if (this.source.isCategory()) {
      const scope = this.parent!.scope;
      const hash = `s::${cost}::${this.source.getId()}`;
      scope?.addlistener(hash, uid, () => this.onTotalCostChanged(cost));
    } else {
      const scope = this.scope;
      const hash = `sf::${cost}::any`;
      scope.addlistener(hash, uid, () => this.onTotalCostChanged(cost));
    }
    this.onTotalCostChanged(cost);
  }
  onTotalCostChanged(cost: string) {
    if (this.source.isCategory()) {
      const force = this.find("force") as BSNodeState;
      const total = force.scope.index[`s::${cost}::${this.source.getId()}`];
      total ? $set(this.totalCosts, cost, total) : $delete(this.totalCosts, cost);
    } else {
      const selfcost = (this.costs[cost] || 0) * this.scope.amount;
      const childcost = (this.scope.index[`sf::${cost}::any`] || 0) * this.scope.amount;
      $set(this.totalCosts, cost, selfcost + childcost);
    }
    if (this.events?.costsChanged) {
      this.events.costsChanged();
    }
  }
  onCostChanged(cost: string) {
    this.scope.updateCost(cost, this.costs[cost]);
    this.onTotalCostChanged(cost);
  }
  onGroupSelectionsChanged(new_selections: number) {
    this.selections = new_selections;
    if (this.events?.amountChanged) {
      this.events?.amountChanged();
    }
  }

  setSelections(amount: number) {
    this.selections = amount;
    const fixedAmount = this.source.isGroup() ? 0 : Math.max(this.selections, 1);
    this.scope.updateMultipliers(fixedAmount, this.propagate ? this.selections : 0);
    this.scope.getQueue().empty();
    for (const cost of this.scope.costTypes) {
      this.onCostTypeAdded(cost);
    }
    for (const cost in this.totalCosts) {
      this.onTotalCostChanged(cost);
    }
    if (this.events?.amountChanged) {
      this.events?.amountChanged();
    }
  }
  setCosts(costs: Record<string, number>) {
    this.costs = costs;
    for (const cost in this.scope.updateCosts(this.costs)) {
      this.onTotalCostChanged(cost);
    }
    this.scope.getQueue().empty();
  }
  setMaxCosts(costs: BSICost[]) {
    for (const cost of costs) {
      const id = `max::${cost.typeId}::${cost.name}`;
      const infinite = cost.value === undefined || cost.value === null || cost.value < 0;
      this.scope.set(`limit::${cost.typeId}`, infinite ? -1 : cost.value);
      if (infinite) {
        if (id in this.constraints) {
          const constraint = this.constraints[id];
          $delete(this.constraints, id);
          this.unlisten(constraint, constraint.source);
          this.debugleaks += 1;
        }
        continue;
      }

      if (id in this.constraints) {
        this.constraints[id].valueChanged(cost.value);
      } else {
        const constraint: BSIConstraint = {
          field: cost.typeId,
          type: "max",
          value: cost.value === undefined ? -1 : cost.value,
          id: id,
          scope: "roster",
          childId: "any",
          includeChildForces: true,
          includeChildSelections: true,
        };
        const reactive = reactiveConstraint(constraint, this);
        $set(this.constraints, reactive.source.id, reactive);
        this.listen(reactive, reactive.source);
        this.debugleaks -= 1;
      }
    }
    this.scope.getQueue().empty();
    if (this.events?.constraintsChanged) {
      this.events.constraintsChanged();
    }
  }

  print_constraints(f?: (c: ReactiveConstraint) => any) {
    for (const constraint of Object.values(this.constraints)) {
      if (f && !f(constraint)) continue;
      this.print_cond(constraint, 0);
    }
  }
  print_extra_constraints(f?: (c: ReactiveExtraConstraint) => any) {
    for (const constraint of Object.values(this.extraConstraints)) {
      if (f && !f(constraint)) continue;
      this.print_cond(constraint, 0);
      this.print_modifiers(constraint.reactiveModifiers, 1);
    }
  }
  print_modifiers(input_modifiers?: ReactiveModifier[], depth = 0) {
    if (input_modifiers) {
      for (const modifier of Array.isArray(input_modifiers) ? input_modifiers : [input_modifiers]) {
        this.print_mod(modifier, depth);
      }
    } else {
      for (const modifiers of Object.values(this.modifiers)) {
        for (const modifier of modifiers) this.print_mod(modifier, depth);
      }
    }
  }
  print_cond(o: ReactiveCondition | ReactiveConstraint, depth = 0) {
    const indent = "  ".repeat(depth);
    const isConstraint = ["min", "max"].includes(o.source.type);
    const _default = isConstraint ? ` default=${o.source.value}` : "";
    const src = isConstraint ? { ...o.source, value: (o as any).value } : o.source;
    console.log(`${indent}(${Number(o.computed)}) ${conditionToString(this.source, src)}: found=${o.query}${_default}`);
  }
  print_repeat(o: ReactiveRepeat, depth = 0) {
    const indent = "  ".repeat(depth);
    console.log(
      `${indent}(${Number(o.computed)}) (repeat) for${conditionToString(this.source, o.source)}: found=${o.query}`
    );
  }
  print_cond_group(o: ReactiveConditionGroup, depth = 0) {
    const indent = "  ".repeat(depth);
    const type = o.source.type || "and";
    console.log(`${indent}${type} (${Number(o.computed)})`);

    for (const _cond of o.conditionGroups || []) this.print_cond_group(_cond, depth + 1);
    for (const _cond of o.conditions || []) this.print_cond(_cond, depth + 1);

    console.log(`${indent}|${type}`);
  }
  print_mod(o: ReactiveModifier, depth = 0) {
    const indent = "  ".repeat(depth);
    console.log(`${indent}(${Number(o.computed)}) ${modifierToString(this.source, o.source)}`);

    for (const _cond of o.conditionGroups || []) this.print_cond_group(_cond, depth + 1);
    for (const _cond of o.conditions || []) this.print_cond(_cond, depth + 1);
    for (const _cond of o.repeats || []) this.print_repeat(_cond, depth + 1);
    if (o.parent) {
      this.print_cond_group(o.parent as any, depth + 1);
    }
  }
  print_mod_group(o: ReactiveModifierGroup, depth = 0, modifiers = true) {
    const indent = "  ".repeat(depth);
    console.log(`${indent}modifier group`);

    for (const _cond of (modifiers && o.modifierGroups) || []) this.print_mod_group(_cond, depth + 1);
    for (const _cond of (modifiers && o.modifiers) || []) this.print_mod(_cond, depth + 1);
    for (const _cond of o.conditionGroups || []) this.print_cond_group(_cond, depth + 1);
    for (const _cond of o.conditions || []) this.print_cond(_cond, depth + 1);
    for (const _cond of o.repeats || []) this.print_repeat(_cond, depth + 1);
    if (o.parent) {
      this.print_cond_group(o.parent as any, depth + 1);
    }
    console.log(`${indent}|modifier group`);
  }
  print_profiles(input_profiles?: ReactiveProfileT[], depth = 0) {
    this.initializeInfo();
    const indent = "  ".repeat(depth);
    if (input_profiles && !Array.isArray(input_profiles)) {
      input_profiles = [input_profiles];
    }

    for (const o of input_profiles || this.profiles) {
      const source = o.source as any;
      console.log(`${indent}${source.typeName || source.target.typeName}/${o.fields.name} (${Number(o.computed)})`);
      for (const _cond of o.modifierGroups || []) this.print_mod_group(_cond, depth + 1);
      for (const _cond of o.modifiers || []) this.print_mod(_cond, depth + 1);
    }
  }
}

function isIterable(obj: any) {
  // checks for null and undefined
  if (obj == null) {
    return false;
  }
  return typeof obj[Symbol.iterator] === "function";
}

(globalThis as any).$translate = (obj: any) => {
  const src = $debugOption.source;
  const result = {} as Record<string, any>;
  function translates(s: string): string {
    if (s.includes("::")) {
      const joined = s
        .split("::")
        .map((o) => translates(o))
        .join("::");
      return joined;
    }
    const f = src.catalogue?.findOptionById(s) || $debugOption.getParentRoster().source.findOptionById(s);
    let name = f?.getName ? f.getName() : f?.name || s;
    if (f?.isLink && f.isLink()) name += " (link)";
    return name.trim();
  }

  if (typeof obj === "string") {
    return translates(obj);
  }

  if (isIterable(obj)) {
    return [...obj].map((o) => translates(o));
  }
  for (const k in obj) {
    result[translates(k)] = obj[k];
  }
  return result;
};
