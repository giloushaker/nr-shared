import type { BSNodeState } from "./reactive_state";
import { getRandomKey } from "../../util";
import { setMinus, removePrefix } from "../bs_helpers";

export interface BSNodeScopeQuery {
  field: string;
  childId?: string;
  includeChildSelections?: boolean;
  includeChildForces?: boolean;
  type?: string;
}
export interface HasBSNodeScopeCallback {
  queryChanged(_new: number, old: number): void;
  uid?: string;
}
export type Callback = (_new: number, old: number) => unknown;

function OrZero(n: number | undefined): number {
  return n || 0;
}
function getUid(obj: any): string {
  if (obj.uid) return obj.uid;
  const uid = getRandomKey();
  obj.uid = uid;
  return uid;
}
export class BSEventQueue {
  queue = {} as Record<string, { _this: Callback; _arg1: any; _arg2: any }>;
  busy = false;
  enqueue(id: string, obj: Callback, val: any, old?: any) {
    this.queue[id] = {
      _this: obj,
      _arg1: val,
      _arg2: old,
    };
  }
  first(): string | undefined {
    for (const _key in this.queue) {
      return _key;
    }
  }
  empty() {
    if (this.busy) return;
    this.busy = true;
    let key = this.first();
    while (key) {
      const value = this.queue[key];
      delete this.queue[key];
      value._this(value._arg1, value._arg2);
      const next = this.first();
      if (next === undefined) break;
      key = next;
    }
    this.busy = false;
  }
}

/** Stores query values for a BS Node, & manages events in root with BSEventQueue*/
export class BSNodeScope {
  root: BSNodeScope;
  parent?: BSNodeScope;

  queue?: BSEventQueue;
  index = {} as Record<string, number>;
  listeners = {} as Record<string, Record<string, Callback>>;

  type: string;
  filters = new Set<string>();
  costFilters = new Set<string>();
  categories = new Set<string>();
  costCategories = new Set<string>();
  costs = {} as Record<string, number>;

  costTypes = new Set<string>();
  uid: string;
  amount: number;
  propagateAmount: number;
  state?: BSNodeState;
  constructor(type: "entry" | "force" | "group" | "other", uid: string, parent?: BSNodeScope, state?: BSNodeState) {
    this.state = state;
    this.parent = parent;
    this.type = type;
    this.uid = uid;
    if (parent) {
      this.root = parent.root;
    } else {
      this.root = this;
      this.queue = new BSEventQueue();
    }
    this.root = parent ? parent.root : this;
    this.amount = 0;
    this.propagateAmount = 0;
  }
  get [Symbol.toStringTag](): string {
    // Anything can go here really as long as it's not 'Object'
    return "ObjectNoObserve";
  }
  isGroup() {
    return this.type === "group";
  }
  isForce() {
    return this.type === "force";
  }
  isEntry() {
    return this.type === "entry";
  }
  isUnit() {
    if (!this.isEntry()) return false;
    if (!this.parent) return true;
    return this.parent.type === "other";
  }
  selectionsField() {
    if (this.isEntry()) return "selections";
    if (this.isForce()) return "forces";
    return "";
  }
  getQueue(): BSEventQueue {
    return this.root.queue!;
  }
  prefix(includeChildSelections?: boolean, includeChildForces?: boolean) {
    const vars = includeChildSelections ? (includeChildForces ? "sf" : "s") : includeChildForces ? "f" : "";
    return vars;
  }
  hash(query: BSNodeScopeQuery): string {
    let field;
    if (query.field.startsWith("limit::")) {
      if (query.type === undefined) {
        return query.field;
      }
      field = removePrefix(query.field, "limit::");
    } else {
      field = query.field;
    }
    return `${this.prefix(query.includeChildSelections, query.includeChildForces)}::${field}::${
      query.childId || "self"
    }`;
  }
  /** get value at hash*/
  get(query: BSNodeScopeQuery): number {
    return this.index[this.hash(query)] || 0;
  }

