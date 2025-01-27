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
  BSIData,
  BSIGameSystem,
  NRAssociation,
  AssociationConstraint,
  BSIModifierType,
  BSILocalConditionGroup,
} from "./bs_types";
import type { EditorBase, Catalogue } from "./bs_main_catalogue";
import { clone, isObject } from "./bs_helpers";
import { splitExactlyConstraints } from "./exactly_constraints";
import { splitExactlyConstraintsModifiers } from "./exactly_constraints";

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

const arrayKeysWithoutId = ["conditions", "conditionGroups", "localConditionGroups", "modifiers", "modifierGroups", "repeats"];
export const goodKeys = new Set([...arrayKeys, ...arrayKeysWithoutId]);
export const goodKeysWiki = new Set(arrayKeys);
export function getDataObject(data: BSIData | Catalogue): BSIGameSystem | BSICatalogue {
  if ((data as Catalogue).isCatalogue && (data as Catalogue).isCatalogue()) {
    return data as BSICatalogue;
  }
  if ((data as BSIData).gameSystem) return (data as BSIData).gameSystem!;
  if ((data as BSIData).catalogue) return (data as BSIData).catalogue!;
  throw Error("getDataObject data argument is not a valid system or catalogue");
}

export function getDataDbId(data: BSIData | Catalogue): string {
  if ((data as Catalogue).isCatalogue && (data as Catalogue).isCatalogue()) {
    if (data.id && data.gameSystemId) {
      return `${data.gameSystemId}-${data.id}`;
    }
    if (data.id) {
      return `${data.id}`;
    }
  }
  if (data.catalogue) {
    return `${data.catalogue.gameSystemId}-${data.catalogue.id}`;
  }
  if (data.gameSystem) {
    return data.gameSystem.id;
  }
  throw Error("getDataId data argument is not a valid system or catalogue");
}
/**
 * This is a base class with generic functions for all nodes in the BSData xml/json
 * Usage: Add it as a prototype on the json to use the functions with Object.setPrototypeOf
 */
export class Base implements BSModifierBase {
  // Data
  id!: string;
  type?: string;
  subType?: "mount" | "crew" | "unit-group";
  shared?: boolean;
  import?: boolean;
  collective?: boolean;
  comment?: string;
  publicationId!: string;
  typeName?: string;
  typeId?: string;
  categoryEntryId?: string; // Legacy categories

  // Data - Modifiable
  name!: string;
  hidden!: boolean;
  value?: number | string | boolean;
  page?: string;
  defaultAmount?: number;

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
  profileTypes?: ProfileType[];
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
  // repeats?: BSIRepeat[];
  conditions?: BSICondition[];
  conditionGroups?: BSIConditionGroup[];
  localConditionGroups?: BSILocalConditionGroup[];

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
  flatten?: boolean;
  collapsible?: boolean;
  sortIndex?: number;
  alias?: string[];
  noindex?: boolean;


