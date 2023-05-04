import type { BSICost, BSIModifier, BSIModifierGroup, BSIProfile, BSIRule, BSISelectionCategory } from "./bs_types";
import type {
  IArmyCategory,
  IArmyEntry,
  IArmyOption,
  IArmyRoster,
  IArmyUnit,
  IConstraint,
  ICost,
  IModel,
  ListTextFormat,
} from "../../shared/systems/army_interfaces";
import { getRandomKey } from "../../../assets/shared/util";
import AlgoSettings from "../army/algo_settings";
import { ErrorMessage, ErrorMessageWithHash } from "../error_manager";
import { BsBook } from "./bs_book";

import { getMultipliers, getRosterLimit, getInScope } from "./bs_condition";
import { cleanName, Recursive, removeOne, addOne, sortByAscending } from "./bs_helpers";
import { Category, iterateModifierGroupsRecursive, Force, entryIsModel, entryIsCrew } from "./bs_main";
import { Selector, SwitchedSelector, RootSelector } from "./bs_selector";

import { Base, Link } from "./bs_main";
import { Roster } from "./bs_system";
import {
  NRAssociationInstance,
  saveAssociations,
  loadAssociations,
  clearAssociations,
  AssociationConstraint,
} from "./bs_association";
import {
  autoCheckCreation,
  autoCheckOnHideOrMaxZero,
  autoCheckMax,
  autoCheckWhenZero,
  autoCheckCreationChilds,
} from "./bs_auto_check";
import { BSNodeState } from "./reactive/reactive_state";
import { buildErrorMessage, constraintError, removeErrorsWithDuplicatedHash } from "./bs_error";
import { Catalogue } from "./bs_main_catalogue";
import { ReactiveProflileToBSIProfile, ReactiveRuleToBSIRule } from "./reactive/reactive_info";
import * as $helpers from "./bs_helpers";
import { autoCheckCreationChildsAsync } from "./bs_async_autocheck";
import { BooksDate } from "./bs_versioning";
import { aos_warscroll_format } from "../../../assets/ts/export/aos_warscroll_formatter";
import { warhammer_feq_format } from "../../..//assets/ts/export/warhammer_formatter_feq";
import { default_format } from "../../..//assets/ts/export/default_formatter";
import { warhammer_wtc_format } from "../../..//assets/ts/export/warhammer_formatter_wtc";
(globalThis as any).$helpers = $helpers;

export class Instance implements IArmyUnit, IArmyOption, IArmyRoster, IArmyCategory, IArmyEntry {
  selector: Selector;
  selectors: Selector[] = [];
  source: Base | Link;
  propagateChanges = true;
  uid = getRandomKey();
  isDeleted?: boolean;
  isDanglingUnit?: boolean;
  catalogueId?: string;
  catalogueName?: string;
  catalogueRevision?: string;
  booksDate?: BooksDate;
  associations: NRAssociationInstance[] = [];
  associatedTo: NRAssociationInstance[] = [];
  state!: BSNodeState;
  vueHiddenKey!: number;
  vueInfoKey!: number;
  vueCostsKey!: number;
  vueAmountKey!: number;
  vueErrorsKey!: number;
  childsInitialized?: boolean;
  costsInitialized?: boolean;
  // junk functions
  globallyRestricted() {
    return false;
  }
  locallyRestricted() {
    return false;
  }
  applyModifications(): void {
    //
  }
  initVars(): void {
    //
  }
  updateDisplayStatus(): void {
    //
  }
  isScoring(): boolean {
    return false;
  }
  getDescription(): string | undefined {
    return undefined;
  }

  constructor(selector: Selector) {
    this.selector = selector;
    this.source = selector.source;
    (this.state as any) = undefined;
    if (!selector.notReactive) {
      this.vueHiddenKey = 0;
      this.vueInfoKey = 0;
      this.vueCostsKey = 0;
      this.vueAmountKey = 0;
      this.vueErrorsKey = 0;
    }
  }

  get [Symbol.toStringTag](): string {
    // Any child of a header will never be seen so it does not need to be reactive
    return this.selector.notReactive ? "ObjectNoObserve" : "Object";
  }
  initialize(): void {
    const skipState = this.isForce() && !this.propagateChanges;
    const parentState = this.getParent()?.state;

    this.state = new BSNodeState(this.source, this.uid, parentState, !skipState, false, {
      primaryChanged: (newPrimary) => this.switchCategory(newPrimary),
      categoryAdded: (category) => this.onCategoryAdded(category),
      categoryRemoved: (category) => this.onCategoryRemoved(category),
      hiddenChanged: (hidden, old) => this.onHiddenChanged(hidden, old),
      amountChanged: () => this.onAmountChanged(),
      infoChanged: () => this.onInfoChanged(),
      constraintsChanged: () => this.onConstraintsChanged(),
      costsChanged: () => this.onCostsChanged(),
    });

    if (!skipState) {
      this.state.addConstraints(this.source.constraintsIterator());
      this.state.addModifiers(this.source.modifiersIterator(), this.source.modifierGroupsIterator());
      this.state.addExtraConstraints(this.source.extraConstraintsIterator());
    }
    if (this.source.associations) {
      this.associations = this.source.associations.map((association) => new NRAssociationInstance(association, this));
    }
    if (this.source.isCatalogue()) {
      this.state.setSelections(1);
    }
  }
  get parents(): Instance[] {
    const result = [];
    let current = this as Instance;
    while (current.getParent()) {
      current = current.getParent();
      result.push(current);
    }
    return result;
  }
  get amount(): number {
    this.vueAmountKey;
    return this.state.propagate ? this.state.selections : 0;
  }
  set amount(value: number) {
    if (value) this.enable(value);
    if (!value) this.disable(0);
  }

  getCategoryIndex(): Record<string, Category> {
    return this.getRoot().categoryIndex;
  }

  getModels(): IModel[] {
    return [];
  }

  getParentGroups(): Instance[] {
    const parent_groups = [];
    let current = this.getParent();

    while (current?.isGroup()) {
      parent_groups.push(current);

      current = current.getParent();
    }
    return parent_groups;
  }

  getCategoryIcon(): string | null {
    const icons = this.getBook().getSystem().settings.icons;
    if (!icons) {
      return null;
    }
    const cat = this.getParentCategory();
    if (cat) {
      const iconFile = icons?.category_icons?.icons[cat.id];
      if (iconFile) {
        return `/settings/${this.getBook().getSystem().path}/icons/` + `${iconFile}`;
      }
    }
    return null;
  }

  shouldBeEnabled(): boolean {
    if (this.isForce()) {
      return !this.isHeader();
    }
    if (this.isUnit()) {
      return !this.isHeader();
    }
    if (!this.isQuantifiable()) {
      return true;
    }
    return false;
  }

  onAssociationChanged() {
    return;
  }

  enable(setAmount?: number) {
    this.state.propagate = this.propagateChanges;
    if (this.source.isQuantifiable() || this.source.isForce()) {
      this.state.setSelections(setAmount === undefined ? this.state.selections : setAmount);
    }

    // Dont directly initialize category childs to that they can switch to other categories on creation
    if (!this.isCategory()) {
      if (!this.state.hidden || setAmount) {
        this.initializeChilds();
      }
    }

    this.costsInitialized = true;
  }
  disable(setAmount?: number) {
    if (this.state.propagate) {
      this.state.propagate = false;
      this.state.setSelections(setAmount === undefined ? this.state.selections : setAmount);
      clearAssociations(this);
    }
    for (const type of this.selectors) {
      for (const child of type.instances) {
        if (child.shouldBeEnabled()) child.enable();
      }
    }
  }

  setIsListLoading(bool: boolean) {
    this.getParentRoster().selector.is_loading = bool;
  }

  isListLoading(): boolean {
    return this.getParentRoster().selector.is_loading;
  }
  /**
   * Returns Selections
   * Doesn't include HeaderInstances
   * Doesn't include Groups
   */
  getChildren(): Instance[] {
    return this.getSelections();
  }

