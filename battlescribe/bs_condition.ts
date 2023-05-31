import type { BSIQuery, BSIRepeat, BSICondition, BSIConditionGroup } from "./bs_types";
import { Instance } from "./bs_instance";
import { BSNodeScope } from "./reactive/reactive_scope";

export interface hasParent<T> {
  getParent(): T | undefined;
}

export function findSelfOrParentWhere<T extends hasParent<T>>(self: T, fn: (node: T) => boolean): T | undefined {
  let current = self as T | undefined;
  while (current && !Object.is(current, current.getParent())) {
    if (fn(current)) return current;
    current = current.getParent();
  }
  return undefined;
}
export function findParentWhere<T extends hasParent<T>>(self: T, fn: (node: T) => boolean): T | undefined {
  let current = self.getParent();
  while (current && !Object.is(current, current.getParent())) {
    if (fn(current)) return current;
    current = current.getParent();
  }
  return undefined;
}

function isEntry(self: Instance): boolean {
  return !self.isGroup() && !self.isForce() && !self.isCategory() && !self.isCatalogue() && !self.isRoster();
}

function arrayNoUndefined<T>(obj?: T): T[] {
  if (obj === undefined) return [];
  return [obj];
}

export function getInScope(self: Instance, scope: string, shared?: boolean, extra?: boolean): Instance[] {
  if (shared === false) {
    // not Shared just seems to ignore scope? lol
    switch (scope) {
      case "parent":
      case "roster":
      case "force":
      case "primary-catalogue":
      case "primary-category":
        // return self.isGroup() ? [self] : [];
        return self.isGroup() ? [self] : [self.getParent()];
      case "self":
        break;
      default:
        break;
    }
  }
  switch (scope) {
    case "self":
      return [self];
    case "parent":
      return extra ? [self] : arrayNoUndefined(findParentWhere(self, (o) => !o.isGroup()));
    case "primary-category":
      return arrayNoUndefined(findSelfOrParentWhere(self, (o) => o.isCategory()));
    case "force":
      return arrayNoUndefined(findSelfOrParentWhere(self, (o) => o.isForce()));
    case "roster":
      return arrayNoUndefined(findSelfOrParentWhere(self, (o) => o.isRoster()));
    case "primary-catalogue":
      return arrayNoUndefined(findSelfOrParentWhere(self, (o) => o.isCatalogue()));
    case "ancestor": {
      const result = [];
      let current = self;
      while (current && !Object.is(current, current.getParent())) {
        result.push(current);
        current = current.getParent();
      }
      return result;
    }
    default: /**{Any ID}**/ {
      const parents = findSelfOrParentWhere(self, (o) => o.getOptionIds().includes(scope));
      if (parents) return [parents];
      const force = findSelfOrParentWhere(self, (o) => o.isForce());
      if (force) {
        for (const child of force.getChildInstances()) {
          if (child.getOptionIds().includes(scope)) return [child];
        }
      }
      return [];
    }
  }
}

export function getField(nodes: Instance[], query: BSIQuery, childId?: string) {
  let result = 0;
  for (const node of nodes) {
    if (!node) continue;
    const data = getConditionScope(node).get({
      ...query,
      childId: childId || query.childId || "any",
    });
    if (data) result += data;
  }
  return result;
}

export function evalQuery(self: Instance, condition: BSIQuery, extra = false): number {
  const cIn = getInScope(self, condition.scope, condition.shared, extra);
  if (condition.type === "instanceOf" || condition.type === "notInstanceOf") {
    return cIn.filter((o) => getConditionScope(o).filters.has(condition.childId!)).length;
  }

  let result = getField(cIn, condition);
  if (condition.percentValue) {
    result /= getField(cIn, condition, "any");
  }
  return result;
}

export function getRepeat(repeat: BSIRepeat, queryValue: number, totalValue?: number): number {
  if (repeat.percentValue) {
    if (queryValue === 0 || totalValue === 0) {
      queryValue = 0;
    } else {
      queryValue = (queryValue / totalValue!) * 100;
    }
  }
  const div = queryValue / repeat.value;
  const round = repeat.roundUp ? Math.ceil(div) : Math.floor(div);
  const result = round * repeat.repeats;
  return result;
}
export function evalRepeat(self: Instance, repeat: BSIRepeat, extra = false): number {
  return getRepeat(repeat, evalQuery(self, repeat, extra));
}

export function evalCondition(self: Instance, condition: BSICondition, extra = false) {
  const _eval = evalQuery(self, condition, extra);
  return getCondition(condition.type, _eval, condition.value, condition.scope);
}

export function getRosterLimit(self: Instance, costId: string) {
  const found = self.getParentRoster().maxCosts.find((o) => o.typeId === costId);
  if (!found) {
    return -1;
    // throw Error(`Couldn't find ${costId} limit`);
  }
  return found.value;
}

export function evalConditionGroup(self: Instance, group: BSIConditionGroup, extra = false): boolean {
  switch (group.type) {
    case "and":
    default:
      for (const condition of group.conditions || []) {
        if (!evalCondition(self, condition, extra)) return false;
      }
      for (const condition of group.conditionGroups || []) {
        if (!evalConditionGroup(self, condition, extra)) return false;
      }
      return true;
    case "or":
      for (const condition of group.conditions || []) {
        if (evalCondition(self, condition, extra)) return true;
      }
      for (const condition of group.conditionGroups || []) {
        if (evalConditionGroup(self, condition, extra)) return true;
      }
      return false;
  }
}

