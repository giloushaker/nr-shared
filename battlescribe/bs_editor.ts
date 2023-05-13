import { Base, Link } from "./bs_main";
import { Catalogue } from "./bs_main_catalogue";
import {
  conditionToString,
  fieldToText,
  modifierToString,
} from "./bs_modifiers";
import {
  BSICondition,
  BSIConditionGroup,
  BSIConstraint,
  BSIModifier,
  BSIModifierGroup,
  BSIProfile,
  BSIRepeat,
} from "./bs_types";
export interface hasParent<T> {
  parent: T | undefined;
}

export type ItemTypes = (
  | Base
  | Link
  | Catalogue
  | BSIModifier
  | BSIModifierGroup
  | BSICondition
  | BSIConditionGroup
  | BSIConstraint
) & {
  parentKey: ItemKeys;
  editorTypeName: ItemTypeNames;
};

export type ItemTypeNames =
  | "catalogue"
  | "gameSystem"
  | "selectionEntry"
  | "selectionEntryGroup"
  | "category"
  | "force"
  | "entryLink"
  | "categoryLink"
  | "catalogueLink"
  | "profile"
  | "rule"
  | "profileType"
  | "characteristic"
  | "characteristicType"
  | "publication"
  | "infoGroup"
  | "infoLink"
  | "constraint"
  | "condition"
  | "modifier"
  | "modifierGroup"
  | "repeat"
  | "conditionGroup"
  | "cost"
  | "costType";

export type ItemKeys =
  // Entries
  | "selectionEntries"
  | "sharedSelectionEntries"
  | "selectionEntryGroups"
  | "sharedSelectionEntryGroups"
  | "entryLinks"
  | "sharedEntryLinks"
  | "forceEntries"
  | "categoryEntries"
  | "categoryLinks"

  //
  | "catalogue"
  | "catalogueLinks"
  | "publications"
  | "costTypes"
  | "profileTypes"
  | "sharedProfiles"
  | "sharedRules"

  // Modifiable
  | "infoLinks"
  | "profiles"
  | "rules"
  | "infoGroups"

  // Constraints and modifiers
  | "constraints"
  | "conditions"
  | "modifiers"
  | "modifierGroups"
  | "repeats"
  | "conditionGroups";

export function findSelfOrParentWhere<T extends hasParent<T>>(
  self: T,
  fn: (node: T) => boolean
): T | undefined {
  let current = self as T | undefined;
  while (current && !Object.is(current, current.parent)) {
    if (fn(current)) return current;
    current = current.parent;
  }
  return undefined;
}
export function findParentWhere<T extends hasParent<T>>(
  self: T,
  fn: (node: T) => boolean
): T | undefined {
  let current = self.parent;
  while (current && !Object.is(current, current.parent)) {
    if (fn(current)) return current;
    current = current.parent;
  }
  return undefined;
}

export function getName(obj: any): string {
  const type = obj.parentKey;
  switch (type) {
    case "selectionEntries":
    case "sharedSelectionEntries":
    case "selectionEntryGroups":
    case "sharedSelectionEntryGroups":
    case "entryLinks":
    case "sharedEntryLinks":
    case "forceEntries":
    case "categoryLinks":
    case "categoryEntries":
      return (obj as Base).name;

    case "catalogueLinks":
    case "publications":
    case "profileTypes":
    case "catalogue":
    case "rules":
    case "sharedRules":
    case "costTypes":
      return (obj as any).name;

    case "sharedProfiles":
    case "profiles":
      const profile = obj as BSIProfile;
      return `${profile.typeName}: ${profile.name}`;
    case "modifiers":
      return modifierToString(findSelfOrParentWhere(obj, (o) => o.id)!, obj);
    case "repeats":
      const repeat = obj as BSIRepeat;
      const parent = findSelfOrParentWhere(obj, (o) => o.id)!;
      return `Repeat ${repeat.repeats} times for every ${
        repeat.value
      } ${fieldToText(parent, repeat.field)} in ${fieldToText(
        parent,
        repeat.scope
      )} of ${repeat.childId ? fieldToText(parent, repeat.childId) : " any"}`;
    case "conditions":
      return conditionToString(
        findSelfOrParentWhere(obj, (o) => o.id),
        obj
      );
    case "constraints":
      return conditionToString(
        findSelfOrParentWhere(obj, (o) => o.id),
        obj
      );

    case "modifierGroups":
      return `(${obj.type})`;
    case "conditionGroups":
    default:
      console.log(type, obj);
      return type;
  }
}
