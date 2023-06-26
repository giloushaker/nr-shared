import type {
  BSIConstraint,
  BSIModifier,
  BSIModifierGroup,
  BSIQuery,
  SupportedQueries,
  BSIConditionGroup,
  BSICondition,
  BSIRepeat,
} from "./bs_types";
import type { Base, InfoGroup, Link } from "./bs_main";
import type { Catalogue, EditorBase } from "./bs_main_catalogue";
import { getModifierOrConditionParent } from "./bs_editor";

export function* getAllQueries(queries: SupportedQueries): Iterable<BSIQuery> {
  for (const condition of queries.conditions || []) yield condition;
  for (const repeat of queries.repeats || []) yield repeat;

  for (const conditionGroup of queries.conditionGroups || []) {
    for (const condition of getAllQueries(conditionGroup)) yield condition;
  }
  for (const modifier of queries.modifiers || []) {
    for (const condition of getAllQueries(modifier)) yield condition;
  }
}

export function* getAllInfoGroups(group: Base): Iterable<InfoGroup> {
  yield group as InfoGroup;
  for (const grp of group.infoGroups || []) {
    yield* getAllInfoGroups(grp);
  }
  for (const link of group.infoLinks || []) {
    if (link.type === "infoGroup") yield* getAllInfoGroups(link.target as InfoGroup);
  }
}

function getModifiedField(base: Base | Link | undefined, field: string) {
  if (!base) return;
  const catalogue = base.getCatalogue();
  if ((base as EditorBase).parent) {
    const parent = getModifierOrConditionParent(base as EditorBase);
    if (parent) {
      for (const constraint of parent.constraintsIterator()) {
        if (constraint.id === field) return constraint as any as Base;
      }
    }
  }
  const target = catalogue.findOptionById(field);
  return target;
}
export function fieldToText(base: Base | Link | undefined, field: string): string {
  if (base) {
    const catalogue = base.catalogue || (base as Catalogue);
    const target = getModifiedField(base, field);
    if (target) {
      const type = (target as any).type;
      if (type && ["min", "max", "exactly"].includes(type)) {
        return constraintToText(base, target as any);
      }
      if (target.name) {
        if (target.isCategory && target.isCategory()) {
          return `${target.name}`;
        }
        if (target.url) {
          return `${target.name}`;
        }
        return target.name;
      }
    }
    const manager = catalogue.manager;
    if (manager) {
      const found = catalogue.manager.findOptionById(field) || manager.getCatalogueInfo({ targetId: field });
      return found?.name || field;
    }
  }
  return field;
}

export function rawConditionToString(base: Base | Link, condition: BSIQuery & { value?: number }): string {
  const type = condition.type || "none";
  const value = condition.value === undefined ? 1 : condition.value;
  const ofWhat = fieldToText(base, condition.childId || "any");
  const rawField = fieldToText(base, condition.field);
  const field = ["selections", "forces"].includes(rawField) ? "" : ` ${rawField} of`;
  const rawScope = fieldToText(base, condition.scope);
  const scope = rawScope === base.getName() ? "" : `${rawScope}`;
  const recursive = condition.includeChildSelections ? " (recursive)" : "";
  const inScope = scope ? ` in ${scope}${recursive}` : "";
  return `${type} ${value}${field} ${ofWhat}${inScope}`;
}
export function conditionToString(
  base: Base | Link | undefined,
  condition: BSIQuery & { value?: number },
  includeId = false,
  fieldToString = fieldToText
): string {
  const type = condition.type || "none";
  const value = condition.value === undefined ? 1 : condition.percentValue ? `${condition.value}%` : condition.value;

  const rawField = fieldToString(base, condition.field);
  const field = ["selections", "forces"].includes(rawField) ? ` ${rawField}` : ` ${rawField}`;

  const what = fieldToString(base, condition.childId || "") + (includeId ? `(${condition.childId || "any"})` : "");
  const of = what && field ? `of ` : "";

  const rawScope = fieldToString(base, condition.scope);
  const scope = rawScope === base?.getName() ? "" : `${rawScope}`;
  const recursive = condition.includeChildSelections ? " (recursive)" : "";
  const inScope = scope ? ` in ${scope}${recursive}` : "";

  switch (type) {
    case "instanceOf":
      return `${scope} is ${what}`;
    case "notInstanceOf":
      return `${scope} is not ${what}`;

    case "atLeast":
      return `${value}+${field} ${of}${what}${inScope}`;
    case "greaterThan":
      return `${Number(value) + 1}+${field} ${of}${what}${inScope}`;

    case "atMost":
      return `${value}${value === 0 ? "" : "-"}${field} ${of}${what}${inScope}`;
    case "lessThan":
      return `${Number(value) - 1}${Number(value) - 1 === 0 ? "" : "-"}${field} ${of}${what}${inScope}`;

    case "equalTo":
      return `${value}${field} ${of}${what}${inScope}`;
    case "notEqualTo":
      return `not ${value}${field} ${of}${what}${inScope}`;

    case "none":
      return `${field} ${of}${what}${inScope}`;

    default:
      return `${type} ${value}${field} ${of}${what}${inScope}`;
  }
}