  /** Modify a value at hash with events */
  change(hash: string, diff: number) {
    const exact_old_value = this.index[hash];
    const old_value = exact_old_value || 0;
    const value = old_value + diff;
    if (value !== 0) {
      this.index[hash] = value;
    } else {
      delete this.index[hash];
    }
    this.addEvents(hash, value, old_value);
    return exact_old_value;
  }
  /** Set value at hash with events */
  set(hash: string, value: number) {
    const exact_old_value = this.index[hash];
    const old_value = exact_old_value || 0;
    if (value !== 0) {
      this.index[hash] = value;
    } else {
      delete this.index[hash];
    }
    this.addEvents(hash, value, old_value);
    return exact_old_value;
  }
  addEvents(hash: string, value?: any, old?: any) {
    const listeners = this.listeners[hash];
    const queue = this.getQueue();
    if (listeners) {
      for (const key in listeners) {
        queue.enqueue(key, listeners[key], value, old);
      }
    }
  }
  addEventsAs(hash: string, value: string, id: string) {
    const listeners = this.listeners[hash];
    const queue = this.getQueue();
    if (listeners) {
      for (const key in listeners) {
        queue.enqueue(key + id, listeners[key], value);
      }
    }
  }
  private modifySelections(field: string, of: string, diff: number, directSelection: boolean, directForce: boolean) {
    const part = `::${field}::${of}`;
    if (directSelection && directForce) this.change(part, diff);
    if (directSelection) this.change(`f${part}`, diff);
    if (directForce) this.change(`s${part}`, diff);
    return this.change(`sf${part}`, diff);
  }
  addlistener(hash: string, uid: string, callback: (_new: number, old: number) => unknown) {
    if (hash in this.listeners) {
      this.listeners[hash][uid] = callback;
    } else {
      this.listeners[hash] = { [uid]: callback };
    }
  }
  removelistener(hash: string, id: string): void {
    const found = this.listeners[hash];
    if (found !== undefined) {
      delete found[id];
      if (Object.keys(found).length === 0) {
        delete this.listeners[hash];
      }
    }
  }
  listen(query: BSNodeScopeQuery, callback: (_new: number, old: number) => unknown, uid: string | object): void {
    if (typeof uid !== "string") uid = getUid(uid);
    let hash;
    // includeChildSelections seems to implicitly also mean that includeChildForces is true, (bug in bs)
    if (query.includeChildSelections && !this.isForce()) query.includeChildForces = true;
    if (query.type === "instanceOf" || query.type === "notInstanceOf") {
      // notInstanceOf / instanceOf Query, Change uid to be unique per scope to prevent deduplication with multiple ancestors
      hash = `is::${query.childId}`;
      uid = `${uid}::${this.uid}`;
    } else if (this.isGroup() && !query.childId) {
      hash = this.hash({ field: query.field, childId: "any" });
    } else {
      hash = this.hash(query);
    }
    this.addlistener(hash, uid, callback);
    callback(this.index[hash] || 0, 0);
  }
  unlisten(query: BSNodeScopeQuery, uid: string | object): void {
    if (typeof uid !== "string") uid = getUid(uid);
    if (typeof uid !== "string") uid = getUid(uid);
    if (!query.field) {
      // notInstanceOf / instanceOf Query, Change uid to be unique per scope to prevent deduplication with multiple ancestors
      const hash = `is::${query.childId}`;
      this.removelistener(hash, `${uid}::${this.uid}`);
    } else if (this.isGroup() && !query.childId) {
      const hash = this.hash({ field: query.field, childId: "any" });
      this.removelistener(hash, uid);
    } else {
      const hash = this.hash(query);
      this.removelistener(hash, uid);
    }
  }
  findSelfOrParent(fn: (p: BSNodeScope) => any): BSNodeScope | undefined {
    let current = this as BSNodeScope | undefined;
    while (current) {
      if (fn(current)) return current;
      current = current.parent;
    }
  }
  get parents() {
    const result = [] as BSNodeScope[];
    let current = this as BSNodeScope;
    while (current.parent) {
      current = current.parent;
      result.push(current);
    }
    return result;
  }
  private applyUpdate(
    field: string,
    of: Iterable<string>,
    old_selections: number,
    new_selections: number,
    isCost: boolean
  ): void {
    if (old_selections === new_selections) return;
    let current = this.parent;
    let directChildForce = true;
    let directChildSelection = true;

    let currentDiff = new_selections - old_selections;
    while (current) {
      if (currentDiff) {
        for (const id of of) {
          current.modifySelections(field, id, currentDiff, directChildSelection, directChildForce);
          if (id === "any" && isCost) {
            if (!current.costTypes.has(field)) {
              current.costTypes.add(field);
              current.addEventsAs("costType", field, field);
            }
          }
        }
      }

      if (current.isEntry()) {
        directChildSelection = false;
        currentDiff *= current.propagateAmount;
      } else if (current.isForce()) {
        if (current.parent?.isForce()) {
          directChildForce = false;
        }
        currentDiff *= current.propagateAmount;
      }

      current = current.parent;
    }
  }
  /** Multiply propagated values in parents by newAmount/prevAmount, including values propagated by children
   * Should only be called when the amount of self goes from 1 to 0+
   *
   */
  private applyFastSelectionsUpdate(old: number, amount: number): void {
    let current = this.parent as BSNodeScope | undefined;
    let currentDiff = amount - old;
    let directChildForce = !(this.isForce() && this.parent?.isForce());
    let directChildSelection = !this.isEntry();
    const sf = {} as Record<string, number>;
    const s = {} as Record<string, number>;
    const f = {} as Record<string, number>;
    const _ = {} as Record<string, number>;
    for (const hash in this.index) {
      if (hash.endsWith("::self") || hash.startsWith("is::")) continue;
      if (hash.startsWith("sf::")) sf[hash] = this.index[hash];
      if (hash.startsWith("s::")) s[hash] = this.index[hash];
      if (hash.startsWith("f::")) f[hash] = this.index[hash];
      if (hash.startsWith("::")) _[hash] = this.index[hash];
    }

    while (current) {
      if (directChildSelection && directChildForce) {
        for (const k in _) current.change(k, _[k] * currentDiff);
      }
      if (directChildSelection) {
        for (const k in f) current.change(k, f[k] * currentDiff);
      }
      if (directChildForce) {
        for (const k in s) current.change(k, s[k] * currentDiff);
      }
      for (const k in sf) {
        const diff = sf[k] * currentDiff;
        current.change(k, diff);
      }

      if (current.isEntry()) {
        directChildSelection = false;
        currentDiff *= current.propagateAmount;
      } else if (current.isForce()) {
        if (current.parent?.isForce()) {
          directChildForce = false;
        }
        currentDiff *= current.propagateAmount;
      }
      current = current.parent;
    }
  }

