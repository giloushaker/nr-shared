import { copy } from "./bs_helpers";
import { BSIConstraint, BSIModifier, BSIModifierGroup } from "./bs_types";

export function splitExactlyConstraints(obj: { constraints?: BSIConstraint[] }) {
  if (!obj.constraints) return obj;
  const constraints = [];
  for (const constraint of obj.constraints) {
    if (constraint.type === "exactly") {
      const min = { ...constraint, id: constraint.id + "-min", type: "min" } as BSIConstraint;
      const max = { ...constraint, id: constraint.id + "-max", type: "max" } as BSIConstraint;
      constraints.push(min, max);
    } else {
      constraints.push(constraint);
    }
  }
  const result = copy(obj);
  result.constraints = constraints;
  return result;
}
// recursively Split all modifiers wich affected an `exactly` constraint to affect its generated min & max constraints.
export function splitExactlyConstraintsModifiers<T>(
  obj: T & {
    modifiers?: BSIModifier[];
    modifierGroups?: BSIModifierGroup[];
    constraintsIterator(): Iterable<BSIConstraint>;
  }
): T {
  if (!obj.modifiers && !obj.modifierGroups) return obj;
  // Find all exactly constraints wich we need to find modifiers for
  const constraints = {} as Record<string, BSIConstraint>;
  for (const constraint of obj.constraintsIterator()) {
    if (constraint.type === "exactly") {
      constraints[constraint.id] = constraint;
    }
  }

  // Return a new modifiers array with the modifiers split
  function splitModifiers(modifiers: BSIModifier[]) {
    // if modifier points to exactly constraint, split it
    // and set the cloned modifiers to be returned as copy

    const out_modifiers = [] as BSIModifier[];
    for (const modifier of modifiers) {
      if (modifier.field in constraints) {
        const min = { ...modifier, field: modifier.field + "-min" } as BSIModifier;
        const max = { ...modifier, field: modifier.field + "-max" } as BSIModifier;
        out_modifiers.push(min, max);
      } else {
        out_modifiers.push(modifier);
      }
    }
    return out_modifiers;
  }

  function splitModifierGroups(modifierGroups: BSIModifierGroup[]) {
    const out_group = [] as BSIModifierGroup[];
    for (const group of modifierGroups) {
      const split = { ...group } as BSIModifierGroup;
      if (split.modifiers) {
        split.modifiers = splitModifiers(split.modifiers);
      }
      if (split.modifierGroups) {
        split.modifierGroups = splitModifierGroups(split.modifierGroups);
      }
      out_group.push(split);
    }
    return out_group;
  }

  const result = copy(obj);

  if (result.modifiers) {
    result.modifiers = splitModifiers(result.modifiers);
  }
  if (result.modifierGroups) {
    result.modifierGroups = splitModifierGroups(result.modifierGroups);
  }
  return result;
}