export function constraintToText(base: Base | Link, constraint: BSIConstraint, fieldToString = fieldToText) {
  const field = constraint.field === "selections" ? "" : ` ${fieldToString(base, constraint.field)}`;
  const scope = constraint.scope === "parent" ? "" : `(${fieldToString(base, constraint.scope)})`;
  const ofWhat = constraint.childId ? ` ${fieldToString(base, constraint.childId)}` : "";
  return `${constraint.type}${field}${ofWhat}${scope}`;
}
export function constraintToString(base: Base | Link, constraint: BSIConstraint, fieldToString = fieldToText) {
  const field = constraint.field === "selections" ? "" : ` ${fieldToString(base, constraint.field)}`;
  const scope =
    constraint.scope === "parent" ? "" : `<span class=grey>(${fieldToString(base, constraint.scope)})</span>`;
  return `${constraint.type}${field}${scope}`;
}
export function modifierToString(
  base: Base | Link | undefined,
  modifier: BSIModifier,
  fieldToString = fieldToText
): string {
  return `${modifier.type} ${fieldToString(base, modifier.field)} ${fieldToString(base, modifier.value?.toString())}`;
}

export function conditionGroupToString(
  base: Base | Link,
  group: BSIConditionGroup,
  fieldToString = fieldToText
): string {
  const result = [] as string[];
  for (const condition of group.conditions || []) {
    result.push(conditionToString(base, condition, false, fieldToString));
  }
  for (const condition of group.conditionGroups || []) {
    result.push(`(${conditionGroupToString(base, condition, fieldToString)})`);
  }
  const type = group.type || "and";
  return result.join(` ${type} `);
}

/**
 * Converts modifiers to a better format for displaying
 * {effect, groups: Recursive<ConditionGroups>}
 */
export function prepareModifiers(
  base: Base | Link,
  modifiers: BSIModifier[],
  modifierGroups: BSIModifierGroup[],
  fieldToString = fieldToText
): PrintableModifier[] {
  const result = [] as PrintableModifier[];
  const root = { modifiers: modifiers, modifierGroups: modifierGroups };
  const stack = [root] as BSIModifierGroup[];
  const depthCounts = [] as number[];
  const parents = [] as BSIModifierGroup[];

  while (stack.length) {
    const current = stack.pop()!;

    if (current.modifiers) {
      const conditions = [] as BSICondition[];
      const conditionGroups = [] as BSIConditionGroup[];

      for (const parent of parents) {
        if (parent.conditions) conditions.push(...parent.conditions);
        if (parent.conditionGroups) conditionGroups.push(...parent.conditionGroups);
      }

      if (current.conditions) conditions.push(...current.conditions);
      if (current.conditionGroups) conditionGroups.push(...current.conditionGroups);

      for (const modifier of current.modifiers) {
        const resultConditionGroups = [...conditionGroups, ...(modifier.conditionGroups || [])];
        if (conditions.length || modifier.conditions?.length) {
          resultConditionGroups.push({
            type: "and",
            conditions: [...conditions, ...(modifier.conditions || [])],
          });
        }

        const prepared: PrintableModifier = {
          type: modifier.type,
          value: modifier.value,
          field: modifier.field,
          html: modifierToString(base, modifier, fieldToString),
        };

        if (resultConditionGroups.length) {
          prepared.conditionGroups = resultConditionGroups.map((o) => setConditionsText(base, o, fieldToString));
        }
        if (modifier.repeats) {
          prepared.repeats = modifier.repeats.map((o) => setRepeatText(base, o, fieldToString));
        }
        result.push(prepared);
      }
    }

    const childs = current.modifierGroups;
    if (childs?.length) {
      parents.push(current);
      depthCounts.push(childs.length);
      stack.push(...childs);
    } else {
      while (depthCounts.length) {
        const count = depthCounts[depthCounts.length - 1];
        if (count === 1) {
          depthCounts.pop();
          parents.pop();
        } else {
          depthCounts[depthCounts.length - 1] = count - 1;
          break;
        }
      }
    }
  }

  return result;
}