  /* Need to update filters & categories cost separately, as the categories propagate totalCost*/
  private applyCostsUpdate(
    filters: Set<string>,
    old_costs: Record<string, number>,
    costs: Record<string, number>,
    old_selections: number,
    new_selections: number
  ) {
    for (const cost in costs) {
      const oldCost = old_costs[cost] || 0;
      const newCost = costs[cost] || 0;

      const oldMult = old_selections * oldCost;
      const newMult = newCost * new_selections;
      const diff = newMult - oldMult;
      if (diff) {
        this.applyUpdate(cost, filters, oldMult, newMult, true);
        if (!this.costTypes.has(cost)) {
          this.costTypes.add(cost);
          this.addEventsAs("costType", cost, cost);
        }
      }
    }
  }

  updateMultipliers(new_selections: number, new_propagated_amount: number) {
    if (this.amount === new_selections && this.propagateAmount === new_propagated_amount) return;
    const old = this.amount;
    const oldPropagate = this.propagateAmount;
    this.amount = new_selections;
    this.propagateAmount = new_propagated_amount;

    const selectionsField = this.selectionsField();
    if (!selectionsField || oldPropagate === this.propagateAmount) return;

    this.applyFastSelectionsUpdate(oldPropagate, this.propagateAmount);
    this.applyUpdate(selectionsField, this.filters, oldPropagate, this.propagateAmount, false);
    this.applyUpdate(selectionsField, this.categories, oldPropagate, this.propagateAmount, false);
    this.applyCostsUpdate(this.costFilters, this.costs, this.costs, oldPropagate, this.propagateAmount);
    this.applyCostsUpdate(this.costCategories, this.costs, this.costs, oldPropagate, this.propagateAmount);

    if (!this.isGroup()) {
      this.change(`::${selectionsField}::self`, this.amount - old);
    }
  }

  updateCosts(new_costs: Record<string, number>) {
    const old_costs = this.costs;
    const new_costs_cp = {
      ...new_costs,
    };
    for (const cost in old_costs) {
      if (!(cost in new_costs)) {
        new_costs_cp[cost] = 0;
      }
    }
    this.costs = new_costs_cp;
    if (!this.amount) return;

    this.applyCostsUpdate(this.costFilters, old_costs, this.costs, this.propagateAmount, this.propagateAmount);
    return this.costs;
  }

