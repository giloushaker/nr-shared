import { Base, Link } from "./bs_main";
import { Catalogue, EditorBase } from "./bs_main_catalogue";
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
export interface CategoryEntry {
  name: string;
  type: ItemKeys;
  links?: ItemKeys;
  icon: string;
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
export const possibleChildren: ItemKeys[] = [
  // Catalogue stuff
  "catalogueLinks",
  "publications",
  "costTypes",
  "profileTypes",
  "sharedProfiles",
  "sharedRules",

  // Modifiable
  "infoLinks",
  "profiles",
  "rules",
  "infoGroups",

  // Children
  "categoryEntries",
  "categoryLinks",
  "forceEntries",
  "selectionEntries",
  "selectionEntryGroups",
  "entryLinks",

  // Constraints and modifiers
  "constraints",
  "conditions",
  "modifiers",
  "modifierGroups",
  "repeats",
  "conditionGroups",
];
export const categories: CategoryEntry[] = [
  {
    type: "catalogueLinks",
    name: "Catalogue Links",
    icon: "catalogueLink.png",
  },
  {
    type: "publications",
    name: "Publications",
    icon: "publication.png",
  },
  {
    type: "costTypes",
    name: "Cost Types",
    icon: "cost.png",
  },
  {
    type: "profileTypes",
    name: "Profile Types",
    icon: "profileType.png",
  },
  {
    type: "categoryEntries",
    name: "Category Entries",
    icon: "category.png",
  },
  {
    type: "forceEntries",
    name: "Force Entries",
    icon: "force.png",
  },
  {
    type: "sharedSelectionEntries",
    name: "Shared Selection Entries",
    icon: "entryLink.png",
  },
  {
    type: "sharedSelectionEntryGroups",
    name: "Shared Selection Entry Groups",
    icon: "shared_groups.png",
  },
  {
    type: "sharedProfiles",
    name: "Shared Profiles",
    icon: "shared_profiles.png",
  },
  {
    type: "sharedRules",
    name: "Shared Rules",
    icon: "shared_rules.png",
  },
  {
    type: "infoGroups",
    name: "Shared Info Groups",
    icon: "infoGroup.png",
  },
  {
    type: "selectionEntries",
    links: "entryLinks",
    name: "Root Selection Entries",
    icon: "selectionEntry.png",
  },
  {
    type: "rules",
    name: "Root Rules",
    icon: "rule.png",
  },
];

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

export function forEachEntryRecursive(
  entry: EditorBase,
  callback: (entry: EditorBase, key?: string, parent?: EditorBase) => unknown
) {
  callback(entry);
  const stack = [entry];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const key of possibleChildren) {
      const val = (cur as any)[key] as EditorBase[] | undefined;
      if (val && Array.isArray(val)) {
        for (const e of val) {
          stack.push(e);
          callback(e, key, cur);
        }
      }
    }
  }
}

/**
 * Removes an entry and fixes up the index
 * Returns all the removed data for undoing
 */
export function onRemoveEntry(removed: EditorBase) {
  const catalogue = removed.catalogue;
  forEachEntryRecursive(removed, (entry, key, parent) => {
    catalogue.removeFromIndex(entry);
    if (entry.isLink()) {
      catalogue.unlinkLink(entry);
      delete (entry as any).target;
    }
    delete (entry as any).parent;
    delete (entry as any).catalogue;
  });
}

export function onAddEntry(
  entries: EditorBase[] | EditorBase,
  catalogue: Catalogue,
  parent?: EditorBase
) {
  for (const removedEntry of Array.isArray(entries) ? entries : [entries]) {
    forEachEntryRecursive(removedEntry, (entry, key, _parent) => {
      entry.parent = _parent || parent;

      entry.catalogue = catalogue;
      catalogue.addToIndex(entry);
      if (entry.isLink()) {
        catalogue.updateLink(entry);
      }
    });
  }
}
export interface EntryPathEntry {
  key: string;
  index: number;
}

export function getEntryPath(entry: EditorBase): EntryPathEntry[] {
  const result = [];
  while (entry.parent) {
    const parent = entry.parent as any;
    result.push({
      key: entry.parentKey,
      index: parent[entry.parentKey].findIndex((o: EditorBase) => o === entry),
    });
    entry = entry.parent;
  }
  result.reverse();
  return result;
}
/**
 *  Sets an entry at the specified path
 *  returns the parent
 */
export function setAtEntryPath(
  catalogue: Catalogue,
  path: EntryPathEntry[],
  entry: EditorBase
) {
  let current = catalogue as any;
  // resolve path up until the last node
  for (let i = 0; i < path.length - 1; i++) {
    const node = path[i];
    current = current[node.key][node.index];
  }
  const lastNode = path[path.length - 1];
  current[lastNode.key].splice(lastNode.index, 0, entry);
  return current;
}
export function popAtEntryPath(
  catalogue: Catalogue,
  path: EntryPathEntry[]
): EditorBase {
  let current = catalogue as any;
  // resolve path up until the last node
  for (let i = 0; i < path.length - 1; i++) {
    const node = path[i];
    current = current[node.key][node.index];
  }
  const lastNode = path[path.length - 1];
  return current[lastNode.key].splice(lastNode.index, 1)[0];
}
export function scrambleIds(catalogue: Catalogue, entry: EditorBase) {
  forEachEntryRecursive(entry, (entry, key, _parent) => {
    if (entry.id) {
      entry.id = catalogue.generateNonConflictingId();
    }
  });
}