/**
 * Converts modifiers to a better format for parsing
 * {effect, groups: Recursive<ConditionGroups>}
 */
export function prepareModifiers2(
  base: Base | Link,
  modifiers: BSIModifier[],
  modifierGroups: BSIModifierGroup[]
): ParsableModifier[] {
  const result = [] as ParsableModifier[];
  const root = { modifiers: modifiers, modifierGroups: modifierGroups };
  const stack = [root] as BSIModifierGroup[];
  const depthCounts = [] as number[];
  const parents = [] as BSIModifierGroup[];

  while (stack.length) {
    const current = stack.pop()!;

    if (current.modifiers) {
      const conditions = [] as BSICondition[];
      const conditionGroups = [] as BSIConditionGroup[];

      for (const parent of parents) {
        if (parent.conditions) conditions.push(...parent.conditions);
        if (parent.conditionGroups) conditionGroups.push(...parent.conditionGroups);
      }

      if (current.conditions) conditions.push(...current.conditions);
      if (current.conditionGroups) conditionGroups.push(...current.conditionGroups);

      for (const modifier of current.modifiers) {
        const resultConditionGroups = [...conditionGroups, ...(modifier.conditionGroups || [])];
        if (conditions.length || modifier.conditions?.length) {
          resultConditionGroups.push({
            type: "and",
            conditions: [...conditions, ...(modifier.conditions || [])],
          });
        }

        const prepared: ParsableModifier = {
          modifier: modifier,
        };

        if (resultConditionGroups.length) {
          prepared.conditionGroups = resultConditionGroups.map((o) => setConditionsText(base, o));
        }
        if (modifier.repeats) {
          prepared.repeats = modifier.repeats.map((o) => setRepeatText(base, o));
        }
        result.push(prepared);
      }
    }

    const childs = current.modifierGroups;
    if (childs?.length) {
      parents.push(current);
      depthCounts.push(childs.length);
      stack.push(...childs);
    } else {
      while (depthCounts.length) {
        const count = depthCounts[depthCounts.length - 1];
        if (count === 1) {
          depthCounts.pop();
          parents.pop();
        } else {
          depthCounts[depthCounts.length - 1] = count - 1;
          break;
        }
      }
    }
  }

  return result;
}

export interface ParsableModifier {
  modifier: BSIModifier;
  conditionGroups?: BSIConditionGroup[];
  repeats?: BSIRepeat[];
}

export interface PrintableModifier {
  type: string;
  field: string;
  value: number | boolean | string;
  html: string;
  conditionGroups?: PrintableConditionGroup[];
  repeats?: PrintableRepeat[];
}
export interface PrintableCondition extends BSICondition {
  html: string;
}
export interface PrintableRepeat extends BSIRepeat {
  html: string;
}
export interface PrintableConditionGroup {
  type?: "and" | "or";
  conditions?: PrintableCondition[];
  conditionGroups?: PrintableConditionGroup[];
}
export function setConditionsText(
  base: Base | Link,
  group: BSIConditionGroup,
  fieldToString = fieldToText
): PrintableConditionGroup {
  if (group.conditions) {
    for (const condition of group.conditions) {
      const printable = condition as PrintableCondition;
      if (printable.html) continue;
      printable.html = conditionToString(base, condition, false, fieldToString);
    }
  }
  if (group.conditionGroups) {
    for (const nested of group.conditionGroups) {
      setConditionsText(base, nested, fieldToString);
    }
  }
  return group as PrintableConditionGroup;
}

export function setRepeatText(base: Base | Link, repeat: BSIRepeat, fieldToString = fieldToText): PrintableRepeat {
  const result = repeat as PrintableRepeat;
  result.html = conditionToString(base, repeat, false, fieldToString);
  return result;
}
