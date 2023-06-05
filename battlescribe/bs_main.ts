import type {
  BSIModifier,
  BSIModifierGroup,
  BSIConstraint,
  BSIProfile,
  BSIRule,
  BSICost,
  BSIPublication,
  BSINamed,
  BSIProfileType,
  BSICatalogue,
  BSICharacteristic,
  BSICondition,
  BSIConditionGroup,
  BSIRepeat,
  BSICharacteristicType,
} from "./bs_types";
import { Catalogue, EditorBase } from "./bs_main_catalogue";
import type { Roster } from "./bs_system";
import type { IModel } from "../systems/army_interfaces";
import type { NRAssociation, AssociationConstraint } from "./bs_association";
import { clone, isObject } from "./bs_helpers";
import { getAllInfoGroups } from "./bs_modifiers";
const isNonEmptyIfHasOneOf = [
  "modifiers",
  "modifierGroups",
  "constraints",

  "entryLinks",
  "categoryLinks",
  "selectionEntries",
  "selectionEntryGroups",

  "infoLinks",
  "infoGroups",
  "rules",
  "profiles",
];
export interface BSModifierBase {
  modifiers?: BSIModifier[];
  modifierGroups?: BSIModifierGroup[];
}

const arrayKeys = [
  "profile",
  "rule",
  "infoLink",
  "infoGroup",
  "selectionEntry",
  "selectionEntryGroup",
  "entryLink",

  "profiles",
  "rules",
  "infoLinks",
  "infoGroups",
  "entryLinks",
  "selectionEntries",
  "selectionEntryLinks",
  "selectionEntryGroups",

  "categoryLinks",
  "costTypes",
  "profileTypes",
  "characteristicTypes",
  "categoryEntries",
  "categories",
  "forceEntries",
  "forces",
  "sharedSelectionEntries",
  "sharedSelectionEntryGroups",
  "sharedProfiles",
  "sharedRules",
  "sharedInfoGroups",
  "rules",
  "rootRules",

  "publications",
  "catalogueLinks",
  "constraints",

  "characteristics",
  "costs",
];

const arrayKeysWithoutId = ["conditions", "conditionGroups", "modifiers", "modifierGroups", "repeats"];
export const goodKeys = new Set([...arrayKeys, ...arrayKeysWithoutId]);
export const goodKeysWiki = new Set(arrayKeys);

/**
 * This is a base class with generic functions for all nodes in the BSData xml/json
 * Usage: Add it as a prototype on the json to use the functions with Object.setPrototypeOf
 */
export class Base implements BSModifierBase {
  // Data
  id!: string;
  type?: string;
  shared?: boolean;
  import?: boolean;
  collective?: boolean;
  comment?: string;

  // Maybe move this to catalogue
  profileTypes?: BSIProfileType[];

  // Data - Modifiable
  name!: string;
  hidden!: boolean;
  value?: number | string | boolean;
  page?: string;
  publicationId!: string;

  profiles?: Profile[];
  rules?: Rule[];
  infoLinks?: InfoLink[];
  infoGroups?: InfoGroup[];
  publications?: BSIPublication[];
  costs?: BSICost[];

  // Childs
  selectionEntries?: Entry[];
  selectionEntryGroups?: Group[];
  entryLinks?: Link[];
  categoryEntries?: Category[];
  categoryLinks?: CategoryLink[];
  forceEntries?: Force[];
  sharedSelectionEntryGroups?: Group[];
  sharedSelectionEntries?: Entry[];
  sharedProfiles?: Profile[];
  sharedRules?: Rule[];
  sharedInfoGroups?: InfoGroup[];
  target?: Base;

  // Modifiers
  modifiers?: BSIModifier[];
  modifierGroups?: BSIModifierGroup[];
  constraints?: BSIConstraint[];
  repeats?: BSIRepeat[];
  conditions?: BSICondition[];
  conditionGroups?: BSIConditionGroup[];

  // Processed (Catalogue)
  catalogue!: Catalogue; // Parent Catalogue
  extra_constraints?: BSIExtraConstraint[];
  childs!: Base[];

