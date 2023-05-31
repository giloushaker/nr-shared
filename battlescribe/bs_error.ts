import { ErrorMessageWithHash } from "../error_manager";
import { Instance } from "./bs_instance";
import { BSIConstraint } from "./bs_types";
import { BSNodeState } from "./reactive/reactive_state";
import { BSIExtraConstraint } from "./bs_main";

interface hasUid {
  uid: string;
}
interface hasId {
  id: string;
}
export function hashError(scope: hasUid, id: hasId): string {
  return (scope ? scope.uid : "undefined") + id.id;
}

export function removeErrorsWithDuplicatedHash(errors: ErrorMessageWithHash[]) {
  const dict: Record<string, ErrorMessageWithHash> = {};
  for (const error of errors) {
    dict[error.hash] = error;
  }
  return Object.values(dict);
}

/**
 * `name` requires `type` `value` `percent` `field` of `of`
 * Weapons requires a minimum of 10% selections of Spear
 * @param name                    (example: "Weapons")
 * @param type                    (example: "min")
 * @param amount                  (example:  10)
 * @param percent                 (example:  true)
 * @param field                   (example: "selections")
 * @param ofWhat                  (example: "Spear")
 */
export function buildErrorMessage(
  name: string,
  type: "min" | "max" | "hidden" | "associate" | "legal",
  amount?: any,
  field?: string,
  percent?: boolean,
  ofWhat?: string
) {
  switch (type) {
    case "hidden":
      return _buildErrorMessage(name, "has", `${amount} ${field}`, undefined, "while being hidden");
    case "min":
      return _buildErrorMessage(name, "requires a minimum of", `${amount}${percent ? "%" : ""} ${field}`, ofWhat);
    case "max":
      return _buildErrorMessage(name, "is limited to", `${amount}${percent ? "%" : ""} ${field}`, ofWhat);
    case "associate":
      return _buildErrorMessage(name, "has", `${amount} invalid associations`, ofWhat);
    case "legal":
      return _buildErrorMessage(name, "is not", "Legal");
  }
}

export function _buildErrorMessage(
  name: string,
  constraint: string,
  constraintMessage?: string,
  ofWhat?: string,
  _while?: string
) {
  let result = `<span class='optName'>${name}</span> ${constraint}`;
  if (constraintMessage) result += ` <strong class='red'>${constraintMessage}</strong>`;
  if (ofWhat) result += ` of <span class='optName'>${ofWhat}</span>`;
  if (_while) result += ` ${_while}`;
  return result.trim();
}

export function constraintError(instance: Instance, constraint: BSIConstraint, value: number): ErrorMessageWithHash {
  // let parent = instance.getParentUnit();
  // if (constraint.scope == "roster") {
  //   parent = instance.getParentRoster();
  // }
  // if (constraint.scope == "force") {
  //   parent = instance.getParentForce();
  // }

  // There cannot be an 'ancestor' constraint so no arrays can be returned
  const scope = instance.state.find(constraint.scope, constraint.shared) as BSNodeState;
  const index = instance.getCostIndex();
  const split = constraint.field.split("::");
  const constraintField = split.map((o) => index[o]?.name || o).join("::");

  const ofWhat = (constraint as BSIExtraConstraint).name || constraint.childId || instance.getName();
  const msg = buildErrorMessage(
    scope?.name,
    constraint.type,
    value,
    constraintField,
    constraint.percentValue,
    constraint.childId === "any" ? undefined : ofWhat
  );

  return {
    type: 1,
    // unit: undefined : parent,
    parent: instance,
    msg: msg,
    depth: 0,
    scope: constraint.scope,
    constraint: constraint,
    severity: getConstraintErrorSeverity(instance, scope, constraint.type),
    hash: hashError(scope, constraint),
  };
}

function getConstraintErrorSeverity(self: Instance, state: BSNodeState, constraintType: string): "error" | "warning" {
  if (!self.isGroup() && !self.isQuantifiable()) return "error";
  if (constraintType !== "min") return "error";

  // If a scope is within ParentEntry, this is an error
  const entry = self.getParentEntry().state;
  while (state) {
    if (state.uid === entry.uid) return "error";
    state = state.parent!;
  }
  return "warning";
}