  initializeChilds(): void {
    if (!this.childsInitialized) {
      this.childsInitialized = true;

      for (const child of this.source.selectionsIterator()) {
        const selector = new Selector(child, this, this.getRoot());
        this.selectors.push(selector);
        selector.initialize();
      }
      if (this.isForce()) {
        this.selectors.map((o) => o.first()?.initializeChilds());
      }
      if (this.isCategory()) {
        this.selectors.sort((a, b) => a.source.getName().localeCompare(b.source.getName()));
      } else {
        this.selectors = sortByAscending(this.selectors, (o) => (o.source.isGroup() ? 1 : 0));
      }
    }
  }

  findOption(entryId: string, name?: string): Selector | undefined {
    const entryIds = entryId.split("::");
    const parentIds = new Set<string>();

    let current = this.selector;
    let currentInstance = this as Instance;
    for (const id of entryIds) {
      // Add own id & ids of parent to list of ids to skip
      let currentParent = current;
      while (true) {
        currentParent.ids.forEach(parentIds.add, parentIds);
        const newParent = currentParent?.parent?.selector;
        if (!newParent || Object.is(currentParent, newParent)) break;
        currentParent = newParent;
      }
      // Skip this id if it is higer up in the tree
      if (parentIds.has(id)) continue;

      // find next node by id recursively
      const found = currentInstance.findRecursive(function (o) {
        return o.ids.includes(id);
      });

      if (!found) {
        const brute = this.findOptionBrute(entryIds[entryIds.length - 1], name);
        if (!brute) {
          console.warn(
            `Couldn't find option ${name}(${id}) inside ${this.source.getName()}(${this.getId()}) while pathing for ${name}`
          );
          console.warn(`Couldn't find option ${name}(${id}) with brute force`);
        }
        return brute;
      }
      current = found;
      currentInstance = found.first();
    }

    return current;
  }
  findOptionBrute(entryId: string, name?: string): Selector | undefined {
    const foundById = this.findRecursive(function (o) {
      return o.ids.includes(entryId);
    });
    if (foundById) return foundById;
    else if (name) {
      const foundByName = this.findRecursive((option) => {
        if (option.source.getName() === name) return true;
        for (const group of iterateModifierGroupsRecursive(option.source.modifierGroupsIterator())) {
          for (const modifier of group.modifiers || []) {
            if (modifier.field === "name" && modifier.value === "name") return true;
          }
        }
        for (const modifier of option.source.modifiersIterator()) {
          if (modifier.field === "name" && modifier.value === "name") return true;
        }
        return false;
      });
      return foundByName;
    }
  }

  getBattleScribePath(group = false): string {
    const base = group ? this.getParent() : this;
    if (group && !base.isGroup()) return "";

    const baseIds = base.getOptionIds();
    const resultEntryIds = [...baseIds];
    let previousIds = baseIds;
    let current = base.getParent();
    while (current.selector.isQuantifiable || current.isGroup()) {
      const link = current.source;
      if (link.isLink()) {
        // If the previous id is within a link's target options, add the link id
        // If the previous id is within a link's direct options, don't add the link id

        let found = false;
        for (const selection of link.localSelectionsIterator()) {
          if (previousIds.includes(selection.id)) {
            found = true;
            break;
          }
        }

        if (!found) {
          resultEntryIds.unshift(link.id);
        }
      }
      previousIds = current.getOptionIds();
      current = current.getParent();
    }
    return resultEntryIds.join("::");
  }

  findSelectorById(id: string): Selector | undefined {
    return this.selectors.find((o) => o.ids.includes(id));
  }

  findRecursive(
    predicate: (value: Selector, index: number, obj: Selector[]) => boolean,
    maxdepth = 0
  ): Selector | undefined {
    let next: Instance[] = [this];
    let depth = 1;
    while (next.length) {
      const stack: Instance[] = next;
      next = [];
      while (stack.length) {
        const current = stack.shift()!;
        current.initializeChilds();
        const found = current.selectors.find(predicate);
        if (found) return found;
        if (!maxdepth || depth < maxdepth) {
          next.push(...current.getChildInstances());
        }
      }
      depth++;
    }
  }

  setLastChecked(settings?: AlgoSettings, roster = this.getParentRoster()): boolean {
    if ((settings as any)?.manual === false) return false;
    roster.settings = settings;
    roster.canAutocheck = !settings?.automaticMode === false;
    roster.canModifyOtherUnit = !settings?.autofixOtherUnits === false;
    roster.lastChecked = this.selector.uid;
    roster.lastCheckedEntry = this.getParentEntry().uid;
    return true;
  }
  unsetLastChecked(roster = this.getParentRoster()) {
    roster.lastChecked = undefined;
    roster.lastCheckedEntry = undefined;
  }

  setAmount(settings: AlgoSettings | undefined, n: number): number | null {
    if (this.isConstant() && n == 0) {
      return 1;
    }

    const roster = this.getParentRoster();
    const set = this.setLastChecked(settings, roster);
    const oldValue = this.amount;
    this.amount = n; // has setter
    if (this.isHeader()) {
      const instances = this.selector.instances;
      const instance = instances[instances.length - 1];
      autoCheckCreationChilds(instance);
    } else if (!oldValue) {
      autoCheckCreationChilds(this);
      autoCheckMax(this);
    }
    const hasChanged = oldValue === this.amount ? 1 : 0;
    if (set) this.unsetLastChecked();
    return hasChanged;
  }

  /**
   * Calls callbackfn(current) with `this` and each child Instance
   */
  forEach(callbackfn: (current: Instance) => void): void {
    callbackfn(this);
    for (const instance of this.getChildInstances()) {
      if (instance.getSelfAmountElseChildsRecursive()) {
        instance.forEach(callbackfn);
      }
    }
  }
  /**
   * Calls callbackfn(current) with `this` and each child Instance
   */
  forEachIncludeInactive(callbackfn: (current: Instance) => void): void {
    callbackfn(this);
    for (const instance of this.getChildInstances()) {
      instance.forEachIncludeInactive(callbackfn);
    }
  }

  /**
   * Calls callbackfn(current) with `this` and each child Instance
   * skips iteration for all child of current instance if callback doesn't return `true`
   */
  forEachCond(callbackfn: (current: Instance) => boolean): void {
    if (callbackfn(this) === true) {
      for (const instance of this.getChildInstances()) {
        instance.forEachCond(callbackfn);
      }
    }
  }

  isConstant(): boolean {
    for (const child of this.getChildInstancesIncludingExtra()) {
      if (child.isConstant() == false) {
        return false;
      }
    }

    if (this.isGroup()) {
      return true;
    }

    let foundMin = 0;
    let foundMax = 0;
    for (const reactive of Object.values(this.state.constraints)) {
      const constraint = reactive.source;
      if (
        constraint.type === "min" &&
        constraint.scope === "parent" &&
        this.getModifiers(constraint.id).length == 0 &&
        this.getModifiersGroups(constraint.id).length == 0
      ) {
        foundMin = constraint.value;
      }
    }
    for (const reactive of Object.values(this.state.constraints)) {
      const constraint = reactive.source;

      if (
        constraint.value === foundMin &&
        constraint.type === "max" &&
        constraint.scope === "parent" &&
        this.getModifiers(constraint.id).length == 0 &&
        this.getModifiersGroups(constraint.id).length == 0
      ) {
        foundMax = constraint.value;
      }
    }
    return foundMin != 0 && foundMax != 0 && foundMax === foundMin && this.amount === foundMin;
  }

  findOrAddSelector(optionId: string, name?: string, initialize = true): Selector {
    let new_selector = this.selectors.find((o) => o.ids.includes(optionId));
    if (!new_selector) {
      const unit_selector = this.getParentForce().findRecursive((o) => o.ids.includes(optionId), 2);
      if (!unit_selector) {
        throw Error(`Couldn't find ${name}(${optionId})`);
      }
      new_selector = new SwitchedSelector(unit_selector.source, this, unit_selector.root, unit_selector);
      this.selectors.push(new_selector);
      if (initialize) new_selector.initialize();
    }
    return new_selector;
  }