  // Processed (self)
  loaded?: boolean;
  collective_recursive?: boolean;
  limited_to_one?: boolean;

  // NR Only
  associations?: NRAssociation[];
  associationConstraints?: AssociationConstraint[];

  constructor(json: any) {
    return Object.setPrototypeOf(json, Object.getPrototypeOf(this));
  }
  get url(): string {
    return "%{main_catalogue|catalogue}/%{id}/%{getName}";
  }
  post_init() {
    if (!this.isLink() && (this as any as Link).targetId) {
      Object.setPrototypeOf(this, Link.prototype);
    }
  }

  process() {
    if (this.loaded) return;
    this.collective_recursive = this.isCollectiveRecursive();
    this.limited_to_one = !this.canAmountBeAbove1();
    this.loaded = true;
  }
  toJson() {
    return entryToJson(this);
  }
  getCatalogue() {
    return this.catalogue;
  }
  getGameSystem() {
    return this.catalogue.getGameSystem();
  }
  // Prevent Vue Observers
  get [Symbol.toStringTag](): string {
    // Anything can go here really as long as it's not 'Object'
    return (globalThis as any).isEditor ? "Object" : "ObjectNoObserve";
  }
  isGroup(): this is Group | Link<Group> {
    return false;
  }
  isForce(): this is Force {
    return false;
  }
  isCatalogue(): this is Catalogue {
    return false;
  }
  isLink(): this is Link {
    return false;
  }
  isCategory(): this is Category {
    return false;
  }
  isRoster(): this is Roster {
    return false;
  }
  isQuantifiable(): boolean {
    return false;
  }
  isEntry(): this is Entry {
    return false;
  }
  isRule(): this is Rule | InfoLink<Rule> {
    return false;
  }
  isProfile(): this is Profile | InfoLink<Profile> {
    return false;
  }
  isInfoGroup(): this is InfoGroup | InfoLink<InfoGroup> {
    return false;
  }
  isUnit(): boolean {
    for (const categoryLink of this.categoryLinks || []) {
      if (categoryLink.primary) return true;
    }
    return false;
  }
  getId(): string {
    return this.id;
  }
  getType(): string | undefined {
    return this.type;
  }
  getHidden(): boolean | undefined {
    return this.hidden;
  }
  getPage(): string | undefined {
    return this.page;
  }
  getName(): string {
    return this.name;
  }
  isCollective(): boolean | undefined {
    return this.collective;
  }
  isCollectiveRecursive() {
    const stack = [...this.selectionsIterator()];
    while (stack.length) {
      const current = stack.pop()!;
      if (!current.isCollective() && !current.isGroup()) return false;
      stack.push(...current.selectionsIterator());
    }
    return true;
  }