  updateCost(id: string, value: number) {
    const old = OrZero(this.costs[id]);
    this.costs[id] = value;
    this.applyUpdate(id, this.costFilters, old * this.propagateAmount, value * this.propagateAmount, true);
  }

  updateFilters(new_filters: Set<string>): [Set<string>, Set<string>] {
    const old_filters = this.filters;
    this.filters = new_filters;
    const selectionsField = this.selectionsField();
    if (!selectionsField) return [new Set(), new Set()];

    const amount = this.propagateAmount;

    // array diff negative
    const old_removed = setMinus(old_filters, new_filters);
    if (old_removed.size) {
      if (amount) {
        this.applyUpdate(selectionsField, old_removed, amount, 0, false);
      }
      for (const removed of old_removed) {
        const hash = `is::${removed}`;
        delete this.index[hash];
        this.addEvents(hash, 0, 1);
      }
    }

    // array diff positive
    const new_added = setMinus(new_filters, old_filters);
    if (new_added.size) {
      if (amount) {
        this.applyUpdate(selectionsField, new_added, 0, amount, false);
      }
      for (const added of new_added) {
        const hash = `is::${added}`;
        this.index[hash] = 1;
        this.addEvents(hash, 1, 0);
      }
    }
    return [new_added, old_removed];
  }
  updateCostFilters(new_filters: Set<string>) {
    const old_filters = this.costFilters;
    this.costFilters = new_filters;

    // array diff negative
    const old_removed = setMinus(old_filters, new_filters);
    if (old_removed.size) {
      if (this.propagateAmount) {
        this.applyCostsUpdate(old_removed, this.costs, this.costs, this.propagateAmount, 0);
      }
      for (const removed of old_removed) {
        const hash = `is::${removed}`;
        delete this.index[hash];
        this.addEvents(hash, 0, 1);
      }
    }

    // array diff positive
    const new_added = setMinus(new_filters, old_filters);
    if (new_added.size) {
      if (this.propagateAmount) {
        this.applyCostsUpdate(new_added, this.costs, this.costs, 0, this.propagateAmount);
      }
    }
  }
  updateCategories(new_categories: Set<string>): [Set<string>, Set<string>] {
    const old_categories = this.categories;
    this.categories = new Set(new_categories);
    const selectionsField = this.selectionsField();
    if (!selectionsField) return [new Set(), new Set()];
    // array diff negative
    const old_removed = setMinus(old_categories, new_categories);
    if (old_removed.size) {
      if (this.propagateAmount) {
        this.applyUpdate(selectionsField, old_removed, this.propagateAmount, 0, false);
      }
      for (const category of old_removed) {
        const hash = `is::${category}`;
        delete this.index[hash];
        this.addEvents(hash, 0, 1);
      }
    }

    // array diff positive
    const new_added = setMinus(new_categories, old_categories);
    if (new_added.size) {
      if (this.propagateAmount) {
        this.applyUpdate(selectionsField, new_added, 0, this.propagateAmount, false);
      }
      for (const category of new_added) {
        const hash = `is::${category}`;
        this.index[hash] = 1;
        this.addEvents(hash, 1, 0);
      }
    }

    if (new_added.size || old_removed.size) {
      if (this.isGroup() || this.isUnit()) {
        this.addEvents("categories");
      }
    }

    return [new_added, old_removed];
  }
  updateCostCategories(new_categories: Set<string>) {
    const old_categories = this.costCategories;
    this.costCategories = new Set(new_categories);

    // array diff negative
    const old_removed = setMinus(old_categories, new_categories);
    if (old_removed.size) {
      if (this.propagateAmount) {
        this.applyCostsUpdate(old_removed, this.costs, this.costs, this.propagateAmount, 0);
      }
      for (const category of old_removed) {
        const hash = `is::${category}`;
        delete this.index[hash];
        this.addEvents(hash, 0, 1);
      }
    }

    // array diff positive
    const new_added = setMinus(new_categories, old_categories);
    if (new_added.size) {
      if (this.propagateAmount) {
        this.applyCostsUpdate(new_added, this.costs, this.costs, 0, this.propagateAmount);
      }
      for (const category of new_added) {
        const hash = `is::${category}`;
        this.index[hash] = 1;
        this.addEvents(hash, 1, 0);
      }
    }
  }
}