  onCategoryAdded(categoryId: string) {
    if (!this.state.infoInitialized) return;
    const force = this.getParentForce();
    const catalogue = (force.source as Force).main_catalogue;
    const category = catalogue.findOptionById(categoryId);
    // console.log(`Adding profiles & rules from ${category?.getName()} category (${categoryId})`);
    if (!category) {
      console.log(`Couldn't find a category with id ${categoryId} in ${catalogue.name}`);
      return;
    }
    this.state.addExtraInfo(
      categoryId,
      category.infoRulesIterator(),
      category.infoProfilesIterator(),
      category.infoLinksIterator(),
      category.infoGroupsIterator()
    );
  }
  onCategoryRemoved(categoryId: string) {
    if (!this.state.infoInitialized) return;
    // console.log(`removing category profiles/rules ${categoryId}`);
    this.state.removeExtraInfo(categoryId);
  }
  switchCategory(newPrimary: string): void {
    const unit = this.isUnit() ? this : this.getParentUnit();
    if (!unit) return;

    const currentPrimary = this.getParentCategory();

    //- find new parent category
    const new_category = this.getParentForce()
      .getChildInstances()
      .find((o) => o.getOptionIds().includes(newPrimary));

    if (!new_category) {
      if (!this.isDanglingUnit) {
        this.getRoot().danglingUnits.push(this);
      }
      this.isDanglingUnit = true;
      return;
    }
    if (this.isDanglingUnit) {
      const root = this.getRoot();
      root.danglingUnits = root.danglingUnits.filter((o) => !Object.is(o, this));
      this.isDanglingUnit = false;
    }

    if (currentPrimary === new_category) return;
    //- add an extra selector to target for this unit if not exists
    const new_selector = new_category.findOrAddSelector(unit.getId(), unit.source.getName());
    // Prevent units being double due to the newly added selector getting initialized
    new_selector.initializedHeaders = true;

    // delete self from old parent's childs
    const previous_selector = unit.selector;
    const isHeader = unit.isHeader();
    const removeFrom = isHeader ? previous_selector.extra_instances : previous_selector.instances;
    const index = removeFrom.findIndex((o) => Object.is(o, unit));
    if (index >= 0) removeFrom.splice(index, 1);

    // set recently added selector as own
    unit.selector = new_selector;

    // add to new parent's childs
    const addTo = isHeader ? new_selector.extra_instances : new_selector.instances;
    addTo.push(unit);

    this.state.setParent(new_category.state);
  }

  getModifiers(field: string): BSIModifier[] {
    const result: BSIModifier[] = [];
    for (const modifier of this.source.modifiersIterator()) {
      if (modifier.field === field) {
        result.push(modifier);
      }
    }
    return result;
  }

  getModifiersGroups(field: string): BSIModifierGroup[] {
    const result: BSIModifierGroup[] = [];
    for (const modifier_group of this.source.modifierGroupsIterator()) {
      if (!modifier_group.modifiers) continue;
      for (const modifier of modifier_group.modifiers) {
        if (modifier.field === field) {
          result.push(modifier_group);
          break;
        }
      }
    }
    return result;
  }

  getNarrowId(): string {
    return this.source.id;
  }

  addBook(book: BsBook): Selector {
    const catalogue = book.getMainCatalogue();
    catalogue.process();
    const found = this.selectors.find((o) => o.source.id === catalogue.id);
    if (!found) {
      this.getRoot().addCatalogue(catalogue);
      const selector = new Selector(catalogue, this, this.getRoot());
      this.selectors.push(selector);
      selector.initialize();
      selector.setSelections(1);
      return selector;
    }
    return found;
  }

  getForceSelector(book: BsBook | null, id: string | null): Selector | null {
    if (book === null) return null;
    let found_force: Selector | undefined;
    let found_catalogue: Selector;
    if (this.isRoster()) {
      found_catalogue = this.getParentRoster().addBook(book);
      if (!id) return null;
      found_force = found_catalogue!.first().findSelectorById(id);
      return found_force || null;
    } //
    else {
      if (!id) return null;

      const found_catalogue = book.getMainCatalogue();
      const found_force_raw = found_catalogue.findOptionById(id);
      if (!found_force_raw) {
        throw Error("Couldn't Find Force To Add");
      }

      const found_selector = this.selectors.find((o) => o.source === found_force_raw);
      if (found_selector) return found_selector;

      const selector = new Selector(found_force_raw, this, this.getRoot());
      this.selectors.push(selector);
      return selector;
    }
  }

  insertForce(book: BsBook | null, id: string | null): Instance | null {
    const roster = this.getParentRoster();
    if (book) {
      roster.addBook(book);
      if (!id) return null;
    }

    const actualBook = book || roster.getBook();
    if (actualBook?.catalogue) actualBook.catalogue.process();
    const found_force = this.getForceSelector(actualBook, id);
    if (!found_force) {
      throw Error("Couldn't add Force");
    }

    const catalogue = actualBook.getMainCatalogue();
    const instance = new Instance(found_force);
    instance.catalogueId = catalogue.id;
    instance.catalogueName = catalogue.getName();
    instance.catalogueRevision = catalogue.revision?.toString();
    if (!this.source.isForce()) {
      roster.onForceAdded(found_force.source as Force);
    }
    found_force.addInstance(instance);
    autoCheckCreation(instance);

    return instance;
  }

  getPointsCost(): number {
    const costs = this.calcTotalCosts();
    if (costs.length == 0) {
      return 0;
    }

    if (costs.length == 1) {
      return costs[0].value;
    }

    const pts = costs.find(
      (elt) => elt.name == "pts" || elt.name == "points" || elt.typeId == "pts" || elt.typeId == "points"
    );
    if (pts) {
      return pts.value;
    }
    return 0;
  }

  calcOptionsList(
    skipModels?: boolean,
    skipModelChilds?: boolean,
    skipName?: (name: string) => boolean,
    asArray?: boolean
  ): typeof asArray extends true ? Array<string> : string {
    const stack: Instance[] = [...this.getSelections()];
    const result = [];
    for (const association of this.associations || []) {
      if (association.instances.length) {
        const members = association.instances
          .map((o) => (o.isUnit() ? o : o.getParentUnit()))
          .map((o) => o.getName() + o.getDisplayIndex())
          .join(", ");
        result.push(`${members}`);
      }
    }
    for (const association of this.associatedTo || []) {
      const instance = association.parent;
      const unit = instance.isUnit() ? instance : instance.getParentUnit();
      result.push(`${unit.getName() + unit.getDisplayIndex()}`);
    }
    while (stack.length) {
      const current = stack.pop()!;
      const isModel = current.isModel();

      // Exit before recursing
      if (current.isQuantifiable() && !current.getAmount()) continue;

      // Recurse
      if (!(isModel && skipModelChilds)) {
        stack.push(...current.getSelections());
      }

      // Exit before adding text
      if (isModel && skipModels) continue;
      if (current.isConstant() || current.isGroup()) continue;

      const cleanedName = cleanName(current.getName());
      const shouldSkipPush = skipName && skipName(cleanedName);
      if (!shouldSkipPush) {
        result.push(current.amount === 1 ? `${cleanedName}` : `${current.amount}x ${cleanedName}`);
      }

      for (const association of current.associations || []) {
        if (association.instances.length) {
          const members = association.instances
            .map((o) => (o.isUnit() ? o : o.getParentUnit()))
            .map((o) => o.getName() + o.getDisplayIndex())
            .join(", ");
          result.push(`${members}`);
        }
      }
      for (const association of current.associatedTo || []) {
        const instance = association.parent;
        const unit = instance.isUnit() ? instance : instance.getParentUnit();
        result.push(`${unit.getName() + unit.getDisplayIndex()}`);
      }
    }

    return asArray ? result : (result.join(", ") as any);
  }
  // [   "Shipwrecka Warclub",   "Spell Lores (1/1)",   "Universal Spell Lore",    "Flaming Weapon",    "Ghost-mist",    "Levitate",  ]
  calcOptionsListSkipSubUnits(includeConstants = false): string {
    const stack: Instance[] = [...this.getSelections()];
    const result = [];
    for (const association of this.associations || []) {
      if (association.instances.length) {
        const members = association.instances
          .map((o) => (o.isUnit() ? o : o.getParentUnit()))
          .map((o) => o.getName() + o.getDisplayIndex())
          .join(", ");
        result.push(`${members}`);
      }
    }
    for (const association of this.associatedTo || []) {
      const instance = association.parent;
      const unit = instance.isUnit() ? instance : instance.getParentUnit();
      result.push(`${unit.getName() + unit.getDisplayIndex()}`);
    }
    while (stack.length) {
      const current = stack.pop()!;

      if (current.isHidden()) continue;
      if (current.isOptionSubUnit()) continue;

      stack.push(...current.getSelections());

      if (current.isGroup()) continue;

      const amount = current.amount;
      if (!amount) continue;
      if (current.isConstant() && !includeConstants) continue;

      const name = cleanName(current.getName());
      result.push(amount === 1 ? `${name}` : `${amount}x ${name}`);

      for (const association of current.associations || []) {
        if (association.instances.length) {
          const members = association.instances
            .map((o) => (o.isUnit() ? o : o.getParentUnit()))
            .map((o) => o.getName() + o.getDisplayIndex())
            .join(", ");
          result.push(`${members}`);
        }
      }
      for (const association of current.associatedTo || []) {
        const instance = association.parent;
        const unit = instance.isUnit() ? instance : instance.getParentUnit();
        result.push(`${unit.getName() + unit.getDisplayIndex()}`);
      }
    }
    return result.join(", ");
  }