  *forcesIterator(): Iterable<Force> {
    return;
  }
  *profilesIterator(): Iterable<Profile> {
    for (const group of getAllInfoGroups(this)) {
      if (group.profiles) {
        yield* group.profiles;
      }
      if (group.infoLinks) {
        yield* group.infoLinks?.filter((o) => o.type === "profile").map((o) => o.target as Profile);
      }
    }
  }
  *rulesIterator(): Iterable<Rule> {
    for (const group of getAllInfoGroups(this)) {
      if (group.rules) {
        yield* group.rules;
      }
      if (group.infoLinks) {
        yield* group.infoLinks?.filter((o) => o.type === "rule").map((o) => o.target as Rule);
      }
    }
  }
  *constraintsIterator(): Iterable<BSIConstraint> {
    if (this.constraints) yield* this.constraints;
  }
  *extraConstraintsIterator(): Iterable<BSIExtraConstraint> {
    if (this.extra_constraints) yield* this.extra_constraints;
  }
  *modifierGroupsIterator(): Iterable<BSIModifierGroup> {
    if (this.modifierGroups) yield* this.modifierGroups;
  }
  *modifiersIterator(): Iterable<BSIModifier> {
    if (this.modifiers) yield* this.modifiers;
  }
  *modifierGroupsIteratorRecursive(): Iterable<BSIModifierGroup> {
    yield this;
    if (this.isLink()) yield this.target;
    for (const group of this.modifierGroupsIterator()) {
      yield group;
      yield* iterateModifierGroupsRecursive(group.modifierGroups);
    }
  }
  *selectionsIterator(): Iterable<Base | Link> {
    if (this.selectionEntries) yield* this.selectionEntries;
    if (this.selectionEntryGroups) yield* this.selectionEntryGroups;
    if (this.entryLinks) yield* this.entryLinks;
  }
  *localSelectionsIterator(): Iterable<Base | Link> {
    if (this.selectionEntries) yield* this.selectionEntries;
    if (this.selectionEntryGroups) yield* this.selectionEntryGroups;
    if (this.entryLinks) yield* this.entryLinks;
  }
  *nodesIterator(): Iterable<Base | Link> {
    if (this.isLink()) yield* this.target.nodesIterator();
    if (this.selectionEntries) yield* this.selectionEntries;
    if (this.selectionEntryGroups) yield* this.selectionEntryGroups;
    if (this.entryLinks) yield* this.entryLinks;
  }
  *entriesIterator(): Iterable<Base | Link> {
    if (this.isLink()) yield* this.target.entriesIterator();
    if (this.selectionEntries) yield* this.selectionEntries;
    if (this.selectionEntryGroups) yield* this.selectionEntryGroups;
    if (this.entryLinks) yield* this.entryLinks;
    if (this.childs) yield* this.childs;
  }
  *categoryLinksIterator(): Iterable<CategoryLink> {
    if (this.categoryLinks) yield* this.categoryLinks;
  }
  *infoLinksIterator(): Iterable<InfoLink> {
    if (this.infoLinks) yield* this.infoLinks;
  }
  *infoGroupsIterator(): Iterable<InfoGroup> {
    if (this.infoGroups) yield* this.infoGroups;
  }
  *infoRulesIterator(): Iterable<Rule> {
    if (this.rules) yield* this.rules;
  }
  *infoProfilesIterator(): Iterable<Profile> {
    if (this.profiles) yield* this.profiles;
  }

