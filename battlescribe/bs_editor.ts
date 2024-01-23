import { Base, Condition, Constraint, Link, Modifier, ModifierGroup, Profile, goodJsonKeys } from "./bs_main";
import { Catalogue, CatalogueLink, EditorBase } from "./bs_main_catalogue";
import { conditionToString, fieldToText, getModifierOrConditionParent, modifierToString } from "./bs_modifiers";
import {
  BSICondition,
  BSIConditionGroup,
  BSIConstraint,
  BSIModifier,
  BSIModifierGroup,
  BSIProfile,
  BSIRepeat,
} from "./bs_types";
import { BSCatalogueManager } from "./bs_system";
import { isObject, type MaybeArray } from "./bs_helpers";
import { textNodeTags } from "./bs_convert";
import { validChildIds, validScopes } from "./bs_condition";

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
  "sharedInfoGroups",

  // Children
  "categoryEntries",
  // "categoryLinks", BS does not show category links
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
export const systemCategories: CategoryEntry[] = [
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
    icon: "selectionEntryLink.png",
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
    type: "sharedInfoGroups",
    name: "Shared Info Groups",
    icon: "infoGroup.png",
  },
  {
    type: "rules",
    links: "infoLinks",
    name: "Root Rules",
    icon: "rule.png",
  },
  {
    type: "selectionEntries",
    links: "entryLinks",
    name: "Root Selection Entries",
    icon: "selectionEntry.png",
  },
];
export const catalogueCategories: CategoryEntry[] = [
  {
    type: "catalogueLinks",
    name: "Catalogue Links",
    icon: "catalogueLink.png",
  },
  ...systemCategories,
];
export type ItemTypeNames =
  | "catalogue"
  | "gameSystem"
  | "selectionEntry"
  | "selectionEntryGroup"
  | "category"
  | "force"
  | "selectionEntryLink"
  | "selectionEntryGroupLink"
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
  | "association"
  | "constraint"
  | "condition"
  | "modifier"
  | "modifierGroup"
  | "repeat"
  | "conditionGroup"
  | "cost"
  | "costType"
  | "link"
  | "profileLink"
  | "ruleLink"
  | "infoGroupLink";

export type ItemKeys =
  // Entries
  | "selectionEntries"
  | "sharedSelectionEntries"
  | "selectionEntryGroups"
  | "sharedSelectionEntryGroups"
  | "entryLinks"
  | "forceEntries"
  | "categoryEntries"
  | "categoryLinks"

  //
  | "catalogueLinks"
  | "publications"
  | "costTypes"
  | "profileTypes"
  | "sharedProfiles"
  | "sharedRules"
  | "sharedInfoGroups"

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

export function getTypeLabel(key: string, obj?: any): string {
  switch (key) {
    case "selectionEntry":
      return "Entry";
    case "selectionEntryGroup":
      return "Group";
    case "selectionEntryLink":
      return "Entry (link)";
    case "selectionEntryGroupLink":
      return "Group (link)";

    case "force":
      return "Force";
    case "category":
      return "Category";
    case "categoryLink":
      return "Category (link)";

    case "catalogueLink":
      return "Catalogue (link)";
    case "publication":
      return "Publication";
    case "costType":
      return "Cost Type";
    case "costs":
      return "Cost";

    case "link":
      return "Link";
    case "profileType":
      return "Profile Type";
    case "profile":
      return "Profile";
    case "rule":
      return "Rule";
    case "infoLink":
      return "Info (link)";
    case "infoGroup":
      return "Info Group";
    case "profileLink":
      return "Profile";
    case "ruleLink":
      return "Rule (link)";
    case "infoGroupLink":
      return "Info Group (link)";
    case "characteristic":
      return "Characteristic";
    case "characteristicType":
      return "Characteristic Type";

    case "constraint":
      return "Constraint";
    case "condition":
      return "Condition";
    case "modifier":
      return "Modifier";
    case "modifierGroup":
      return "Modifier Group";
    case "repeat":
      return "Repeat";
    case "conditionGroup":
      return "Condition Group";
    case "catalogue":
      return "Catalogue";
    case "gameSystem":
      return "Game System";
    default:
      console.warn("unknown getTypeLabel key", key);
      return key as any;
  }
}
export function getTypeName(key: string, obj?: any): ItemTypeNames {
  switch (key) {
    case "selectionEntries":
      return "selectionEntry";
    case "selectionEntryGroups":
      return "selectionEntryGroup";

    case "sharedSelectionEntries":
      return obj?.targetId ? "selectionEntryLink" : "selectionEntry";
    case "sharedSelectionEntryGroups":
      return obj?.targetId ? "selectionEntryLink" : "selectionEntryGroup";

    case "entryLinks":
      return obj?.target ? ((obj.target.editorTypeName + "Link") as any) : "link";
    case "forceEntries":
      return "force";
    case "categoryEntries":
      return "category";
    case "categoryLinks":
      return "categoryLink";

    case "catalogueLinks":
      return "catalogueLink";
    case "publications":
      return "publication";
    case "costTypes":
      return "costType";
    case "costs":
      return "cost";

    case "profileTypes":
      return "profileType";
    case "profiles":
      return "profile";
    case "rules":
      return "rule";
    case "characteristics":
      return "characteristic";
    case "characteristicTypes":
      return "characteristicType";
    case "sharedProfiles":
      return "profile";
    case "sharedRules":
      return "rule";
    case "sharedInfoGroups":
      return "infoGroup";

    case "infoLinks":
      return obj ? (`${obj.type || "info"}Link` as ItemTypeNames) : "infoLink";
    case "infoGroups":
      return "infoGroup";

    case "associations":
      return "association";
    case "constraints":
      return "constraint";
    case "conditions":
      return "condition";
    case "modifiers":
      return "modifier";
    case "modifierGroups":
      return "modifierGroup";
    case "repeats":
      return "repeat";
    case "conditionGroups":
      return "conditionGroup";
    case "catalogue":
    case "gameSystem":
      return key;
    default:
      console.warn("unknown getTypeName key", key);
      return key as any;
  }
}