  constructor(json: any) {
    return Object.setPrototypeOf(json, Object.getPrototypeOf(this));
  }
  get url(): string {
    return "%{main_catalogue|catalogue}/%{id}/%{getName}";
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
    return this.getCatalogue().getGameSystem();
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
  isCategory(): this is Category | Link<Category> {
    return false;
  }
  isRoster(): boolean {
    return false;
  }
  isQuantifiable(): boolean {
    return false;
  }
  isEntry(): this is Entry {
    return false;
  }
  isIdUnique() {
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
    return this.subType ?? this.type;
  }
  getTypeName(): string | undefined {
    return this.typeName;
  }
  getCategoryEntryId(): string | undefined {
    return this.categoryEntryId;
  }
  getHidden(): boolean | undefined {
    return this.hidden;
  }
  getPage(): string | undefined {
    return this.page;
  }
  getName(): string {
    return this.name ?? "";
  }
  getDefaultAmount(): number | string | undefined {
    return this.defaultAmount;
  }
  isCollective(): boolean | undefined {
    return this.collective;
  }
  isCollapsible(): boolean | undefined {
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
  isEmptyNode(): boolean {
    for (const key of isNonEmptyIfHasOneOf) {
      if ((this as any)[key] !== undefined) return false;
    }
    return true;
  }
  *forcesIterator(): Iterable<Force> {
    return;
  }
  *associationsIterator(): Iterable<NRAssociation> {
    if (this.associations) {
      yield* this.associations;
    }
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

  *iterateSelectionEntries(): Iterable<Base> {
    if (this.selectionEntries) yield* this.selectionEntries;
    if (this.entryLinks) yield* this.entryLinks;
    if (this.selectionEntryGroups) yield* this.selectionEntryGroups;
  }

  *iterateSelectionEntriesWithRoot(): Iterable<Base> {
    if (this.selectionEntries) yield* this.selectionEntries;
    if (this.entryLinks) yield* this.entryLinks;
    if (this.selectionEntryGroups) yield* this.selectionEntryGroups;
  }

  *iterateRootEntries(): Iterable<Base> {
    if (this.selectionEntries) yield* this.selectionEntries;
    if (this.entryLinks) yield* this.entryLinks;
    if (this.selectionEntryGroups) yield* this.selectionEntryGroups;
    if (this.forceEntries) yield* this.forceEntries;
  }

  *iterateAllRootEntries(): Iterable<Base> {
    if (this.selectionEntries) yield* this.selectionEntries;
    if (this.entryLinks) yield* this.entryLinks;
    if (this.selectionEntryGroups) yield* this.selectionEntryGroups;
    if (this.forceEntries) yield* this.forceEntries;
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

  // console.log("foreachobjectwhitelist", keys);

  forEachObject<T extends Base>(callbackfn: (value: T, parent: T) => unknown, whiteList = goodKeys, maxDepth?: number) {
    let stack = [this as any];
    let next = []
    let depth = 0;
    // const keys = {} as any;

    while (stack.length) {
      while (stack.length) {
        const current = stack.pop()!;
        for (const key in current) {
          const value = current[key];
          if (!whiteList.has(key)) {
            // addOne(keys, key);
            continue;
          }
          //  If Array: add each object inside array if (Array.isArray(value)) {

          if (isObject(value)) {
            if (Array.isArray(value)) {
              if (value.length && isObject(value[0])) {
                for (let i = 0; i < value.length; i++) {
                  const cur = value[i];
                  if (callbackfn(cur, current) !== false) {
                    next.push(cur);
                  }
                }
              }
            } else {
              if (callbackfn(value, current) !== false) {
                next.push(value);
              }
            }
          }
        }
      }
      stack = next;
      next = []
      depth++;
      if (maxDepth && depth >= maxDepth) break;
    }
    // console.log("foreachobjectwhitelist", keys);
  }
  forEachObjectWhitelist<T extends Base>(callbackfn: (value: T, parent: T) => unknown, whiteList = goodKeys, maxDepth?: number) {
    return this.forEachObject(callbackfn, whiteList, maxDepth);
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
  find_recursive(cb: (opt: Base) => boolean, includeTargets = false) {
    let stack = [this as any];
    let next = []

    while (stack.length) {
      while (stack.length) {
        const current = stack.pop()!;
        for (const key in current) {
          const value = current[key];
          if (!goodKeys.has(key)) continue;
          if (isObject(value)) {
            if (Array.isArray(value)) {
              if (value.length && isObject(value[0])) {
                for (let i = 0; i < value.length; i++) {
                  const cur = value[i];
                  const res = cb(cur)
                  if (res) return cur;
                  if (res !== false) {
                    next.push(cur);
                    if (cur.target && includeTargets) next.push(cur.target)

                  }
                }
              }
            } else {
              const res = cb(value)
              if (res) return value;
              if (res !== false) {
                next.push(value);
                if (value.target && includeTargets) next.push(value.target)
              }

            }
          }
        }
      }
      stack = next;
      next = []
    }
  }
  find(cb: (opt: Base) => boolean, includeTargets = false) {
    let stack = [this as any];
    let next = []
    let first = true;
    while (stack.length) {
      while (stack.length) {
        const current = stack.pop()!;
        for (const key in current) {
          const value = current[key];
          if (!goodKeys.has(key)) continue;
          if (isObject(value)) {
            if (Array.isArray(value)) {
              if (value.length && isObject(value[0])) {
                for (let i = 0; i < value.length; i++) {
                  const cur = value[i];
                  if (cb(cur)) return cur;
                  next.push(cur);
                  if (cur.target && includeTargets) next.push(cur.target)
                }
              }
            } else {
              if (cb(value)) return value;
              next.push(value);
              if (value.target && includeTargets) next.push(value.target)
            }
          }
        }
      }
      if (!first) return
      first = false;
      stack = next;
      next = []
    }
  }
  getCosts(): BSICost[] {
    return this.costs || [];
  }

  getPrimaryCategory(): string {
    for (const categoryLink of this.categoryLinks || []) {
      if (categoryLink.primary) return categoryLink.targetId;
    }
    return this.getCategoryEntryId() ?? UNCATEGORIZED_ID;
  }
  getPrimaryCategoryLink(): CategoryLink | undefined {
    for (const categoryLink of this.categoryLinks || []) {
      if (categoryLink.primary) return categoryLink;
    }
  }
  // Packs all of a constraint's modifiers with itself
  getPackedConstraint(constraint: BSIConstraint): BSIExtraConstraint {
    const result = Object.assign({}, constraint) as BSIExtraConstraint;
    result.name = this.getName();
    result.parent = this;
    const useTarget = constraint.shared || this instanceof CategoryLink;
    result.childId = this.isLink() && useTarget ? this.targetId : this.id;
    result.modifiers = [];
    for (const modifier of this.modifiersIterator()) {
      if (modifier.field === constraint.id || (modifier.field === "hidden" && constraint.type === 'min' && !this.isCategory())) result.modifiers.push(modifier);
    }
    result.modifierGroups = [];
    for (const group of this.modifierGroupsIterator()) {
      current: for (const sub_grp of iterateModifierGroupsRecursive([group])) {
        for (const modifier of sub_grp.modifiers || []) {
          if (modifier.field === constraint.id || (modifier.field === "hidden" && constraint.type === 'min' && !this.isCategory())) {
            result.modifierGroups.push(group);
            break current;
          }
        }
      }
    }
    return result;
  }
  // Modifies a constraints query to have the same effect when checked from a roster/force.
  // packs modifiers & modifiers groups inside it
  getBoundConstraint(constraint: BSIConstraint): BSIExtraConstraint {
    const result = this.getPackedConstraint(constraint);
    result.scope = "self"
    return result;
  }
  getChildBoundConstraints(skipGroup?: boolean): BSIExtraConstraint[] {
    const result = [];
    for (const child of this.selectionsIterator()) {
      if (skipGroup && child.isGroup()) continue;
      for (const constraint of child.constraintsIterator()) {
        if (constraint.type === "min" || constraint.type === "exactly") {
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
  isEntry(): this is Entry {
    return true;
  }
  isQuantifiable(): boolean {
    return true;
  }
  isIdUnique() {
    return true;
  }
}
export class Group extends Base {
  declare defaultSelectionEntryId?: string;
  getDefaultSelectionEntryId() {
    return this.defaultSelectionEntryId;
  }
  isGroup(): this is Group {
    return true;
  }
  isIdUnique() {
    return true;
  }
}
export class Link<T extends Base = Group | Entry> extends Base {
  targetId!: string;
  declare target: T;
  isLink(): this is Link {
    return true;
  }
  isGroup(): this is Link<Group> {
    return this.target?.isGroup();
  }
  isCategory(): this is Link<Category> {
    return this.target?.isCategory();
  }
  isQuantifiable(): boolean {
    return this.target?.isQuantifiable();
  }
  isEntry(): this is Entry {
    return this.target?.isEntry();
  }
  isIdUnique() {
    return false;
  }
  isProfile(): this is Profile | InfoLink<Profile> {
    return this.target?.isProfile() || false;
  }
  isRule(): this is Rule | InfoLink<Rule> {
    return this.target?.isRule() || false;
  }
  isInfoGroup(): this is InfoGroup | InfoLink<InfoGroup> {
    return this.target?.isInfoGroup() || false;
  }
  isUnit(): boolean {
    if (this.target.isUnit()) return true;
    for (const categoryLink of this.categoryLinks || []) {
      if (categoryLink.primary) return true;
    }
    return false;
  }
  isCollapsible(): boolean | undefined {
    return this.collective || this.target.collective;
  }
  getId(): string {
    return this.targetId;
  }
  getType(): string | undefined {
    return this.target?.getType();
  }
  getPage(): string | undefined {
    return this.page || this.target?.page;
  }
  getHidden(): boolean | undefined {
    return this.target.hidden || this.hidden;
  }
  getDefaultSelectionEntryId() {
    return (
      (this as any as Group).defaultSelectionEntryId || (this.target as any as Group)?.getDefaultSelectionEntryId()
    );
  }
  getCategoryEntryId(): string | undefined {
    return this.categoryEntryId ?? this.target?.categoryEntryId;
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore: TS2611
  get associationConstraints(): AssociationConstraint[] | undefined {
    return this.target.associationConstraints;
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore: TS2611
  getAssociations(): NRAssociation[] | undefined {
    return this.associations || this.target.associations;
  }

  isCollective(): boolean | undefined {
    return super.isCollective() || this.target?.isCollective();
  }
  *extraConstraintsIterator(): Iterable<BSIExtraConstraint> {
    yield* this.target.extraConstraintsIterator();
    yield* super.extraConstraintsIterator();
  }
  *associationsIterator(): Iterable<NRAssociation> {
    yield* this.target.associationsIterator();
    yield* super.associationsIterator();
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
    if (this.target) yield* this.target.constraintsIterator();
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
  getDefaultAmount(): number | string | undefined {
    return this.defaultAmount === undefined ? this.target.defaultAmount : this.defaultAmount;
  }
  getName(): string {
    return this.target?.name ?? this.name ?? "";
  }
  getPrimaryCategory(): string {
    for (const categoryLink of this.categoryLinks || []) {
      if (categoryLink.primary) return categoryLink.targetId;
    }
    for (const categoryLink of this.target?.categoryLinks || []) {
      if (categoryLink.primary) return categoryLink.targetId;
    }
    return this.getCategoryEntryId() ?? UNCATEGORIZED_ID;
  }
  getPrimaryCategoryLink(): CategoryLink | undefined {
    for (const categoryLink of this.categoryLinks || []) {
      if (categoryLink.primary) return categoryLink;
    }
    for (const categoryLink of this.target?.categoryLinks || []) {
      if (categoryLink.primary) return categoryLink;
    }
  }
  getCosts(): BSICost[] {
    const d = {} as Record<string, BSICost>;
    if (this.target?.costs) {
      for (const cost of this.target.costs) d[cost.typeId] = cost;
    }
    if (this.costs) {
      for (const cost of this.costs) d[cost.typeId] = cost;
    }
    return Object.values(d);
  }
}
(Link.prototype as any).keyInfoCache = {};

export class InfoLink<T extends Rule | InfoGroup | Profile = Rule | InfoGroup | Profile> extends Link {
  declare target: T;
  declare type: "infoGroup" | "profile" | "rule";
  getTypeName() {
    return (this.target as Profile)?.typeName;
  }
  getTypeId() {
    return (this.target as Profile)?.typeId;
  }
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
  isIdUnique() {
    return !this.isEmptyNode();
  }
}
export class Force extends Base {
  declare name: string;
  declare id: string;
  childForcesLabel?: string;
  categories!: Array<Category | CategoryLink>;
  forces?: Force[];
  main_catalogue!: Catalogue;
  isForce(): this is Force {
    return true;
  }
  isEntry(): this is Entry {
    return true;
  }
  isIdUnique() {
    return true;
  }

  *infoLinksIterator(): Iterable<InfoLink> {
    if (this.isForce()) {
      const cat = this.main_catalogue;
      for (const imported of cat.imports) {
        yield* imported.infoLinksIterator();
      }
      yield* cat.infoLinksIterator();
    }
    yield* super.infoLinksIterator()
  }

  *infoRulesIterator(): Iterable<Rule> {
    if (this.isForce()) {
      const cat = this.main_catalogue;
      for (const imported of cat.imports) {
        yield* imported.infoRulesIterator();
      }
      yield* cat.infoRulesIterator();
    }
    yield* super.infoRulesIterator()
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
    if (this.forceEntries) {
      yield* this.forceEntries;
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

export interface BSIExtraConstraint extends BSIConstraint, BSINamed {
  parent: Base;
  modifiers: BSIModifier[];
  modifierGroups: BSIModifierGroup[];
}

export class ProfileType extends Base implements BSIProfileType {
  declare characteristicTypes: BSICharacteristicType[];
  declare sortIndex?: number;
}
// const debugKeys = new Set();
export class Profile extends Base implements BSIProfile {
  declare characteristics: BSICharacteristic[];
  declare typeId: string;
  declare typeName: string;
  declare publication?: BSIPublication | undefined;
  isProfile(): this is Profile {
    return true;
  }
  getTypeName() {
    return this.typeName;
  }
  getTypeId() {
    return this.typeId;
  }
  isIdUnique() {
    return true;
  }
}
export class Characteristic extends Base implements BSICharacteristic {
  declare typeId: string;
  declare $text: string | number;
  originalValue?: string | number | boolean | undefined;
  getLabel() {
    if (this.catalogue) {
      return this.catalogue.findOptionById(this.typeId)?.getName() ?? this.typeId;
    }
    return this.typeId;
  }
  getTypeName() {
    return this.getLabel();
  }
  getName() {
    return `${this.getLabel()} = ${this.$text}`;
  }
}

export class InfoGroup extends Base {
  declare characteristics: BSICharacteristic[];
  declare typeId: string;
  declare typeName: string;
  declare publication?: BSIPublication | undefined;
  isInfoGroup(): this is InfoGroup {
    return true;
  }
  isIdUnique() {
    return true;
  }
}

export const basicQueryFields = new Set(["any", "model", "unit", "upgrade", "mount", "crew", "entry", "roster", "group", "force", "category"]);
export class Condition extends Base {
  declare childId: string;
  declare scope: string;
  declare type: string;
  declare includeChildSelections: boolean;
  declare includeChildForces: boolean;
  declare percentValue?: boolean;
}
export class Constraint extends Condition {
  declare type: "min" | "max" | "exactly";
}
export class Modifier extends Base implements BSIModifier {
  declare type: BSIModifierType;
  declare field: "category" | "name" | "hidden" | string; //costId
  declare value: number | string | boolean;
  declare affects?: string;
  declare scope?: string;
  declare join?: string;
  declare arg?: string;

}
export class ModifierGroup extends Base implements BSIModifierGroup { }
export class ConditionGroup extends Base {
  declare type: "or" | "and"
}

export class LocalConditionGroup extends Base implements BSILocalConditionGroup {
  declare type: "atLeast" | "greaterThan" | "atMost" | "lessThan" | "equalTo" | "notEqualTo";
  declare scope: string;
  declare field: string;
  declare childId?: string | undefined;
  declare includeChildSelections?: boolean | undefined;
  declare includeChildForces?: boolean | undefined;
  declare percentValue?: boolean | undefined;

  declare repeats: number;
  declare value: number;
  declare roundUp?: boolean | undefined;
}

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
  isRule(): this is Rule {
    return true;
  }
  isIdUnique() {
    return true;
  }
}

export function getStaticFilters(source: Base): string[] {
  const ids = ["any", source.id];
  if (source.isLink()) ids.push(source.targetId);

  if (source.isForce()) ids.push("force")
  //@ts-ignore
  else if (source.isEntry()) ids.push("entry")
  //@ts-ignore
  else if (source.isGroup()) ids.push("group")
  //@ts-ignore
  else if (source.isCategory()) ids.push("category")
  //@ts-ignore
  else if (source.isRoster()) ids.push("roster")


  const type = source.getType();
  if (type) ids.push(type);
  return ids;
}

export function getIds(source: Base): string[] {
  return source.isLink() ? [source.id, source.targetId] : [source.id];
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

export const BaseChilds = [
  "costTypes",
  "costs",

  "categoryEntries",

  "forceEntries",

  "sharedSelectionEntries",
  "selectionEntries",

  "sharedSelectionEntryGroups",
  "selectionEntryGroups",

  "entryLinks",
  "infoLinks",
  "categoryLinks",
  "catalogueLinks",

  "sharedProfiles",
  "profiles",
  "profileTypes",
  "characteristics",
  "characteristicTypes",

  "sharedInfoGroups",
  "infoGroups",

  "sharedRules",
  "rules",

  "publications",
  "associations",

  "modifierGroups",
  "modifiers",
  "constraints",
  "conditionGroups",
  "localConditionGroups",
  "conditions",
  "repeats",
] as const;
export type BaseChildsT = (typeof BaseChilds)[number];
export const goodJsonArrayKeys = new Set(BaseChilds);
export const goodJsonKeys = new Set([
  ...goodJsonArrayKeys,

  "defaultAmount",
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
  "publisherId",
  "publisherUrl",
  "shortName",
  "repeats",
  "roundUp",
  "defaultCostLimit",
  "publicationId",


  //queries
  "affects",

  // associations
  "label",
  "labelMembers",
  "maxAssociationsPerMember",
  "ids",
  "min",
  "max",
  "of",
  "info",

  // groups
  "flatten",
  "collapsible",

  // entries
  "sortIndex",
  "subType",

  "arg", // (replace modifier)
  "join", // (apprend/prepend modifier)
  "negative", // (constraints)
  "message", // (constraints)
  "childForcesLabel",
  "affects",

  // refs
  "alias",
  "noindex",

  //Legacy
  "costTypeId",
  "profileTypeId",
  "characteristicTypeId",
]);
export function rootToJson(data: Catalogue | BSICatalogue | Record<string, any>, fixRoot = false): string {
  const root: any = {
    catalogue: undefined,
    gameSystem: undefined,
  };
  const copy = { ...data }; // ensure there is no recursivity by making sure only this copy is put in the json
  if (!data.gameSystemId) {
    root.gameSystem = copy;
    root.gameSystem.type = "gameSystem";
    delete root.catalogue;
  } else {
    root.catalogue = copy;
    root.catalogue.type = "catalogue";
    delete root.gameSystem;
  }

  const obj = fixRoot ? getDataObject(root) : root;
  const stringed = JSON.stringify(obj, (k, v) => {
    if (Array.isArray(v) && v.length === 0) return undefined;
    if (v === copy || goodJsonKeys.has(k) || isFinite(Number(k))) {
      if (isObject(v)) {
        return splitExactlyConstraints(splitExactlyConstraintsModifiers(v));
      }
      return v;
    }
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

export function forEachObjectWhitelist2<T extends Base>(
  current: Base,
  callbackfn: (value: T, parent: T) => unknown,
  whiteList = goodKeys
) {
  for (const key in current) {
    if (whiteList.has(key)) {
      const value = current[key as keyof typeof current];
      if (Array.isArray(value)) {
        if (value.length && isObject(value[0])) {
          for (let i = 0; i < value.length; i++) {
            const cur = value[i] as T;
            callbackfn(cur, current as T);
            forEachObjectWhitelist2(cur, callbackfn, whiteList);
          }
        }
      }
    }
  }
}

export function convertRuleToProfile(rule: BSIRule): BSIProfile {
  return {
    characteristics: [
      {
        name: "Descrption",
        typeId: "description",
        $text: Array.isArray(rule.description) ? rule.description[0] : rule.description,
      },
    ],
    id: rule.id,
    name: rule.name,
    hidden: rule.hidden,
    typeId: "rules",
    typeName: "Rules",
  };
}


export interface AffectsQuery {
  self?: boolean;
  entries?: boolean;
  forces?: boolean;
  recursive?: boolean;
  filterBy?: string;
  affectsWhat?: string;
}

export function construct_affects_query(fields: AffectsQuery) {
  const result = [];
  if (fields.self && (fields.entries || fields.forces)) result.push("self");
  if (fields.entries) result.push("entries");
  if (fields.forces) result.push("forces");
  if (fields.recursive) result.push("recursive");
  if (fields.filterBy && fields.filterBy !== "any") result.push(fields.filterBy);
  if (fields.affectsWhat && fields.affectsWhat !== "entries") result.push(fields.affectsWhat);
  const combined = result.join(".");
  return combined;
}
export function deconstruct_affects_query(query?: string): AffectsQuery {
  const selectors = ["profiles", "constraints", "costs", "rules", "categories"];
  const filterBy = [];
  const flags = {
    self: false,
    entries: false,
    forces: false,
    recursive: false,
  } as Record<string, boolean>;

  const split = (query || "").split(".");
  let affectsWhat = "entries";

  for (let i = 0; i < split.length; i++) {
    const cur = split[i];
    if (selectors.includes(cur)) {
      affectsWhat = split.slice(i).join(".");
      break;
    }
    if (cur in flags) {
      flags[cur] = true;
      continue;
    }
    filterBy.push(cur);
  }

  if (!flags.entries && !flags.forces) {
    flags.self = true;
  }

  return {
    ...flags,
    filterBy: filterBy.length ? filterBy.join(".") : "any",
    affectsWhat,
  };
}