  /**
   *If callback returns something other than `undefined`, callback will not be called for the childs of this node
   */
  forEachCond(callbackfn: (value: Base | Link, depth: number) => any, _depth = 0): void {
    if (callbackfn(this, 0) === undefined)
      for (const instance of this.selectionsIterator()) instance.forEachCond(callbackfn, _depth + 1);
  }
  forEach(callbackfn: (value: Base | Link) => unknown): void {
    callbackfn(this);
    for (const instance of this.selectionsIterator()) instance.forEach(callbackfn);
  }
  forEachNode(callbackfn: (value: Base | Link) => unknown): void {
    callbackfn(this);
    for (const instance of this.nodesIterator()) instance.forEachNode(callbackfn);
  }
  forEachNodeCb(callbackfn: (value: Base | Link) => unknown): void {
    const stack = [this as Base | Link];
    const blacklist = new Set<string>();
    while (stack.length) {
      const cur = stack.pop()!;
      if (blacklist.has(cur.id)) {
        continue;
      } else {
        blacklist.add(cur.id);
      }
      callbackfn(cur);
      if (cur.childs) {
        stack.push(...cur.childs);
        continue;
      }

      if (cur.target) {
        const target = cur.target;

        if (target.selectionEntries) stack.push(...target.selectionEntries);

        if (target.selectionEntryGroups) stack.push(...target.selectionEntryGroups);

        if (target.entryLinks) stack.push(...target.entryLinks);
      }
      if (cur.selectionEntries) stack.push(...cur.selectionEntries);

      if (cur.selectionEntryGroups) stack.push(...cur.selectionEntryGroups);

      if (cur.entryLinks) stack.push(...cur.entryLinks);
    }
  }
  forEachObjectWhitelist<T extends Base>(callbackfn: (value: T, parent: T) => unknown, whiteList = goodKeys) {
    const stack = [this as any];
    // const keys = {} as any;

    while (stack.length) {
      const current = stack.pop()!;
      for (const key of Object.keys(current)) {
        const value = current[key];
        if (!whiteList.has(key)) {
          // addOne(keys, key);
          continue;
        }
        //  If Array: add each object inside array if (Array.isArray(value)) {

        if (isObject(value)) {
          if (Array.isArray(value)) {
            if (value.length && isObject(value[0])) {
              for (let i = value.length; i--; ) {
                const cur = value[i];
                callbackfn(cur, current);
                stack.push(cur);
              }
            }
          } else {
            callbackfn(value, current);
            stack.push(value);
          }
        }
      }
    }

    // console.log("foreachobjectwhitelist", keys);
  }
  forEachObject(callbackfn: (value: Base | Link, parent: Base) => unknown, badKeys = new Set()) {
    const stack = [this as any];
    // const keys = {} as any;
    while (stack.length) {
      const current = stack.pop()!;
      for (const key of Object.keys(current)) {
        const value = current[key];
        if (badKeys.has(key)) continue;
        //  If Array: add each object inside array if (Array.isArray(value)) {

        if (isObject(value)) {
          if (Array.isArray(value)) {
            if (value.length && isObject(value[0])) {
              for (let i = value.length; i--; ) {
                const cur = value[i];
                callbackfn(cur, current);
                stack.push(cur);
              }
            }
          } else {
            callbackfn(value, current);
            stack.push(value);
          }
        }
      }
    }
  }
  findOption(cb: (opt: Base | Link) => boolean): Base | Link | undefined {
    for (const s of this.selectionsIterator()) {
      if (cb(s)) return s;
    }
  }
  findOptionRecursive(cb: (opt: Base | Link) => boolean): Base | Link | undefined {
    const stack = [...this.selectionsIterator()];
    while (stack.length) {
      const current = stack.pop()!;
      if (cb(current)) return current;
    }
  }
  getCosts(): BSICost[] {
    return this.costs || [];
  }

  getPrimaryCategory(): string {
    for (const categoryLink of this.categoryLinks || []) {
      if (categoryLink.primary) return categoryLink.targetId;
    }
    return UNCATEGORIZED_ID;
  }

  // Modifiers a constraints query to have the same effect when checked from a roster/force.
  // packs modifiers & modifiers groups inside it
  getBoundConstraint(constraint: BSIConstraint): BSIExtraConstraint {
    const result = Object.assign({}, constraint) as BSIExtraConstraint;
    result.name = this.getName();
    result.parent = this;
    const useTarget = constraint.shared || this instanceof CategoryLink;
    result.childId = this.isLink() && useTarget ? this.targetId : this.id;
    result.scope = "self";

    result.modifiers = [];
    for (const modifier of this.modifiersIterator()) {
      if (modifier.field === constraint.id || modifier.field === "hidden") result.modifiers.push(modifier);
    }
    result.modifierGroups = [];
    for (const group of this.modifierGroupsIterator()) {
      current: for (const sub_grp of iterateModifierGroupsRecursive([group])) {
        for (const modifier of sub_grp.modifiers || []) {
          if (modifier.field === constraint.id || modifier.field === "hidden") {
            result.modifierGroups.push(group);
            break current;
          }
        }
      }
    }
    return result;
  }
  // checks if extra constraints are null before adding them to prevent duplicates
  // because of this, this must be called before setting roster/force constraints
  getChildBoundConstraints(skipGroup?: boolean): BSIExtraConstraint[] {
    const result = [];
    for (const child of this.selectionsIterator()) {
      if (skipGroup && child.isGroup()) continue;
      for (const constraint of child.constraintsIterator()) {
        if (constraint.type === "min") {
          if (constraint.scope === "parent") result.push(child.getBoundConstraint(constraint));
        }
      }

      if (child.isGroup()) result.push(...child.getChildBoundConstraints());
    }
    return result;
  }
  canAmountBeAbove1(): boolean {
    const maxes = getTheoreticalMaxes(this.constraintsIterator(), [
      ...this.modifierGroupsIterator(),
      { modifiers: [...this.modifiersIterator()] },
    ]);
    if (!maxes.length || maxes.includes(-1)) return true;
    return Math.min(...maxes) > 1;
  }
  hasOption(name: string) {
    let found: undefined | true = undefined;
    this.forEachCond((o) => {
      if (o.getName() === name) found = true;
      return found;
    });
    return found ? true : false;
  }
}