  calcOptionsListAOS(includeConstants = false, excludedIds: string[] = [], addParent = false): string {
    const stack: Instance[] = [
      ...this.getSelections().filter(
        (sel) =>
          !sel
            .getParentGroups()
            .map((elt) => elt.getName())
            .includes("Battalions")
      ),
    ];
    const result = [];

    for (const association of this.associations || []) {
      if (association.instances.length) {
        const members = association.instances
          .map((o) => (o.isUnit() ? o : o.getParentUnit()))
          .map((o) => o.getName() + o.getDisplayIndex())
          .join(", ");
        result.push(`${members}`);
      }
    }
    for (const association of this.associatedTo || []) {
      const instance = association.parent;
      const unit = instance.isUnit() ? instance : instance.getParentUnit();
      result.push(`${unit.getName() + unit.getDisplayIndex()}`);
    }

    while (stack.length) {
      const current = stack.pop()!;
      if (current.isHidden()) continue;
      if (current.isOptionSubUnit()) continue;

      stack.push(...current.getSelections());

      if (excludedIds.includes(current.getId())) {
        continue;
      }
      if (current.isGroup()) continue;

      const amount = current.amount;
      if (!amount) continue;
      if (current.isConstant() && !includeConstants) continue;

      const name = cleanName(current.getName());
      let prefix = "";
      if (addParent) {
        prefix = `${current.getParentGroups()[0].getName()}: `;
      }
      result.push(amount === 1 ? `${prefix}${name}` : `${prefix}${amount}x ${name}`);

      for (const association of current.associations || []) {
        if (association.instances.length) {
          const members = association.instances
            .map((o) => (o.isUnit() ? o : o.getParentUnit()))
            .map((o) => o.getName() + o.getDisplayIndex())
            .join(", ");
          result.push(`${members}`);
        }
      }
      for (const association of current.associatedTo || []) {
        const instance = association.parent;
        const unit = instance.isUnit() ? instance : instance.getParentUnit();
        result.push(`${unit.getName() + unit.getDisplayIndex()}`);
      }
    }
    return result.join(", ");
  }

  isOptionSubUnit(): boolean {
    return this.selector.isOptionSubUnit();
  }

  getSubUnits(): Recursive<Instance> {
    const stack: Selector[] = [...this.selectors];
    const result: Recursive<Instance> = {
      childs: [],
      self: this,
    };

    while (stack.length) {
      const current = stack.pop() as Selector;
      if (current.hidden) continue;
      if (current.source.isGroup()) {
        stack.push(...current.getSelections());
      } else if (current.getSelectionsCountSum()) {
        if (current.isOptionSubUnit()) {
          for (const instance of current.instances) {
            if (instance.amount) {
              result.childs.push(instance.getSubUnits());
            }
          }
        } else {
          for (const instance of current.instances) {
            if (instance.amount) {
              stack.push(...instance.selectors);
            }
          }
        }
      }
    }

    return result;
  }
  getAllSecondariesIds(): Set<string> {
    const allSecondaryIds: Set<string> = new Set<string>();
    this.forEach((child) => {
      child.getSecondaryCategories().forEach(allSecondaryIds.add, allSecondaryIds);
    });

    return allSecondaryIds;
  }
  getAllSecondaries(): string[] {
    const categoryIndex = this.getCategoryIndex();
    if (!categoryIndex) return [];

    const res = [] as string[];
    this.getAllSecondariesIds().forEach((id) => {
      if (categoryIndex[id] && categoryIndex[id].getName != null) {
        res.push(categoryIndex[id].getName());
      }
    });

    return res.sort();
  }

  hasFilter(str: string) {
    return this.state.scope.filters.has(str);
  }

  getTags(): string[] {
    return this.getAllSecondaries();
  }
  getCostIndex() {
    const root = this.getRoot();
    if (root) return root.costIndex;
    const catalogue = this.source.catalogue;
    return catalogue.costIndex ? catalogue.costIndex : catalogue.generateCostIndex();
  }

  getModifiedProfiles(): BSIProfile[] {
    this.state.initializeInfo();
    this.vueInfoKey;
    const result = [];
    for (const profile of this.state.profiles) {
      if (!profile.computed) continue;
      result.push(ReactiveProflileToBSIProfile(profile));
    }
    for (const profile of this.state.extraProfiles) {
      if (!profile.computed) continue;
      result.push(ReactiveProflileToBSIProfile(profile));
    }
    return result;
  }
  getModifiedRules(): BSIRule[] {
    this.state.initializeInfo();
    this.vueInfoKey;
    const result = [];
    for (const rule of this.state.rules) {
      if (!rule.computed) continue;
      result.push(ReactiveRuleToBSIRule(rule));
    }
    for (const rule of this.state.extraRules) {
      if (!rule.computed) continue;
      result.push(ReactiveRuleToBSIRule(rule));
    }
    return result;
  }

  getAllModifiedProfiles(): BSIProfile[] {
    if (!this.costsInitialized) {
      this.enable();
      autoCheckCreationChilds(this);
    }
    const res: BSIProfile[] = [];
    this.forEachCond((elt) => {
      if (!elt.state.selections && elt !== this) return false;
      res.push(...elt.getModifiedProfiles());
      return true;
    });
    return res;
  }
  getAllModifiedRules(): BSIRule[] {
    if (!this.costsInitialized) {
      this.enable();
      autoCheckCreationChilds(this);
    }
    const res: Record<string, BSIRule> = {};
    this.forEachCond((elt) => {
      if (!elt.state.selections && elt !== this) return false;
      for (const rule of elt.getModifiedRules()) res[rule.id] = rule;
      return true;
    });
    return Object.values(res);
  }

  isHidden(): boolean {
    this.vueHiddenKey;
    if (this.isDanglingUnit || this.isDeleted) {
      return true;
    } else {
      return this.state.hidden;
    }
  }

  onHiddenChanged(hidden: boolean, old: boolean): void {
    if (old) {
      this.initializeChilds();
      autoCheckWhenZero(this, true);
    }
    if (hidden && !old) autoCheckOnHideOrMaxZero(this);
    if (hidden && !this.amount) {
      this.disable();
    }
    this.vueHiddenKey += 1;
  }