export function getMultipliers(obj: Instance, amount: number) {
  const result = [];
  let last = amount;
  if (obj.propagateChanges === false) return [];
  let current = obj.getParent();
  while (current && !Object.is(current, current.getParent())) {
    if (current.propagateChanges === false) {
      result.push(last); // equivalent to 1 * last which eq to amount always 1
      // Push a 0 after if disabled to keep a total cost but not propagate it above
      result.push(0);
      break;
    }
    const amount = !isEntry(current) ? 1 : current.getAmount();
    const sum = amount * last;
    result.push(sum);
    last = sum;

    current = current.getParent();
  }
  return result;
}

interface hasConditionScope {
  scope: BSNodeScope;
}
export function getConditionScope(obj: hasConditionScope & any): BSNodeScope {
  return obj.scope ? obj.scope : obj;
}

/**
 * returns all Options and Options of Groups
 * @param self the parent
 */
function getOptionsRecursive(self: Instance): Instance[] {
  const result = [];
  const groups = [self];
  while (groups.length) {
    const current: Instance = groups.pop()!;
    const childs = current.getChildInstancesIncludingExtra();
    for (const sub of childs) {
      if (sub.source.isQuantifiable()) result.push(sub);
      else groups.push(sub);
    }
  }
  return result;
}
/**
 * returns all Selections
 * @param self the parent
 */
function getSelectionsRecursive(self: Instance): Instance[] {
  const result = [];
  const stack = [self];
  while (stack.length) {
    const current = stack.pop()!;
    const childs = current.getSelections();
    for (const sub of childs) {
      result.push(sub);
      stack.push(sub);
    }
  }
  return result;
}

// Gets all Nodes to check the condition In (scope)
export function getIn(
  self: Instance,
  scope: string,
  getInstance?: boolean,
  includeChildSelections?: boolean,
  includeChildForces?: boolean,
  shared?: boolean
): Instance[] {
  const result = getInScope(self, scope, shared);

  const new_result: Instance[] = getInstance ? [...result] : [];

  for (const parent of result) new_result.push(...getOptionsRecursive(parent));

  if (includeChildSelections) {
    const stack = [...new_result];
    while (stack.length > 0) {
      const current = stack.pop() as Instance;
      const found = getOptionsRecursive(current);
      for (const option of found) {
        new_result.push(option);
        stack.push(option);
      }
    }
  }

  if (includeChildForces && !includeChildSelections) {
    const stack = [...result];
    while (stack.length > 0) {
      const current = stack.pop() as Instance;
      current
        .getChildren()
        .filter((o) => o.isForce())
        .forEach((elt) => {
          new_result.push(elt);
          stack.push(elt);
        });
    }
  }

  return new_result;
}

// Gets all Nodes to check the condition In (scope)
export function getInSelections(
  self: Instance,
  scope: string,
  getInstance?: boolean,
  includeChildSelections?: boolean,
  includeChildForces?: boolean,
  shared?: boolean
): Instance[] {
  const result = getInScope(self, scope, shared);

  const new_result: Instance[] = getInstance ? [...result] : [];

  for (const parent of result) new_result.push(...parent.getSelections());

  if (includeChildSelections) {
    const stack = [...new_result];
    while (stack.length > 0) {
      const current = stack.pop() as Instance;
      getSelectionsRecursive(current).forEach((elt) => {
        new_result.push(elt);
        stack.push(elt);
      });
    }
  }

  if (includeChildForces && !includeChildSelections) {
    const stack = [...result];
    while (stack.length > 0) {
      const current = stack.pop() as Instance;
      current
        .getChildren()
        .filter((o) => o.isForce())
        .forEach((elt) => {
          new_result.push(elt);
          stack.push(elt);
        });
    }
  }

  return new_result;
}

// Checks the condition (type): Needs the value returned from Query (field)
export function getCondition(
  conditionType: string,
  valueFromQuery: number,
  value: any = null,
  scope?: string
): boolean {
  switch (conditionType) {
    case "lessThan":
      return valueFromQuery < value;
    case "greaterThan":
      return valueFromQuery > value;
    case "equalTo":
      return valueFromQuery === value;
    case "notEqualTo":
      return valueFromQuery !== value;
    case "atLeast":
      // Simulate BS Bug (WH40K/Imperial Knights/Questor Allegiance/Noble Households/{any household})
      if (scope === "self" && valueFromQuery === 0) return false;
      return valueFromQuery >= value;
    case "atMost":
      return valueFromQuery <= value;
    case "instanceOf":
      return Boolean(valueFromQuery);
    case "notInstanceOf":
      return !Boolean(valueFromQuery);
    case "min":
      return value >= 0 && valueFromQuery < value;
    case "max":
      return value >= 0 && valueFromQuery > value;
    default:
      throw Error("Invalid Condition Type " + conditionType);
  }
}

export function getConditionPercent(type: string, value: number, valueFromQuery: number, totalFromQuery: number) {
  // -1 Could be an infinite limit, %of 0 is 0
  if (valueFromQuery <= 0) return false;
  if (valueFromQuery === 0) {
    if (totalFromQuery) {
      return true;
    }
    return false;
  } else {
    valueFromQuery = (valueFromQuery / totalFromQuery) * 100;
  }
  return getCondition(type, valueFromQuery, value);
}