export class Entry extends Base {
  isEntry() {
    return true;
  }
  isQuantifiable(): boolean {
    return true;
  }
}
export class Group extends Base {
  declare defaultSelectionEntryId?: string;
  isGroup() {
    return true;
  }
}
export class Link<T extends Base = Group | Entry> extends Base {
  targetId!: string;
  declare target: T;
  isLink() {
    return true;
  }
  isGroup() {
    return this.target.isGroup();
  }
  isCategory() {
    return this.target.isCategory();
  }
  isQuantifiable(): boolean {
    return this.target.isQuantifiable();
  }
  isEntry() {
    return this.target.isEntry();
  }
  isProfile() {
    return this.target?.isProfile();
  }
  isRule(): boolean {
    return this.target?.isRule();
  }
  isInfoGroup() {
    return this.target?.isInfoGroup();
  }
  isUnit(): boolean {
    if (this.target.isUnit()) return true;
    for (const categoryLink of this.categoryLinks || []) {
      if (categoryLink.primary) return true;
    }
    return false;
  }
  isEmptyLink(): boolean {
    for (const key of isNonEmptyIfHasOneOf) {
      if ((this as any)[key] !== undefined) return false;
    }
    return true;
  }
  getId(): string {
    return this.targetId;
  }
  getType(): string | undefined {
    return this.target.type;
  }
  getPage(): string | undefined {
    return this.page || this.target.page;
  }
  getHidden(): boolean | undefined {
    return this.target.hidden || this.hidden;
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore: TS2611
  get associationConstraints(): AssociationConstraint[] | undefined {
    return this.target.associationConstraints;
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore: TS2611
  get associations(): NRAssociation[] | undefined {
    return this.target.associations;
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore: TS2611
  get defaultSelectionEntryId(): string | undefined {
    return (this.target as Group).defaultSelectionEntryId;
  }
  isCollective(): boolean | undefined {
    return super.isCollective() || this.target.isCollective();
  }
  *extraConstraintsIterator(): Iterable<BSIExtraConstraint> {
    yield* this.target.extraConstraintsIterator();
    yield* super.extraConstraintsIterator();
  }
  *rulesIterator(): Iterable<Rule> {
    yield* this.target.rulesIterator();
    yield* super.rulesIterator();
  }
  *profilesIterator(): Iterable<Profile> {
    yield* this.target.profilesIterator();
    yield* super.profilesIterator();
  }
  *constraintsIterator(): Iterable<BSIConstraint> {
    yield* this.target.constraintsIterator();
    yield* super.constraintsIterator();
  }
  *modifierGroupsIterator(): Iterable<BSIModifierGroup> {
    yield* this.target.modifierGroupsIterator();
    yield* super.modifierGroupsIterator();
  }
  *modifiersIterator(): Iterable<BSIModifier> {
    yield* this.target.modifiersIterator();
    yield* super.modifiersIterator();
  }
  *selectionsIterator(): Iterable<Base | Link> {
    yield* this.target.selectionsIterator();
    yield* super.selectionsIterator();
  }
  *categoryLinksIterator(): Iterable<CategoryLink> {
    yield* this.target.categoryLinksIterator();
    yield* super.categoryLinksIterator();
  }
  *infoLinksIterator(): Iterable<InfoLink> {
    yield* this.target.infoLinksIterator();
    yield* super.infoLinksIterator();
  }
  *infoGroupsIterator(): Iterable<InfoGroup> {
    yield* this.target.infoGroupsIterator();
    yield* super.infoGroupsIterator();
  }
  *infoRulesIterator(): Iterable<Rule> {
    yield* this.target.infoRulesIterator();
    yield* super.infoRulesIterator();
  }
  *infoProfilesIterator(): Iterable<Profile> {
    yield* this.target.infoProfilesIterator();
    yield* super.infoProfilesIterator();
  }
  getName(): string {
    return this.target?.name || this.name;
  }
  getParent(): Base | undefined {
    return (this as any as EditorBase).parent;
  }
  getPrimaryCategory(): string {
    for (const categoryLink of this.categoryLinks || []) {
      if (categoryLink.primary) return categoryLink.targetId;
    }
    for (const categoryLink of this.target.categoryLinks || []) {
      if (categoryLink.primary) return categoryLink.targetId;
    }
    return UNCATEGORIZED_ID;
  }
  getCosts(): BSICost[] {
    const d = {} as Record<string, BSICost>;
    if (this.target.costs) {
      for (const cost of this.target.costs) d[cost.typeId] = cost;
    }
    if (this.costs) {
      for (const cost of this.costs) d[cost.typeId] = cost;
    }
    return Object.values(d);
  }
}
(Link.prototype as any).keyInfoCache = {};

export class InfoLink<T extends Base = Rule | InfoGroup | Profile> extends Link {
  declare target: T;
  declare type: "infoGroup" | "profile" | "rule";
}
export class CategoryLink extends Link {
  declare targetId: string;
  declare target: Category;
  primary?: boolean;
  main_catalogue!: Catalogue;

  get units() {
    return this.target.units;
  }
  *selectionsIterator(): Iterable<Base> {
    yield* this.target.units;
  }
  isEmpty(): boolean {
    return this.target.isEmpty();
  }
}

export const UNCATEGORIZED_ID = "(No Category)";
export const ILLEGAL_ID = "(Illegal Units)";
export class Category extends Base {
  declare id: string;
  units!: Array<Base | Link>;
  main_catalogue!: Catalogue;
  isCategory(): this is Category {
    return true;
  }

  *selectionsIterator(): Iterable<Base> {
    yield* this.units;
  }
  isEmpty(): boolean {
    return !Boolean(this.units.length);
  }
}
export class Force extends Base {
  declare name: string;
  declare id: string;
  categories!: Array<Category | CategoryLink>;
  forces?: Force[];
  main_catalogue!: Catalogue;
  isForce(): this is Force {
    return true;
  }
  isEntry() {
    return true;
  }
  *selectionsIterator(): Iterable<Base> {
    yield* this.categories;
    if (this.forces) yield* this.forces;
  }
  *rulesIterator(): Iterable<Rule> {
    for (const group of getAllInfoGroups(this)) {
      if (group.rules) {
        yield* group.rules;
      }
      if (group.infoLinks) {
        yield* group.infoLinks?.filter((o) => o.type === "rule").map((o) => o.target as Rule);
      }
    }
    if (this.main_catalogue) yield* this.main_catalogue.rulesIterator();
  }
  generateForces(categories: Record<string, Category>): Force[] {
    const result = [];
    for (const force of this.forceEntries || []) {
      const copied = clone(force);
      copied.main_catalogue = this.main_catalogue;
      const forceCategories = [];
      for (const link of force.categoryLinks || []) {
        if (link.targetId in categories) {
          forceCategories.push(categories[link.targetId]);
        }
      }
      copied.categories = forceCategories;
      this.main_catalogue.index[copied.id] = copied;
      result.push(copied);
    }
    this.forces = result;
    return result;
  }
  isEmpty(): boolean {
    for (const category of this.categories) {
      if (!category.isEmpty()) {
        return false;
      }
    }
    return true;
  }
  *forcesIterator(): Iterable<Force> {
    if (this.forces) {
      yield* this.forces;
    }
  }
  *forcesIteratorRecursive(): Iterable<Force> {
    if (this.forces) {
      for (const force of this.forces) {
        yield force;
        yield* force.forcesIteratorRecursive();
      }
    }
  }
}

const maxValue = Infinity;
export function getTheoreticalMaxes(
  constraints: Iterable<BSIConstraint>,
  modifierGroups: Iterable<BSIModifierGroup>
): number[] {
  const maxConstraints = [] as number[];
  function push(n: number) {
    maxConstraints.push(n);
  }
  for (const constraint of constraints) {
    const beginLength = maxConstraints.length;
    if (constraint.field !== "selections" || constraint.type !== "max") continue;
    if (constraint.value > 1) {
      push(constraint.value);
      continue;
    }
    let constraintValue = constraint.value;
    for (const modifier_group of iterateModifierGroupsRecursive(modifierGroups)) {
      for (const modifier of modifier_group.modifiers || []) {
        if (modifier.field !== constraint.id) continue;
        if (modifier.type === "increment") {
          if (modifier_group.repeats?.length || modifier.repeats?.length) {
            push(maxValue);
            continue;
          }
          constraintValue += modifier.value as number;
          if (constraintValue > 1) {
            push(constraintValue);
            continue;
          }
        }
        if (modifier.type === "decrement" && (modifier.value as any) < 0) {
          if (modifier_group.repeats?.length || modifier.repeats?.length) {
            push(maxValue);
            continue;
          }
          constraintValue -= modifier.value as number;
          if (constraintValue > 1) {
            push(constraintValue);
            continue;
          }
        }
        if (modifier.type === "set" && (modifier.value as any) > 1) {
          if (modifier.value === -1) {
            push(maxValue);
            continue;
          }
          push(modifier.value as number);
        }
      }
    }

    if (beginLength === maxConstraints.length) push(constraintValue);
  }

  return maxConstraints;
}

export function entryIsModel(entry: Base | Link): boolean {
  if (entry.isGroup() == true) {
    return false;
  }
  return entry.getType() === "model" || entry.getType() === "crew";
}

export function entryIsCrew(entry: Base | Link): boolean {
  if (entry.isGroup() == true) {
    return false;
  }
  return entry.getType() === "crew";
}

export function entryIsWarMachine(entry: Base | Link): boolean {
  if (entry.getType() == "unit") {
    if (entry.profiles) {
      for (const prf of entry.profiles) {
        if (prf.typeName === "War Machine") {
          return true;
        }
      }
    }
  }
  return false;
}

export function getAllModels(entry: Base | Link): IModel[] {
  const result: IModel[] = [];

  entry.forEachNode((o) => {
    if (entryIsModel(o)) {
      result.push({
        name: o.getName(),
      });
    }
  });
  return result;
}

export interface BSIExtraConstraint extends BSIConstraint, BSINamed {
  parent: Base;
  modifiers: BSIModifier[];
  modifierGroups: BSIModifierGroup[];
}

export class ProfileType extends Base implements BSIProfileType {
  declare characteristicTypes: BSICharacteristicType[];
}
// const debugKeys = new Set();
export class Profile extends Base implements BSIProfile {
  declare characteristics: BSICharacteristic[];
  declare typeId: string;
  declare typeName: string;
  declare publication?: BSIPublication | undefined;
  isProfile() {
    return true;
  }
}
export class InfoGroup extends Base {
  declare characteristics: BSICharacteristic[];
  declare typeId: string;
  declare typeName: string;
  declare publication?: BSIPublication | undefined;
  isInfoGroup() {
    return true;
  }
}
export class Condition extends Base {}
export class Modifier extends Base {}
export class ModifierGroup extends Base {}

export class Rule extends Base implements BSIRule {
  declare id: string;
  declare name: string;
  declare description: string;
  declare hidden: boolean;
  declare page?: string;
  declare modifiers?: BSIModifier[] | undefined;
  declare modifierGroups?: BSIModifierGroup[] | undefined;
  getDescription(): string {
    return Array.isArray(this.description) ? this.description.join("\n") : this.description;
  }
  isRule() {
    return true;
  }
}

export function getStaticFilters(source: Base): string[] {
  const ids = ["any", source.id];
  if (source.isLink()) ids.push(source.targetId);
  const type = source.getType();
  if (type) ids.push(type);
  return ids;
}

export function getIds(source: Base): string[] {
  return source.isLink() ? [source.id, source.targetId] : [source.id];
}

export function* iterateModifierGroupsRecursive(
  groups?: Iterable<BSIModifierGroup>
): Generator<BSIModifierGroup, void, undefined> {
  if (groups) {
    for (const group of groups) {
      yield group;
      yield* iterateModifierGroupsRecursive(group.modifierGroups);
    }
  }
}

export const goodJsonArrayKeys = new Set([
  "publications",
  "costTypes",
  "profileTypes",
  "profiles",
  "categoryEntries",
  "forceEntries",
  "selectionEntries",
  "entryLinks",
  "sharedSelectionEntries",
  "sharedSelectionEntryGroups",
  "sharedProfiles",
  "sharedInfoGroups",
  "characteristics",
  "modifiers",
  "constraints",
  "categoryLinks",
  "costs",
  "conditionGroups",
  "conditions",
  "repeats",
  "selectionEntryGroups",
  "infoLinks",
  "characteristicTypes",
  "catalogueLinks",
  "modifierGroups",
  "sharedRules",
  "rules",
  "infoGroups",
]);
export const goodJsonKeys = new Set([
  ...goodJsonArrayKeys,

  "id",
  "import",
  "importRootEntries",
  "name",
  "hidden",
  "field",
  "scope",
  "value",
  "percentValue",
  "shared",
  "includeChildSelections",
  "includeChildForces",
  "childId",
  "type",
  "targetId",
  "primary",
  "typeId",
  "collective",
  "$text",
  "page",
  "typeName",
  "defaultSelectionEntryId",
  "revision",
  "battleScribeVersion",
  "authorName",
  "authorContact",
  "authorUrl",
  "library",
  "gameSystemId",
  "gameSystemRevision",
  "xmlns",
  "readme",
  "description",
  "comment",
  "publicationDate",
  "publisher",
  "publisherUrl",
  "shortName",
]);
export function rootToJson(data: Catalogue | BSICatalogue | Record<string, any>): string {
  const root: any = {
    catalogue: undefined,
    gameSystem: undefined,
  };
  const copy = { ...data }; // ensure there is no recursivity by making sure only this copy is put in the json
  if (!data.gameSystemId) {
    root.gameSystem = copy;
    delete root.catalogue;
  } else {
    root.catalogue = copy;
    delete root.gameSystem;
  }
  const stringed = JSON.stringify(root, (k, v) => {
    if (Array.isArray(v) && v.length === 0) return undefined;
    if (v === copy || goodJsonKeys.has(k) || isFinite(Number(k))) return v;
    return undefined;
  });
  return stringed;
}
export function entryToJson(data: Base | Record<string, any>, extraFields?: Set<string>): string {
  const stringed = JSON.stringify(data, function (k, v) {
    if (Array.isArray(v) && v.length === 0) return undefined;
    if (goodJsonKeys.has(k) || isFinite(Number(k)) || extraFields?.has(k)) return v;
    return undefined;
  });
  return stringed;
}

interface EntriesToJsonOptions {
  formatted?: boolean;
  forceArray?: boolean; // default is true
}
export function entriesToJson(
  data: Array<Base | Record<string, any>> | Base | Record<string, any>,
  extraFields?: Set<string>,
  options?: EntriesToJsonOptions
): string {
  const takeOutOfArray = options?.forceArray === false;
  data = Array.isArray(data) && data?.length === 1 && takeOutOfArray ? data[0] : data;
  const stringed = JSON.stringify(
    data,
    function (k, v) {
      if (goodJsonKeys.has(k) || isFinite(Number(k)) || extraFields?.has(k)) return v;
      return undefined;
    },
    options?.formatted === true ? 2 : undefined
  );
  return stringed;
}