  onConstraintsChanged(): void {
    this.vueErrorsKey += 1;
  }
  onInfoChanged(): void {
    this.vueInfoKey += 1;
  }
  onAmountChanged(): void {
    this.vueAmountKey += 1;
  }
  onCostsChanged(): void {
    this.vueCostsKey += 1;
  }

  isCollapsible(): boolean {
    return Boolean(this.selectors.length && !this.isUnit());
  }

  isUnit(): boolean {
    return this.selector.isUnit;
  }

  isSubUnit(): boolean {
    return this.selector.isSubUnit;
  }

  isGroup(): boolean {
    return this.source.isGroup();
  }

  isRoster(): this is RootInstance {
    return this.source.isRoster();
  }

  isForce(): boolean {
    return this.source.isForce();
  }

  isCategory(): boolean {
    return this.source.isCategory();
  }

  isCatalogue(): boolean {
    return this.source.isCatalogue();
  }

  isQuantifiable(): boolean {
    return this.source.isQuantifiable();
  }

  getOptionIds(): string[] {
    return this.selector.ids;
  }

  getId(): string {
    return this.source.getId();
  }

  getUid(): string {
    return this.uid;
  }

  getBook(): BsBook {
    const catalogue = this.getParentCatalogue();
    return catalogue ? catalogue.selector.getBook() : this.getRoot().book!;
  }

  getParent(): Instance {
    return this.selector.parent;
  }

  getParentEntry(): Instance {
    let current = this.getParent() || this;
    while (current.isGroup() && current.getParent() && !current.isForce()) {
      current = current.getParent();
    }
    return current;
  }

  findParent(predicate: (value: Instance) => unknown): Instance | undefined {
    let current: Instance = this.getParent();
    while (current && !predicate(current)) {
      current = current.getParent();
    }
    return current;
  }

  getParentCatalogue(): Instance {
    return this.findParent((o) => o.isCatalogue()) || this;
  }
  getParentCategory(): Instance {
    return this.findParent((o) => o.isCategory())!;
  }
  getParentUnit(): Instance {
    return this.findParent((o) => o.isUnit())!;
  }
  getParentRoster(): RootInstance {
    return (this.findParent((o) => o.isRoster()) || this) as RootInstance;
  }
  getParentForce(): Instance {
    return this.findParent((o) => o.isForce()) || this;
  }

  getRoot(): Roster {
    return this.selector.root;
  }

  checkOrNumeric(): string {
    if (this.selector.isLimitedTo1) return "check";
    return "numeric";
  }

  getOptionType(): string {
    if (this.isUnit()) return "unit";
    if (this.isGroup()) return "group";
    if (this.isSubUnit()) return "entry";
    return this.checkOrNumeric();
  }

  getCosts(): ICost[] {
    const result = [] as ICost[];
    if (!this.source.isEntry()) {
      return result;
    }
    const costs = this.state.costs;
    const index = this.getCostIndex();
    for (const cost in costs) {
      result.push({
        name: index[cost].name,
        value: costs[cost] * 1,
        typeId: cost,
      });
    }
    return result;
  }

  getTotalCosts(): { [key: string]: ICost } {
    if (!this.costsInitialized) {
      this.enable();
      autoCheckCreationChilds(this);
    }
    this.vueCostsKey;
    const result = {} as { [key: string]: ICost };
    const costs = this.state.totalCosts;
    const index = this.getCostIndex();
    for (const cost in costs) {
      result[cost] = {
        name: index[cost].name || cost,
        value: costs[cost],
        typeId: cost,
      };
    }
    return result;
  }

  calcTotalCosts(): ICost[] {
    return Object.values(this.getTotalCosts());
  }

  calcTotalCostsForOne(): ICost[] {
    const result: ICost[] = [];
    const total = this.calcTotalCosts();
    if (this.isSubUnit()) {
      return total;
    }
    for (const elt of total) {
      result.push({
        name: elt.name,
        typeId: elt.typeId,
        value: elt.value / (this.getAmount() || 1),
      });
    }
    return result;
  }

  /**
   * Returns the total costs as if amount is 1
   */

  getSecondaryCategories(): Set<string> {
    return this.state.categories;
  }

  getSelectionCategories(): BSISelectionCategory[] {
    const result = {} as Record<string, BSISelectionCategory>;
    const cur = this.getSecondaryCategories();
    const categoryIndex = this.getCategoryIndex();
    for (const id of cur) {
      if (id === "(No Category)") continue;
      result[id] = {
        id: id,
        name: categoryIndex[id].getName(),
        entryId: id,
      };
    }
    if (this.isUnit()) {
      const prim = this.getParentCategory();
      const id = prim.source.getId();
      result[id] = {
        id: id,
        entryId: id,
        name: prim.source.getName(),
        primary: true,
      };
    }
    return Object.values(result);
  }

  getPrimaryCategory(): string | undefined {
    return this.state.primary;
  }

  getModifiedConstraints() {
    return Object.values(this.state.constraints);
  }

  getModifiedExtraConstraints() {
    return Object.values(this.state.extraConstraints);
  }

  getUIConstraints(type: string, skipHighScopes?: boolean): IConstraint[] {
    const res: IConstraint[] = [];
    const entry = this.getParentEntry();
    const entry_parent_uids = new Set(entry.parents.map((o) => o.uid));

    for (const reactive of this.getModifiedConstraints().filter((elt) => elt.source.type === type)) {
      if (skipHighScopes) {
        const scope = getInScope(this, reactive.source.scope, reactive.source.shared);
        if (!scope.length || entry_parent_uids.has(scope[0].uid)) {
          continue;
        }
      }
      const constraint = reactive.source;
      const costName =
        this.getBook()
          .getCosts()
          .find((elt) => (elt.typeId = constraint.field))?.name || "";

      let total: number = reactive.value;
      if (constraint.percentValue) {
        if (constraint.isLimit) {
          total = Math.round((total * getRosterLimit(this, constraint.field)) / 100);
        } else {
          const scope = (this.state.find(constraint.scope, constraint.shared)! as BSNodeState).scope;
          total = Math.round((total * scope.get({ field: constraint.field, childId: "any" })) / 100);
        }
      }

      res.push({ field: costName, value: total, typeId: constraint.field });
    }
    return res;
  }

  getMinConstraints(skipHighScopes = true): IConstraint[] {
    return this.getUIConstraints("min", skipHighScopes);
  }

  getMaxConstraints(skipHighScopes = false): IConstraint[] {
    return this.getUIConstraints("max", skipHighScopes);
  }
  checkConstraints(): ErrorMessageWithHash[] | null {
    if (this.isListLoading()) return null;
    this.vueErrorsKey;
    const result = [] as ErrorMessageWithHash[];
    if (this.amount === 0 && this.isHidden()) return null;
    if (this.isHidden()) {
      const amount = this.amount;
      if (amount === 0) return result;
      if (amount > 0 && (this.source.isGroup() || this.source.isEntry())) {
        result.push({
          type: 1,
          unit: this.getParentUnit(),
          msg: buildErrorMessage(this.getName(), "hidden", amount, "selections"),
          hash: this.uid + "hidden",
        });
      }
    }
    if (!this.isLegalOption()) {
      result.push({
        type: 1,
        unit: this.getParentUnit(),
        msg: buildErrorMessage(this.getName(), "legal"),
        parent: this.getParent(),
        hash: this.uid + "legal",
      });
    }
    const set = new Set<string>();
    const isHeader = this.isHeader();
    for (const obj of Object.values(this.state.constraints)) {
      if (obj.computed) {
        if (isHeader && obj.source.type !== "min") continue;
        if (!this.amount && obj.source.type === "max") continue;
        const error = constraintError(this, obj.source, obj.value);
        if (!set.has(error.msg)) {
          set.add(error.msg);
          result.push(error);
        }
      }
    }
    if (!this.isQuantifiable() || this.amount) {
      for (const obj of Object.values(this.state.extraConstraints)) {
        if (obj.computed) {
          if (isHeader && obj.source.type !== "min") continue;
          if (!this.amount && obj.source.type === "max") continue;

          const error = constraintError(this, obj.source, obj.value);
          if (!set.has(error.msg)) {
            set.add(error.msg);
            result.push(constraintError(this, obj.source, obj.value));
          }
        }
      }
    }
    if (this.amount && this.associations) {
      for (const association of this.associations) {
        result.push(...association.getErrors());
      }
    }
    return result;
  }