export function getNameExtra(obj: EditorBase, _refs = true, _type = true): string {
  const type = obj.parentKey;
  const pieces = [];
  switch (type) {
    case "infoLinks":
      if (["profiles", "sharedProfiles"].includes((obj.target as EditorBase)?.parentKey) && _type) {
        pieces.push((obj.target as unknown as BSIProfile).typeName);
      }
      break;
    case "sharedProfiles":
    case "profiles":
      if (_type){
        pieces.push((obj as unknown as BSIProfile).typeName);
      }
      break;
    case "selectionEntries":
    case "sharedSelectionEntries":
      if (obj.isEntry() && obj.getType() !== "upgrade" && _type) {
        pieces.push(obj.getType());
      }
      break;
    case "entryLinks":
      if (obj.target && obj.isEntry() && obj.getType() !== "upgrade" && _type) {
        pieces.push(obj.getType());
      }
      break;
    case "modifierGroups":
      pieces.push(`(${(obj.modifiers?.length || 0) + (obj.modifierGroups?.length || 0)})`);
      break;
    default:
      break;
  }
  const refcount = (obj.links?.length ?? 0) + (obj.other_links?.length ?? 0);
  if (refcount && _refs) {
    const s = refcount === 1 ? "" : "s";
    pieces.push(`(${refcount || 0} ref${s})`);
  }
  if (obj.comment && obj.comment[0]) {
    pieces.push("# " + obj.comment);
  }
  if (obj.isCollective && obj.isCollective()) {
    pieces.push("(collective)");
  }
  return pieces.join(" ");
}