  getAssociationConstraints(): AssociationConstraint[] {
    return this.source.associationConstraints || [];
  }

  getSelfAmountElseChilds(): number {
    return this.selector.isQuantifiable ? this.amount : this.state.scope.get({ field: "selections", childId: "any" });
  }

  getAmountChildsRecursive(): number {
    return this.state.scope.get({ field: "selections", childId: "any", includeChildSelections: true });
  }

  getSelfAmountElseChildsRecursive(): number {
    return this.selector.isQuantifiable
      ? this.amount
      : this.state.scope.get({ field: "selections", childId: "any", includeChildSelections: true });
  }

  /**
   * Returns Selections
   * Doesn't include HeaderInstances
   * Doesn't include Groups
   * Doesn't include Child Force Selections
   */
  getSelections(): Instance[] {
    const result: Instance[] = [];
    for (const selector of this.selectors) {
      const isGroupLike = !selector.isQuantifiable && selector.instances.length === 1;
      if (this.isForce() && selector.source.isForce()) continue;
      if (isGroupLike) {
        result.push(...selector.first().getSelections());
      } //
      else {
        result.push(...selector.instances);
      }
    }
    return result;
  }

  getUnits(): Instance[] {
    return this.getChildInstances();
  }

  getCategories(): Instance[] {
    return this.getChildInstances().filter((o) => o.isCategory());
  }

  /**
   * Returns Selections
   * Includes Groups
   * Doesn't include HeaderInstances
   */
  getChildInstances(): Instance[] {
    const result: Instance[] = [];
    this.selectors.forEach((o) => {
      result.push(...o.instances);
    });
    return result;
  }

  /**
   * Returns Forces
   * Doesn't include HeaderInstances
   */
  getForces(recursive = true): Instance[] {
    if (this.source.isCatalogue()) return this.getChildInstances().filter((o) => o.isForce());
    const stack: Instance[] = this.getChildInstances();
    const result = [];
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur.isCatalogue()) {
        stack.push(...cur.getChildInstances());
      }
      if (cur.isForce()) {
        result.push(cur);
        if (recursive) {
          stack.push(...cur.getChildInstances());
        }
      }
    }
    return result;
  }

  /**
   * Returns Selections
   * Includes HeaderInstances
   * Includes Groups
   */
  getChildInstancesIncludingExtra(): Instance[] {
    const result: Instance[] = [];
    for (const selector of this.selectors) {
      selector.initialize_headers();
      result.push(...selector.extra_instances);
      result.push(...selector.instances);
    }
    return result;
  }

  /**
   * Returns Selections
   * Includes HeaderInstances
   * Includes Groups
   */
  getOptions(): Instance[] {
    return this.getChildInstancesIncludingExtra();
  }

  getAmount(): number {
    if (!this.selector.isQuantifiable) {
      return 1;
    }

    return this.amount;
  }

  getSelectionCount(stopAt: string | null): number {
    const amount = this.getSelfAmountElseChilds();
    if (!stopAt) return amount;

    const multipliers = getMultipliers(this, amount);
    let index = 0;
    let parent = this.getParent();
    while (parent && parent.getId() !== stopAt) {
      parent = parent.getParent();
      if (parent) index++;
    }
    return multipliers[index];
  }

  customName?: string = undefined;
  setCustomName(name: string) {
    this.customName = name;
  }
  getCustomName(): string | undefined {
    return this.customName;
  }

  getName(): string {
    if (this.isRoster() && this.customName) return this.customName;
    return this.state.name || "";
  }
  getMaxCosts() {
    return this.getParentRoster().getMaxCosts();
  }
  setMaxCosts(costs: ICost[]) {
    return this.getParentRoster().setMaxCosts(costs);
  }
  getDisplayIndex(): string {
    if (this.selector.instances.length > 1) {
      const num = this.selector.instances.findIndex((o) => o === this) + 1;
      return `[${num}]`;
    }
    return "";
  }
  getModelName(): string {
    let res = this.source.getName();
    if (this.getBook().getSystem().settings.extractModelCountFromName) {
      res = res.replace(/^[0-9]+ */, "");
    }
    return res;
  }

  getModelAmount(): number {
    if (this.getBook().getSystem().settings.extractModelCountFromName) {
      const match = this.getName().match(/([0-9]+) .*/);
      if (match && match[1]) {
        return parseInt(match[1]);
      } else {
        return 1;
      }
    } else {
      return this.getSelectionCount("root");
    }
  }

  getOptionsLabel(): string | null {
    return this.isCollapsible() ? this.getName() : null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  delete(_settings?: AlgoSettings): any {
    // Prevent causing effects delete twice
    if (this.isDeleted) return;

    //Hide the unit from roster view to make ui feel faster when deleting
    this.isDeleted = true;
    this.vueHiddenKey++;

    this.disable(0);
    this.state.disable();
    clearAssociations(this);
    for (const selector of this.selectors) selector.delete();

    this.selector.deleteInstance(this);
    const roster = this.getParentRoster();
    if (this.source.isForce() && !this.getParent().source.isForce() && this.propagateChanges) {
      roster.onForceDeleted(this.source);
    }
  }

  toJson(): ExportedNode {
    return this.selector.toListJson();
  }

  toJsonObject(): ExportedNode {
    const stack1 = [];
    const stack2 = [];

    for (const child of this.getSelections()) {
      stack1.push(child);
      stack2.push(this.getParent());
    }

    const result: ExportedNode = {
      name: this.getName(),
      option_id: this.source.getId(),
      options: this.getChildInstances()
        // Skip 0 amountss
        .filter((o) => {
          if (o.isRoster() || o.isCatalogue() || o.isForce()) return true;
          if (!o.getSelfAmountElseChildsRecursive()) return false;
          return true;
        })
        .map((o) => o.toJsonObject()),
    };
    // Add fields only if they exist
    if (this.customName) {
      result.customName = this.customName;
    }
    if (this.selector.isQuantifiable) {
      result.amount = this.amount;
    }
    if (this.isForce() && this.catalogueId) {
      result.catalogue_id = this.catalogueId;
    }
    if (this.isRoster() && this.maxCosts && Object.keys(this.maxCosts).length) {
      result.maxCosts = this.maxCosts;
    }

    saveAssociations(this, result);
    return result;
  }
  async loadBooksFromOptionsJson(json: ExportedNode[]): Promise<Record<string, BsBook>> {
    const books = this.getBooksInOptionsJson(json);
    const loaded = {} as Record<string, BsBook>;
    const booksDate = this.getParentRoster().booksDate;
    const system = this.getBook().getSystem();
    const promises = [];
    for (const bookid of books) {
      const promise = system.findBookByBsid(bookid, booksDate).then((book) => {
        if (!book) {
          throw Error(`Couldn't load book ${bookid}`);
        }
        book.catalogue.process();
        loaded[book.catalogue.id] = book;
      });
      promises.push(promise);
    }
    await Promise.all(promises);
    return loaded;
  }
  async loadFromInstanceJson(json: ExportedNode, clone = false) {
    const loaded = await this.loadBooksFromOptionsJson(json.options);
    if (this.selector.isQuantifiable) this.amount = json.amount || 1;
    if (json.customName) this.customName = json.customName;
    if (json.maxCosts && this.isRoster()) {
      this.setMaxCosts(json.maxCosts);
    }
    if (json.catalogue_id) this.catalogueId = json.catalogue_id;
    if (json.uid && !clone) this.uid = json.uid;
    loadAssociations(this, json);
    this._loadFromInstanceJson(json, loaded, clone);
  }
  _loadFromInstanceJson(json: ExportedNode, books: Record<string, BsBook>, clone = false, div = 1) {
    // if (this.selector.isQuantifiable) this.amount = json.amount || 1;
    if (json.customName) this.customName = json.customName;
    if (json.maxCosts && this.isRoster()) {
      this.setMaxCosts(json.maxCosts);
    }
    if (json.catalogue_id) this.catalogueId = json.catalogue_id;
    if (json.uid && !clone) this.uid = json.uid;
    loadAssociations(this, json);
    this._loadOptionsFromJson(json.options, books, clone, div);
  }
  _getBooksInOptionsJson(options: ExportedNode[] | Record<number, ExportedNode>, result: ExportedNode[] = []) {
    for (const node of Object.values(options)) {
      if (node.catalogue_id) {
        result.push(node);
        continue;
      } else {
        this._getBooksInOptionsJson(node.options, result);
      }
    }
    return result;
  }
  getBooksInOptionsJson(options: ExportedNode[] | Record<number, ExportedNode>) {
    const result = new Set<string>();

    const forces = [] as ExportedNode[];
    this._getBooksInOptionsJson(options, forces);
    for (let i = 0; i < forces.length; i++) {
      const current = forces[i];
      if (current.catalogue_id) {
        result.add(current.catalogue_id);
        forces.push(...(current.options || []));
      }
    }
    return result;
  }
  async loadOptionsFromJson(options: ExportedNode[], clone = false) {
    const loaded = await this.loadBooksFromOptionsJson(options);
    this._loadOptionsFromJson(options, loaded, clone);
  }
  _loadOptionsFromJson(
    options: ExportedNode[] | Record<number, ExportedNode>,
    books: Record<string, BsBook>,
    clone = false,
    div = 1
  ) {
    const optionsArray = Object.values(options);
    for (const node of optionsArray) {
      try {
        const book = node.catalogue_id ? books[node.catalogue_id] : undefined;
        this.initializeChilds();
        const selector = book
          ? this.getForceSelector(book as BsBook, node.option_id)
          : this.findOrAddSelector(node.option_id, node.name, true);
        if (!selector) {
          throw Error(`Failed to add ${node.name} in ${this.getName()}`);
        }
        // selector.initialize();

        if (selector.isInstanced) {
          const itAmount = node.amount ? node.amount / div : 1;
          for (let i = 0; i < itAmount; i++) {
            const instance = selector.addInstance();
            instance._loadFromInstanceJson(node, books, clone, itAmount * div);
            if (book) {
              instance.catalogueName = book.getName();
              instance.catalogueId = node.catalogue_id;
              instance.catalogueRevision = book.getRevision();
            }
            if (selector.source.isForce() && !selector.parent.source.isForce()) {
              this.getParentRoster().onForceAdded(selector.source);
            }
          }
        } else {
          const first = selector.first();
          if (selector.isQuantifiable) {
            const addAmount = node.amount ? node.amount / div : 1;
            first.amount += addAmount;
          }
          first._loadFromInstanceJson(node, books, clone, div);
        }
      } catch (e) {
        console.warn("Failed to load", node.name, "in", this.getName(), e);
        continue;
      }
    }
  }
  isLegalOption(): boolean {
    if (this.isRoster()) return true;

    const parent = this.selector instanceof SwitchedSelector ? this.selector.source_selector.parent : this.getParent();
    if (parent.isRoster()) return true;

    for (const entry of parent.source.selectionsIterator()) {
      if (entry.getId() === this.source.getId()) {
        return true;
      }
    }
    return false;
  }
  insertUnit(settings: AlgoSettings, unit: Instance, clone?: any): Instance {
    const categ = unit.getParentCategory();
    const categ_sel = this.selectors.find((o) => o.getId() === categ.getId());
    if (!categ_sel) throw Error(`Couldn't find the category for this unit ${categ.getName()}`);
    const unit_sel = categ_sel.first().selectors.find((o) => o.getId() === unit.getId());
    if (!unit_sel) throw Error(`Couldn't find the unit ${unit.getName()} within ${categ.getName()}`);

    if (clone) {
      this.setIsListLoading(true);
      const instance = unit_sel.addInstance();
      instance.loadFromInstanceJson(clone);
      this.setIsListLoading(false);
      return instance;
    } //
    else {
      const result = new Instance(unit_sel);
      unit_sel.addInstance(result);
      autoCheckCreation(result);
      return result;
    }
  }

  async dupe(): Promise<ErrorMessage[]> {
    this.setIsListLoading(true);
    const instance = this.selector.addInstance();
    await instance.loadFromInstanceJson(this.toJsonObject(), true);
    this.setIsListLoading(false);
    return [];
  }

  get id(): string {
    return this.getId();
  }
  get name(): string {
    return this.getName();
  }

  async getStartingCosts(): Promise<ICost[]> {
    return this.calcTotalCosts();
  }

  /** Returns HeaderInstances for Categories */
  getAvailableCategories(): Instance[] {
    return this.getChildInstances().filter((o) => !o.isHidden() && o.isCategory());
  }

  /**  Returns HeaderInstances for Units */
  getAvailableUnits(): Instance[] {
    return this.getExtraInstances().filter((o) => !o.isHidden() && o.isUnit());
  }

  /** Returns HeaderInstances */
  getExtraInstances(): HeaderInstance[] {
    const result: Instance[] = [];
    // get first actual instance as header has no childs
    for (const selector of this.selector.first()?.selectors || []) {
      selector.initialize_headers();
      result.push(...selector.extra_instances.filter((o) => o instanceof HeaderInstance));
    }
    return result as HeaderInstance[];
  }

  /** Returns HeaderInstances for Forces */
  getAvailableForces(): Instance[] {
    if (this.isRoster()) {
      const result: Instance[] = [];
      for (const selector of this.selectors) {
        for (const force of selector.first().getExtraInstances()) {
          if (!force.isForce()) continue;
          if (force.source?.childs.find((o) => o.childs?.length)) result.push(force);
        }
      }
      return sortByAscending(result, (o) => o.getName());
    } else {
      const result = this.getExtraInstances().filter((o) => o.isForce());
      return sortByAscending(result, (o) => o.getName());
    }
  }

  /** Returns HeaderInstances for Forces */
  getAvailableChildForces(book: BsBook): { name: string; id: string }[] {
    let found_catalogue: Selector | undefined;
    if (this.isRoster()) {
      found_catalogue = this.findSelectorById(book!.getMainCatalogue().id);
      if (!found_catalogue) found_catalogue = this.addBook(book!);
    } else {
      found_catalogue = this.getParentCatalogue().selector;
    }
    const self = found_catalogue.first().findOption(this.getId());
    if (!self) return [];
    if (!self.source.isForce() || !self.source.forces) return [];
    return self.source.forces
      .filter((o) => o.isForce())
      .map((o) => {
        return { name: o.getName(), id: o.id };
      });
  }

  getErrors(): ErrorMessage[] {
    const all_errors: ErrorMessageWithHash[] = [];
    this.forEachCond((inst) => {
      // Dont check childs or self if hidden & unselected (invisible)
      const amount = inst.amount;
      if (inst.isHidden() && amount === 0) return false;
      const errors = inst.checkConstraints();
      if (errors) all_errors.push(...errors);
      // Dont check childs if zero of self
      if (inst.isQuantifiable() && amount === 0) return false;
      if (inst.isHeader()) return false;
      return true;
    });
    const result = removeErrorsWithDuplicatedHash(all_errors);
    return result;
  }

  getAssociations(): NRAssociationInstance[] {
    if (!this.amount || !this.associations) return [];
    return this.associations;
  }

  validateArmy(): ErrorMessage[] {
    return this.getErrors();
  }

  countVisibleActivatedChildren(): number {
    let res = 0;
    for (const elt of this.getSelections()) {
      if (!elt.isGroup()) {
        res += elt.getAmount();
      }
    }
    return res;
  }

  showConstraints(): boolean {
    return this.isGroup();
  }

  isModel(): boolean {
    let res = entryIsModel(this.source);

    const isUnitWithoutModels = this.isUnit() && this.hasModels() == false;

    // In AOS single model units are not set
    if (isUnitWithoutModels && res == false && this.getBook().getSystem().settings.characteristicDefinesModel) {
      const profile = this.getModifiedProfiles()
        .map((elt) => elt.characteristics)
        .flat()
        .flat()
        .filter((char) => char.name === this.getBook().getSystem().settings.characteristicDefinesModel);
      if (profile.length) {
        res = true;
      }
    }

    return res;
  }

  isCrew(): boolean {
    return entryIsCrew(this.source);
  }

  getIncludedBooks(): number[] {
    const booksToLoad = this.selectors.map((o) => o.getBook().getId());
    return booksToLoad;
  }

  getAllModels(): Instance[] {
    const res = [] as Instance[];
    this.forEach((child) => {
      if (child.isModel()) {
        res.push(child);
      }
    });
    return res;
  }

  hasModels(): boolean {
    let res = false;
    this.forEach((child) => {
      if (entryIsModel(child.source) == true) {
        res = true;
      }
    });
    return res;
  }

  calcTotalUnitSize(): number {
    let res = 0;
    for (const model of this.getAllModels()) {
      if (model.isCrew() == false) {
        res += model.getModelAmount();
      }
    }
    return res;
  }

  exportArmy(textFormat: ListTextFormat = { format: "NR", asText: true }): string {
    switch (textFormat.format) {
      case "WTC":
        return warhammer_wtc_format(this, textFormat);
      case "FEQ":
        return warhammer_feq_format(this, textFormat);
      case "Warscroll":
        return aos_warscroll_format(this, textFormat);
      case "NR":
        return default_format(this, textFormat);
      default: {
        const short = this.getBook().getSystem().short;
        if (short === "wh40k" || short === "tgs") {
          return warhammer_wtc_format(this, textFormat);
        }
        return default_format(this, textFormat);
      }
    }
  }

  exportFormats(): string[] {
    return this.getBook().getSystem().settings.exportFormats || ["NR"];
  }

  hasMultipleCatalogues(): boolean {
    return this.getParentRoster().selectors.length > 1;
  }

  getParentCatalogueName(): string {
    return this.getParentCatalogue().getName();
  }

  maxPlus(): boolean {
    for (const constraint of Object.values(this.state.constraints)) {
      if (constraint.source.type !== "max") continue;
      if (constraint.source.scope !== "max") continue;

      for (const reactive of this.state.modifiers[constraint.source.id]) {
        const modifier = reactive.source;
        if (!reactive.computed || modifier.repeats?.length) {
          if (modifier.type === "increment" && (modifier.value as any) > 0) {
            return true;
          }
          if (modifier.type === "decrement" && (modifier.value as any) < 0) {
            return true;
          }
        }
        if (modifier.type === "set") {
          if (!reactive.computed && ((modifier.value as any) > constraint.value || modifier.value === -1)) {
            return true;
          }
          if (reactive.computed && (modifier.value as any) < constraint.value) {
            return true;
          }
        }
      }
    }
    return false;
  }
  isHeader(): boolean {
    return false;
  }
}