export function getName(obj: any): string {
  const type = obj.parentKey;
  switch (type) {
    case "selectionEntries":
    case "sharedSelectionEntries":
    case "selectionEntryGroups":
    case "sharedSelectionEntryGroups":
    case "entryLinks":
    case "forceEntries":
    case "categoryLinks":
    case "categoryEntries":
    case "sharedInfoGroups":
    case "infoGroups":
    case "catalogueLinks":
    case "publications":
    case "profileTypes":
    case "catalogue":
    case "gameSystem":
    case "rules":
    case "sharedRules":
    case "costs":
    case "costTypes":
    case "sharedProfiles":
    case "profiles":
    case "characteristics":
    case "characteristicTypes":
      return obj.getName();
    case "modifiers":
      return modifierToString(getModifierOrConditionParent(obj), obj);
    case "repeats": {
      const repeat = obj as BSIRepeat;
      const parent = getModifierOrConditionParent(obj);
      if (!parent) {
        console.error("no parent for repeat", obj);
      }
      return `Repeat ${repeat.repeats} times for every ${repeat.value} ${fieldToText(
        parent,
        repeat.field
      )} in ${fieldToText(parent, repeat.scope)} of ${repeat.childId ? fieldToText(parent, repeat.childId) : " any"}`;
    }
    case "conditions":
      return conditionToString(getModifierOrConditionParent(obj), obj);
    case "constraints":
      return conditionToString(getModifierOrConditionParent(obj), obj);

    case "modifierGroups":
      return `Modify...`;
    case "conditionGroups":
      return `${obj.type.toUpperCase()}`;

    case "infoLinks":
      return obj.target ? getName(obj.target) : obj.getName();
    case "associations":
      return `${obj.label}`;
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
    for (const key of Object.keys(cur)) {
      if (!goodJsonKeys.has(key) || textNodeTags.has(key)) continue;
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

export function removeEntry(entry: EditorBase) {
  const parent = entry.parent;
  if (parent) {
    const arr = parent[entry.parentKey] as EditorBase[];
    const index = arr.indexOf(entry);
    if (index !== -1) {
      arr.splice(index, 1);
    }
  }
}

/**
 * Removes an entry and fixes up the index
 * Returns all the removed data for undoing
 */
export function onRemoveEntry(removed: EditorBase, manager?: BSCatalogueManager) {
  const catalogue = removed.catalogue;
  forEachEntryRecursive(removed, (entry, key, parent) => {
    catalogue.removeFromIndex(entry);
    if (entry.isLink && entry.isLink()) {
      catalogue.unlinkLink(entry);
      delete (entry as any).target;
    }
    if (entry instanceof Profile && entry.typeId) {
      const found = entry.catalogue.findOptionById(entry.typeId);
      if (found) {
        entry.catalogue.removeRef(entry, found as EditorBase);
      }
    }
    if (entry instanceof Condition) {
      const scope = entry.scope;
      const childId = entry.childId;
      if (!validScopes.has(scope)) {
        const found = entry.catalogue.findOptionById(entry.scope);
        if (found) {
          entry.catalogue.removeOtherRef(entry, found as EditorBase);
        }
      }
      if (!validChildIds.has(childId)) {
        const found = entry.catalogue.findOptionById(entry.childId);
        if (found) {
          entry.catalogue.removeOtherRef(entry, found as EditorBase);
        }
      }
    }
    delete (entry as any).parent;
    delete (entry as any).catalogue;
  });
  if (manager && removed instanceof CatalogueLink) {
    catalogue.reload(manager);
  }
}

export function onAddEntry(
  entries: EditorBase[] | EditorBase,
  catalogue: Catalogue,
  parent: EditorBase | Catalogue,
  manager: BSCatalogueManager
) {
  let reload = false;
  for (const entry of Array.isArray(entries) ? entries : [entries]) {
    forEachEntryRecursive(entry, (entry, key, _parent) => {
      if (isObject(entry)) {
        entry.parent = _parent || (parent as any);

        entry.catalogue = catalogue;
        catalogue.addToIndex(entry);
        if (entry instanceof Link) {
          catalogue.updateLink(entry);
        }
        if (entry instanceof Profile && entry.typeId) {
          const found = entry.catalogue.findOptionById(entry.typeId);
          if (found) {
            entry.catalogue.addRef(entry, found as EditorBase);
          }
        }
        if (entry instanceof CatalogueLink && entry.targetId) {
          reload = true;
        }
        catalogue.refreshErrors(entry);
      }
    });
  }
  if (reload && parent) {
    const catalogue = parent.catalogue || parent;
    catalogue.reload(manager);
  }
}
export interface EntryPathEntry {
  key: string;
  index: number;
  id?: string;
}
export interface EntryPathEntryExtended extends EntryPathEntry {
  type: string;
  display: string;
  label?: string;
  name?: string;
}

export function getEntryPath(entry: EditorBase): EntryPathEntry[] {
  if (!entry.parent && !entry.isCatalogue()) {
    return [{ id: entry.id, key: entry.parentKey, index: 0 }];
  }
  const result = [] as EntryPathEntry[];
  while (entry.parent) {
    const parent = (entry.parent || entry.catalogue) as any;
    result.push({
      key: entry.parentKey,
      index: parent[(entry as any).parentKey].indexOf(entry),
      id: entry.id,
    });
    entry = entry.parent;
  }
  result.reverse();
  return result;
}
export function getEntryPathInfo(entry: EditorBase): EntryPathEntry[] {
  if (!entry.parent && !entry.isCatalogue()) {
    return [{ id: entry.id, key: entry.parentKey, index: 0 }];
  }
  const result = [] as EntryPathEntryExtended[];
  do {
    const parent = (entry.parent || entry.catalogue) as any;
    if (parent) {
      result.push({
        name: entry.getName(),
        type: entry.editorTypeName,
        label: entry.getTypeName(),
        display: getName(entry),
        key: entry.parentKey,
        index: parent[(entry as any).parentKey].indexOf(entry),
        id: entry.id,
      });
    } else {
      result.push({
        name: entry.getName(),
        display: getName(entry),
        type: "catalogue",
        key: "catalogue",
        id: entry.id,
        index: 0
      });
    }
    entry = entry.parent as typeof entry;
  } while (entry);
  result.reverse();
  return result as any;
}
/**
 *  Adds an entry at the specified path
 *  returns the parent
 */
export function addAtEntryPath(catalogue: Catalogue, path: EntryPathEntry[], entry: EditorBase) {
  let current = catalogue as any;
  // resolve path up until the last node
  for (let i = 0; i < path.length - 1; i++) {
    const node = path[i];
    current = current[node.key][node.index];
  }
  const lastNode = path[path.length - 1];
  if (!current[lastNode.key]) {
    current[lastNode.key] = [];
  }
  const arr = current[lastNode.key] as EditorBase[];
  arr.splice(lastNode.index, 0, entry);
  return current;
}
export function getAtEntryPath(catalogue: Catalogue, path: EntryPathEntry[]): EditorBase | undefined {
  let current = catalogue as any;
  // resolve path up until the last node
  for (const node of path) {
    current = current[node.key];
    if (!current) return undefined;
    current = current[node.index];
  }
  return current;
}
export function popAtEntryPath(catalogue: Catalogue, path: EntryPathEntry[]): EditorBase {
  let current = catalogue as any;
  // resolve path up until the last node
  const lastNode = path[path.length - 1];
  for (const node of path) {
    if (node === lastNode) continue;
    current = current[node.key][node.index];
  }
  const arr = current[lastNode.key] as EditorBase[];
  const result = arr.splice(lastNode.index, 1)[0];
  if (!result) throw new Error("popAtEntryPath failed");

  return result;
}
export function replaceAtEntryPath(catalogue: Catalogue, path: EntryPathEntry[], value: EditorBase): EditorBase {
  let current = catalogue as any;
  // resolve path up until the last node
  const lastNode = path[path.length - 1];
  for (const node of path) {
    if (node === lastNode) continue;
    current = current[node.key][node.index];
  }
  const arr = current[lastNode.key] as EditorBase[];
  const result = arr.splice(lastNode.index, 1, value)[0];
  if (!result) throw new Error("replaceAtEntryPath failed");
  return result;
}
export function scrambleIds(catalogue: Catalogue, entry_or_entries: MaybeArray<EditorBase>) {
  const scrambled = {} as Record<string, string>;
  const arr = Array.isArray(entry_or_entries) ? entry_or_entries : [entry_or_entries]
  for (const entry of arr)
  forEachEntryRecursive(entry, (node, key, parentNode) => {
    if (node.id) {
      // if (node instanceof Constraint && !(entry instanceof Constraint)) return;
      const currentId = node.id;
      const newId = catalogue.generateNonConflictingId(currentId);
      node.id = newId;
      scrambled[currentId] = newId;
    }
  });
  for (const entry of arr)  {
    forEachEntryRecursive(entry, (node, key, parentNode) => {
      if (node instanceof Condition) {
        if (node.scope in scrambled) {
          node.scope = scrambled[node.scope];
        }
        if (node.childId in scrambled) {
          node.childId = scrambled[node.childId];
        }
      }
      if (node instanceof Modifier) {
        if (node.field in scrambled) {
          node.field = scrambled[node.field];
        }
      }
    });
  }
}

export function fixKey(parent: EditorBase | Catalogue, key: keyof Base, catalogueKey?: string) {
  if (!parent.isCatalogue()) {
    switch (key) {
      case "sharedRules":
        return "rules";
      case "sharedProfiles":
        return "profiles";
      case "sharedInfoGroups":
        return "infoGroups";
      case "sharedSelectionEntries":
        return "selectionEntries";
      case "sharedSelectionEntryGroups":
        return "selectionEntryGroups";
      default:
        return key;
    }
  } else if (catalogueKey) {
    switch (key) {
      case "sharedRules":
      case "rules":
        if (["sharedRules", "rules"].includes(catalogueKey)) {
          return catalogueKey as keyof Base;
        }
        return "";
      case "sharedProfiles":
      case "profiles":
        if (["sharedProfiles", "profiles"].includes(catalogueKey)) {
          return catalogueKey as keyof Base;
        }
        return "";
      case "sharedInfoGroups":
      case "infoGroups":
        if (["sharedInfoGroups", "infoGroups"].includes(catalogueKey)) {
          return catalogueKey as keyof Base;
        }
        return "";
      case "sharedSelectionEntries":
      case "selectionEntries":
        if (["sharedSelectionEntries", "selectionEntries"].includes(catalogueKey)) {
          return catalogueKey as keyof Base;
        }
        return "";
      case "sharedSelectionEntryGroups":
      case "selectionEntryGroups":
        if (["sharedSelectionEntryGroups", "selectionEntryGroups"].includes(catalogueKey)) {
          return catalogueKey as keyof Base;
        }
        return "";
      default:
        return key;
    }
  }
  return key;
}