export class RootInstance extends Instance {
  onCatalogueAdded(source: Catalogue) {
    if (source.roster_constraints) {
      const added = [];
      for (const constraint of source.roster_constraints) {
        const prev = addOne(this.cataloguesUsage, `${constraint.id}::${constraint.childId}`);
        if (prev === 0) added.push(constraint);
      }
      if (added.length) {
        this.state.addExtraConstraints(added);
      }
    }
  }
  onCatalogueRemoved(source: Catalogue) {
    if (source.roster_constraints) {
      const removed = [];
      for (const constraint of source.roster_constraints) {
        const count = removeOne(this.cataloguesUsage, constraint.id);
        if (count === 0) removed.push(constraint);
      }
      if (removed.length) {
        this.state.addExtraConstraints(removed);
      }
    }
    const index = this.selectors.findIndex((o) => o.source.id === source.id);
    if (index !== -1) this.selectors.splice(index, 1);
  }
  onForceDeleted(force: Force) {
    const catalogue = force.main_catalogue;
    const count = removeOne(this.cataloguesUsage, catalogue.id);
    if (count === 0) this.onCatalogueRemoved(catalogue);
  }
  /** Dont call with child forces as its bugged in bs and doesnt do that.  (bug in bs)*/
  onForceAdded(force: Force) {
    const catalogue = force.main_catalogue;
    const prev = addOne(this.cataloguesUsage, catalogue.id);
    if (prev === 0) this.onCatalogueAdded(catalogue);
  }
  source!: Roster;
  selector!: RootSelector;
  canAutocheck?: boolean;
  canModifyOtherUnit?: boolean;
  lastChecked?: string;
  lastCheckedEntry?: string;
  settings?: AlgoSettings;
  maxCosts: BSICost[] = [];
  cataloguesUsage = {};
  extraConstraints = {};
  setMaxCosts(costs: BSICost[]) {
    this.state.setMaxCosts(costs);
    this.maxCosts = costs;
  }
  getMaxCosts(): ICost[] {
    const costs = {} as Record<string, ICost>;
    const costTypes = this.getCostIndex();
    for (const cost of Object.values(costTypes)) {
      costs[cost.id] = {
        typeId: cost.id,
        name: cost.name,
        value: undefined as any,
      };
    }
    for (const maxCost of this.maxCosts) {
      costs[maxCost.typeId] = maxCost;
    }
    return Object.values(costs);
  }

  constructor(arg: RootSelector) {
    super(arg);
  }
  initialize() {
    super.initialize();
    this.state.setSelections(1);
  }
}
//Instance that is only used for displaying without affecting the roster
export class HeaderInstance extends Instance {
  propagateChanges = false;

  constructor(parent: Selector) {
    super(parent);
  }
  isHeader(): boolean {
    return true;
  }
  getErrors(): ErrorMessage[] {
    const all_errors = this.checkConstraints();
    if (!all_errors) return [];
    const result = removeErrorsWithDuplicatedHash(all_errors);
    return result;
  }

  getCosts(): ICost[] {
    return Object.values(this.getTotalCosts());
  }

  getOptions(): [] {
    return [];
  }

  getOptionType(): string {
    return this.selector.isLimitedTo1 ? "check" : "plus";
  }

  get amount(): number {
    this.vueAmountKey;
    return this.selector.instances.length;
  }
  set amount(amount: number) {
    this.selector.setSelections(amount);
  }

  getBooksDate(): BooksDate | undefined {
    return this.booksDate;
  }
  async getStartingCosts(type = "sync"): Promise<ICost[]> {
    this.vueCostsKey;
    if (!this.costsInitialized && this.isHeader()) {
      if (type === "async") {
        await new Promise((resolve) => setImmediate(resolve));
        this.enable();
        // autoCheckCreationChilds(this);
        await autoCheckCreationChildsAsync(this);
      } else if (type === "sync") {
        this.enable();
        autoCheckCreationChilds(this);
      }
    }
    const result = [] as ICost[];
    const costs = this.state.totalCosts;
    const index = this.getCostIndex();
    for (const cost in costs) {
      result.push({
        name: index[cost].name || cost,
        value: costs[cost],
        typeId: cost,
      });
    }
    return result;
  }
}

export interface ExportedNode {
  option_id: string;
  catalogue_id?: string;
  options: ExportedNode[];
  name?: string;
  amount?: number;
  customName?: string;
  maxCosts?: BSICost[];
  associated?: Array<{
    uid: string;
    label: string;
    labelMembers: string;
  }>;
  uid?: string;
}
