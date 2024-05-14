import { InfoIndex } from "~/assets/shared/battlescribe/bs_info_index";
import { isScopeValid, validScopes } from "./bs_condition";
import type { ItemTypeNames } from "./bs_editor";
import {
  addObj,
  addObjIfMissing,
  addObjUnique,
  clone,
  generateBattlescribeId,
  groupBy,
  popObj,
  sortBy,
  textSearchRegex,
} from "./bs_helpers";
import {
  BSIExtraConstraint,
  Base,
  Category,
  Condition,
  Constraint,
  Force,
  ILLEGAL_ID,
  Link,
  Profile,
  Rule,
  UNCATEGORIZED_ID,
  basicQueryFields,
  forEachObjectWhitelist2,
  goodJsonArrayKeys,
  goodKeys,
  goodKeysWiki,
} from "./bs_main";
import { getModifierOrConditionParent } from "./bs_modifiers";
import type { BSCatalogueManager } from "./bs_system";
import type {
  BSICatalogue,
  BSICondition,
  BSIConstraint,
  BSICostType,
  BSIGameSystem,
  BSIInfoLink,
  BSIProfile,
  BSIProfileType,
  BSIPublication,
  BSIReference,
  BSIRule,
} from "./bs_types";
import type { GameSystemFiles } from "./local_game_system";

if (typeof $toRaw === "undefined") {
  globalThis.$toRaw = function (o) {
    return o;
  };
}
export interface IErrorMessage {
  msg: string;
  severity?: "error" | "warning" | "info" | "debug";
  source?: any;
  id?: string;
  other?: any;
  extra?: string;
}

export interface WikiLink extends Link {
  parent: WikiBase;
  refs?: WikiLink[];
}
export interface WikiBase extends Base {
  parent?: WikiBase;
  refs?: WikiLink[];
}
export interface EditorBase extends Base {
  parent?: EditorBase;
  refs?: EditorBase[];
  other_refs?: EditorBase[];
  catalogue: Catalogue;

  parentKey: string & keyof EditorBase;
  editorTypeName: ItemTypeNames;

  showInEditor?: boolean;
  showChildsInEditor?: boolean;
  highlight?: boolean;

  errors?: IErrorMessage[];
}
export class CatalogueLink extends Base {
  targetId!: string;
  declare target: Catalogue;
  importRootEntries?: boolean;
  /** Most code that checks for links expects entryLinks or categoryLinks, catalogueLinks are specially handled */
  isLink() {
    return false;
  }
}
export class Publication extends Base implements BSIPublication {
  shortName?: string;
  publisher?: string;
  publicationDate?: string | number;
  publisherUrl?: string;
}

export class Catalogue extends Base {
  declare name: string;
  declare id: string;
  library?: boolean;
  revision?: number;

  gameSystemId?: string;
  gameSystemRevision?: number;

  authorContact?: string;
  authorName?: string;
  authorUrl?: string;

  battleScribeVersion?: string;

  costTypes?: BSICostType[];
  catalogueLinks?: CatalogueLink[];

  // Processed
  gameSystem!: Catalogue;
  initialized?: boolean;
  declare loaded?: boolean;
  loaded_wiki?: boolean;
  loaded_editor?: boolean;

  imports!: Catalogue[];
  importsWithEntries!: Catalogue[];
  index!: Record<string, Base>;
  /**
   * Used for quickly finding references to rules within rules & profiles
   */
  infoIndex?: InfoIndex;
  unresolvedLinks: Record<string, Array<(Condition | Link) & EditorBase>> = {};

  forces!: Force[];
  categories!: Category[];
  units!: Array<Base | Link>;
  roster_constraints!: BSIExtraConstraint[];

  manager!: typeof isEditor extends true ? GameSystemFiles : BSCatalogueManager;
  book!: any;
  short!: string;
  version!: string;
  nrversion!: string;
  lastUpdated: string | undefined;
  costIndex!: Record<string, BSICostType>;

  fullFilePath?: string;

  errors?: IErrorMessage[];
  reset() {
    delete this.initialized;
    delete this.loaded;
    delete this.loaded_editor;
    delete this.loaded_wiki;
    for (const imported of this.imports || []) {
      delete imported.initialized;
      delete imported.loaded;
      delete imported.loaded_editor;
      delete imported.loaded_wiki;
    }
  }
  init(deleteBadLinks = true) {
    if (this.initialized) return;
    this.initialized = true;
    this.generateImports(deleteBadLinks);
    this.resolveAllLinks(deleteBadLinks);
    this.generateCostIndex();
    this.indexInfo();
  }

  process() {
    if (this.loaded) return;
    this.loaded = true;
    this.init();
    const units = this.generateUnits();
    const categories = this.generateCategories(units);
    this.categories = Object.values(categories);
    this.generateForces(categories, this.forcesIterator());
    this.generateExtraConstraints();
    // console.log("processed", this.name)
  }
  processForWiki(system: Record<string, any>) {
    if (this.loaded_wiki) return;
    this.loaded_wiki = true;
    this.process();
    const rulesObj: Record<string, any> = system.rules || {};
    (system as any).rules = rulesObj;

    this.imports.forEach((imported) => {
      addObjUnique(imported as any, "refs", this);
    });
    function proc(cur: WikiBase, parent: WikiBase) {
      (cur as WikiBase).parent = parent as WikiBase;
      if (cur.target) addObjUnique(cur.target as any, "refs", parent as WikiBase);
      if (cur instanceof Rule) {
        rulesObj[cur.id] = cur;
      }
    }
    forEachObjectWhitelist2(this, proc, goodKeysWiki);

    for (const force of this.forces || []) {
      (force as any).parent = this;
      for (const category of force.categories) {
        (category as any).parent = force;
      }
    }
  }
  processForEditor() {
    if (this.loaded_editor) return;
    this.loaded_editor = true;
    this.init(false);

    if (this.gameSystem) {
      addObjUnique(this.gameSystem as any, "refs", this);
    }

    forEachObjectWhitelist2<EditorBase>(
      this,
      (cur, parent) => {
        cur.parent = parent;
        cur.catalogue = this;
        if (!cur.refs) {
          cur.refs = [];
        }
        if (!cur.other_refs) {
          cur.other_refs = [];
        }
        if (cur.target) {
          addObjUnique(cur.target as EditorBase, "refs", cur);
        }
        if (cur.isProfile() && !cur.isLink()) {
          const target = this.findOptionById(cur.typeId) as EditorBase;
          if (target) {
            addObjUnique(target, "refs", cur);
          }
        }
        const value = (cur as any).value;
        if (value) {
          const target = this.findOptionById(value) as EditorBase;
          if (target) {
            addObjUnique(target, "other_refs", cur);
          }
        }
      },
      goodJsonArrayKeys,
    );
    forEachObjectWhitelist2<EditorBase>(this, (cur) => cur.isLink() ? this.updateLink(cur) : this.refreshErrors(cur), goodJsonArrayKeys);
  }
  get url(): string {
    return "%{book}";
  }
  isCatalogue(): this is Catalogue {
    return true;
  }
  isGameSystem(): boolean {
    return this.gameSystemId === this.id || !this.gameSystemId;
  }
  isIdUnique() {
    return true;
  }
  getCatalogue() {
    return this;
  }
  getGameSystem() {
    if (this.isGameSystem()) return this;
    return this.gameSystem;
  }
  getSystemId(): string {
    return this.isGameSystem() ? this.id : this.gameSystemId!;
  }
  addError(obj: EditorBase, newError: IErrorMessage & { id: string }) {
    this.removeError(obj, newError.id);
    if (!obj.errors) {
      obj.errors = [];
    }
    if (!this.errors) {
      this.errors = [];
    }
    obj.errors.push(newError);
    this.errors.push(newError);
  }
  onRemoveError(error: IErrorMessage, recurse = true) {
    if (this.errors) {
      const idx = this.errors.indexOf(error);
      if (idx >= 0) {
        this.errors.splice(idx, 1);
      }
    }

    if (error.other && recurse) {
      const other = error.other as EditorBase;
      other.getCatalogue()?.removeError(other, "duplicate-id-1", false);
      other.getCatalogue()?.removeError(other, "duplicate-id-2", false);
    }
  }
  removeErrors(obj: EditorBase) {
    obj.errors?.forEach((o) => this.onRemoveError(o));
    if (obj instanceof Constraint) {
      obj.catalogue.updateConstraint(obj as Constraint & EditorBase, true);
    }
    delete obj.errors;
  }
  removeError(obj: EditorBase, id: string, event = true) {
    if (obj.errors?.length) {
      obj.errors = obj.errors.filter((error) => {
        if (error.id === id) {
          this.onRemoveError(error, event);
        }
        return error.id !== id;
      });
    }
  }
  *iterateCategoryEntries(): Iterable<Category> {
    for (const catalogue of this.imports) {
      for (const category of catalogue.categoryEntries || []) {
        yield category;
      }
    }
    if (this.categoryEntries) yield* this.categoryEntries;
  }
  *iterateCostTypes(): Iterable<BSICostType> {
    for (const catalogue of this.imports) {
      for (const costType of catalogue.costTypes || []) {
        yield costType;
      }
    }
    if (this.costTypes) yield* this.costTypes;
  }

  *forcesIterator(): Iterable<Force> {
    for (const catalogue of this.imports) {
      for (const force of catalogue.forceEntries || []) {
        yield force;
      }
    }
    if (this.forceEntries) yield* this.forceEntries;
  }
  *forcesIteratorRecursive(): Iterable<Force> {
    if (this.forces) {
      for (const force of this.forces) {
        yield force;
        yield* force.forcesIteratorRecursive();
      }
    }
  }

  *iterateProfileTypes(): Iterator<BSIProfileType> {
    for (const catalogue of this.imports) {
      if (catalogue.profileTypes) {
        yield* catalogue.profileTypes;
      }
    }

    if (this.profileTypes) {
      yield* this.profileTypes;
    }
  }
  *iteratePublications(): Iterable<BSIPublication> {
    for (const catalogue of this.imports) {
      for (const publication of catalogue.publications || []) {
        yield publication;
      }
    }
    for (const publication of this.publications || []) {
      yield publication;
    }
  }
  *iterateSelectionEntries(): Iterable<Base> {
    for (const catalogue of this.importsWithEntries) {
      for (const entry of catalogue.sharedSelectionEntries || []) {
        yield entry;
      }
      for (const entry of catalogue.sharedSelectionEntryGroups || []) {
        yield entry;
      }
    }

    //if (this.selectionEntries) yield* this.selectionEntries;
    //if (this.entryLinks) yield* this.entryLinks;
    if (this.sharedSelectionEntries) yield* this.sharedSelectionEntries;
    if (this.sharedSelectionEntryGroups) yield* this.sharedSelectionEntryGroups;
  }
  *iterateAllImported(): Iterable<Base> {
    const shared = [
      "sharedSelectionEntries",
      "sharedSelectionEntryGroups",
      "sharedProfiles",
      "sharedRules",
      "sharedInfoGroups",
      "categoryEntries",
    ];
    const root = ["rules", "entryLinks", "profiles", "infoGroups", "selectionEntries", "selectionEntryGroups"];
    for (const catalogue of this.importsWithEntries) {
      for (const key of root) {
        for (const entry of catalogue[key as keyof Catalogue] || []) {
          if (entry.import !== false) yield entry;
        }
      }
    }
    for (const catalogue of this.imports) {
      for (const key of shared) {
        for (const entry of catalogue[key as keyof Catalogue] || []) {
          yield entry;
        }
      }
    }
    for (const key of root) {
      for (const entry of this[key as keyof Catalogue] || []) {
        yield entry;
      }
    }
    for (const key of shared) {
      for (const entry of this[key as keyof Catalogue] || []) {
        yield entry;
      }
    }
  }

  *iterateSelectionEntriesWithRoot(): Iterable<Base> {
    for (const catalogue of this.importsWithEntries) {
      for (const entry of catalogue.selectionEntries || []) {
        if (entry.import !== false) yield entry;
      }
      for (const entry of catalogue.entryLinks || []) {
        if (entry.import !== false) yield entry;
      }

      for (const entry of catalogue.sharedSelectionEntries || []) {
        yield entry;
      }
      for (const entry of catalogue.sharedSelectionEntryGroups || []) {
        yield entry;
      }
    }

    if (this.selectionEntries) yield* this.selectionEntries;
    if (this.entryLinks) yield* this.entryLinks;
    if (this.sharedSelectionEntries) yield* this.sharedSelectionEntries;
    if (this.sharedSelectionEntryGroups) yield* this.sharedSelectionEntryGroups;
  }

  *iterateAllRootEntries(): Iterable<Base> {
    for (const catalogue of this.importsWithEntries) {
      for (const entry of catalogue.selectionEntries || []) {
        if (entry.import !== false) yield entry;
      }
      for (const entry of catalogue.entryLinks || []) {
        if (entry.import !== false) yield entry;
      }
    }

    if (this.selectionEntries) yield* this.selectionEntries;
    if (this.entryLinks) yield* this.entryLinks;
  }

  *entriesIterator(): Iterable<Base | Link> {
    if (this.sharedSelectionEntries) yield* this.sharedSelectionEntries;
    if (this.selectionEntries) yield* this.selectionEntries;
    if (this.sharedSelectionEntryGroups) yield* this.sharedSelectionEntryGroups;
    if (this.selectionEntryGroups) yield* this.selectionEntryGroups;
    if (this.entryLinks) yield* this.entryLinks;
  }

  forEachNode(callbackfn: (value: Base | Link) => unknown): void {
    callbackfn(this);
    if (this.childs) for (const e of this.childs) e.forEachNode(callbackfn);
  }
  *selectionsIterator(): Iterable<Base> {
    yield* this.forces;
  }
  findOptionById(id: string): Base | undefined {
    const found = this.index[id];
    if (found) return found;
    const found_import = this.imports.find((o) => id in o.index)?.index[id];
    if (found_import) return found_import;
    if (this.manager && id) {
      return this.manager.getLoadedCatalogue(id) ?? (this.manager.getCatalogueInfo({ targetId: id }) as any);
    }
    return;
  }
  findOptionByIdGlobal(id: string): Base | undefined | BSICatalogue | BSIGameSystem {
    const found = this.index[id];
    if (found) return found;
    const found_import = this.imports.find((o) => id in o.index)?.index[id];
    if (found_import) return found_import;
    if (this.manager) {
      const globalOption = this.manager.findOptionById(id);
      if (globalOption) return globalOption;
      return this.manager.getCatalogueInfo({ targetId: id });
    }

    return;
  }
  findOptionsById(id: string): Base[] {
    const result = [];
    for (const imported of [this, ...this.imports]) {
      for (const val of Object.values(imported.index)) {
        if (val.id && val.id === id) result.push(val);
      }
    }
    return result;
  }
  findOptionsByText(text?: string, exact = false): Base[] {
    if (!text || !text.trim() || exact) {
      const result = [];
      for (const imported of [this, ...this.imports]) {
        for (const val of Object.values(imported.index) as EditorBase[]) {
          if ((val as any).getName) {
            if (val.isLink()) {
              if (val.target && val.isCategory() && !val.parent?.isForce()) {
                continue;
              }
            }
            if (!exact) {
              result.push(val);
            } else if (val.getName() === text) {
              result.push(val);
            }
          } else {
            //  console.log(val);
          }
        }
      }
      return result;
    }
    const result = [];
    const regx = textSearchRegex(text);
    for (const imported of [this, ...this.imports]) {
      for (const val of Object.values(imported.index) as EditorBase[]) {
        const name = val.getName?.call(val);
        const id = val.id;
        if ((name && String(name).match(regx)) || id === text) {
          if (val.isLink()) {
            if (val.target && val.isCategory() && !val.parent?.isForce()) {
              continue;
            }
          }
          result.push(val);
        }
      }
    }
    return result;
  }
  generateNonConflictingId(preferredId?: string): string {
    if (preferredId && this.findOptionByIdGlobal(preferredId) === undefined) return preferredId;
    while (true) {
      const id = generateBattlescribeId();
      if (this.findOptionById(id) === undefined) return id;
    }
  }
  generateCostIndex(): Record<string, BSICostType> {
    const result = {} as Record<string, BSICostType>;
    for (const imported of this.imports) {
      for (const costType of imported.costTypes || []) {
        result[costType.id] = costType;
        this.index[costType.id] = costType as any;
      }
    }
    for (const costType of this.costTypes || []) {
      result[costType.id] = costType;
      this.index[costType.id] = costType as any;
    }

    this.costIndex = result;
    return result;
  }
  getSystem() {
    return this.gameSystem ?? this;
  }
  indexInfo() {
    const system = this.gameSystem ?? this;
    if (system === this) {
      system.infoIndex = new InfoIndex();
    }
    const index = system.infoIndex;
    if (!index) {
      throw new Error("Couldn't index info: system isn't initialized");
    }
    const p1 = performance.now();
    this.forEachObjectWhitelist((obj, parent) => {
      if (!obj.isLink() && (obj.isProfile() || obj.isRule())) {
        index.add(obj.getName(), obj);
        if (obj.alias) {
          for (const alias of obj.alias) {
            const copy = clone(obj);
            copy.name = alias;
            index.add(alias, copy);
          }
        }
      }
    });
  }
  generateImports(deleteBadLinks = true) {
    const importsWithEntries: Record<string, Catalogue> = {};
    const imports: Record<string, Catalogue> = {};
    if (this.gameSystem) {
      this.gameSystem.init(deleteBadLinks);
      importsWithEntries[this.gameSystem.id] = this.gameSystem;
      imports[this.gameSystem.id] = this.gameSystem;
      if (!this.gameSystem.import) this.gameSystem.imports = [];
    }

    for (const link of this.catalogueLinks || []) {
      const catalogue = link.target;
      if (!catalogue) continue;
      catalogue.init(deleteBadLinks);

      for (const imported of catalogue.imports) {
        imports[imported.id] = imported;
      }
      for (const imported of catalogue.importsWithEntries) {
        importsWithEntries[imported.id] = imported;
      }

      if (link.importRootEntries) importsWithEntries[catalogue.id] = catalogue;
      imports[catalogue.id] = catalogue;
    }

    this.imports = Object.values(imports);
    this.importsWithEntries = Object.values(importsWithEntries);
    return this.imports;
  }
  generateForces(categories: Record<string, Category>, forces: Iterable<Force>, parent?: Force | Catalogue): Force[] {
    if (!parent) parent = this;
    const result = [];
    for (const force of forces) {
      const copiedForce = clone(force);
      copiedForce.main_catalogue = this;
      const forceCategories = [];
      if (categories[UNCATEGORIZED_ID]?.units?.length) {
        forceCategories.push(categories[UNCATEGORIZED_ID]);
      }

      const hasUnits = new Set<string>();
      for (const link of force.categoryLinks || []) {
        if (link.targetId in categories) {
          const copied = clone(link);
          copied.main_catalogue = this;

          const category = categories[copied.targetId];
          copied.target = category;
          copied.childs = category.childs;
          for (const child of copied.childs) {
            hasUnits.add(child.id);
          }
          forceCategories.push(copied);
        }
      }
      // For older verion of BS Data
      for (const categoryEntry of force.categoryEntries || []) {
        if (categoryEntry.id in categories) {
          const category = categories[categoryEntry.id];
          const copied = clone(category);
          copied.main_catalogue = this;
          for (const child of copied.childs) {
            hasUnits.add(child.id);
          }
          forceCategories.push(copied);
        }
      }

      const missingUnits = this.units.filter((o) => !hasUnits.has(o.id));
      if (missingUnits.length) {
        const illegal_clone = clone(categories[ILLEGAL_ID]);
        illegal_clone.childs = missingUnits;
        illegal_clone.units = missingUnits;
        forceCategories.push(illegal_clone);
      }

      copiedForce.childs = forceCategories;
      copiedForce.categories = forceCategories;
      this.index[copiedForce.id] = copiedForce;
      if (copiedForce.forceEntries) {
        copiedForce.generateForces(categories);
      }
      this.generateForces(categories, copiedForce.forcesIterator(), copiedForce);
      result.push(copiedForce);
    }
    parent.forces = result;
    parent.childs = result;
    return result;
  }
  generateCategories(units: Record<string, Base[]>): Record<string, Category> {
    const result = {} as Record<string, Category>;
    const set = new Set<string>();
    for (const category of this.iterateCategoryEntries()) {
      const copied = clone(category);
      copied.main_catalogue = this;
      const foundUnits = units[copied.id] || [];
      copied.units = foundUnits;
      copied.childs = foundUnits;
      this.index[category.id] = category;
      result[copied.id] = copied;
      set.add(copied.id);
    }
    for (const key in units) {
      if (!set.has(key)) {
        const category = this.findOptionById(key) as Category;
        if (category) {
          const copied = clone(category);
          copied.main_catalogue = this;
          const foundUnits = units[copied.id] || [];
          copied.units = foundUnits;
          copied.childs = foundUnits;
          this.index[category.id] = category;
          result[copied.id] = copied;
        }
      }
    }
    const uncategorizedUnits = units[UNCATEGORIZED_ID] || [];
    const uncategorized = {
      name: "Uncategorized",
      id: UNCATEGORIZED_ID,
      hidden: false,
      units: uncategorizedUnits,
      childs: uncategorizedUnits,
      catalogue: this,
    };
    result[UNCATEGORIZED_ID] = Object.setPrototypeOf(uncategorized, Category.prototype);
    const illegal = {
      name: "Illegal Units",
      id: ILLEGAL_ID,
      hidden: true,
      units: [],
      childs: [],
      catalogue: this,
    };
    result[ILLEGAL_ID] = Object.setPrototypeOf(illegal, Category.prototype);
    return result;
  }
  generateUnits(): Record<string, Base[]> {
    const units = [];
    for (const imported of this.importsWithEntries) {
      const system = imported.isGameSystem();
      for (const unit of imported.selectionEntries || []) {
        if (system || unit.import !== false) units.push(unit);
      }
      for (const unit of imported.entryLinks || []) {
        if (system || unit.import !== false) units.push(unit);
      }
    }
    for (const unit of this.selectionEntries || []) {
      units.push(unit);
    }
    for (const unit of this.entryLinks || []) {
      units.push(unit);
    }
    const sortedUnits = sortBy(units, (o) => o.getName()!);
    this.units = sortedUnits;
    const result = groupBy(sortedUnits, (o) => o.getPrimaryCategory());
    return result;
  }
  generateExtraConstraints() {
    const roster_constraints = {} as Record<string, BSIExtraConstraint>;
    const force_constraints = [] as Array<BSIExtraConstraint>;
    const by_id_constraints = {} as Record<string, Array<BSIExtraConstraint>>;
    const force_or_category_ids = new Set<string>();
    const by_category_force_constraints = {} as Record<string, Array<BSIExtraConstraint>>;

    function localAddBoundCategoryConstraints(
      catalogue: Catalogue,
      category: Category,
      constraints: Iterable<BSIConstraint>,
    ) {
      const target = category.target || category;
      for (const constraint of constraints) {
        if (constraint.type === "max") continue
        const hash = `${constraint.id}::${category.id}`;

        switch (constraint.scope) {
          case "parent":
            break;
          case "roster":
            roster_constraints[hash] = category.getBoundConstraint(constraint);
            break;
          case "force":
            force_constraints.push(category.getBoundConstraint(constraint));
            break;
          case "primary-category":
          case "primary-catalogue":
            /*             console.warn(
              `unsupported scope:${constraint.scope} from category ${category.getName()} ${category.getId()}`
            ); */
            break;
          default:
            if (force_or_category_ids.has(constraint.scope)) {
              addObj(by_id_constraints, constraint.scope, target.getBoundConstraint(constraint));
              break;
            }
            const fromIndex = catalogue.index[constraint.scope];
            if (fromIndex) {
              const from_id_extra_constraints = fromIndex.extra_constraints || [];
              from_id_extra_constraints.push(category.getBoundConstraint(constraint));
              fromIndex.extra_constraints = from_id_extra_constraints;
              break;
            }
            /*             console.warn(
              `unsupported scope:${constraint.scope} from category ${category.getName()} ${category.getId()}`
            ); */

            break;
        }
      }
    }
    for (const force of this.forcesIteratorRecursive()) {
      force_or_category_ids.add(force.id);
      // Add constraints wich are on categoryLinks
      // for (const category of force.categories) {
      //   if (category.constraints) {
      //     localAddBoundCategoryConstraints(
      //       this,
      //       category,
      //       category.constraints.filter((o) => o.scope === "roster")
      //     );
      //   }
      // }
    }
    for (const category of this.categories) {
      force_or_category_ids.add(category.id);
    }
    for (const category of this.categories) {
      localAddBoundCategoryConstraints(this, category, category.constraintsIterator());
      const force_extra_constraints = {} as Record<string, BSIExtraConstraint>;
      category.forEachNodeCb((node) => {
        if (!node) return;
        if (node.isForce()) return;
        // Categories & Units are always initialized within forces so there is no need to make them extra

        // Add scope:'parent' constrainst to parent entries
        if (!node.isGroup() && !node.extra_constraints) {
          node.extra_constraints = node.getChildBoundConstraints(true);
        }
        if (node.isCategory() && node.isLink()) return;
        if (!node.constraints && !node.target?.constraints) return;

        for (const constraint of node.constraintsIterator()) {
          if (constraint.type === "min" || constraint.type === "exactly") {
            const hash = `${constraint.id}::${node.id}`;
            switch (constraint.scope) {
              case "parent":
                break;
              case "roster":
                roster_constraints[hash] = node.getBoundConstraint(constraint);
                break;
              case "force":
                force_extra_constraints[hash] = node.getBoundConstraint(constraint);
                break;
              case "primary-category":
              case "primary-catalogue":
                // console.warn(`unsupported scope:${constraint.scope} from ${node.getName()} ${node.id}`);
                break;
              default:
                if (force_or_category_ids.has(constraint.scope)) {
                  addObj(by_id_constraints, constraint.scope, node.getBoundConstraint(constraint));
                  break;
                }
                const fromIndex = this.index[constraint.scope];
                if (fromIndex) {
                  const from_id_extra_constraints = fromIndex.extra_constraints || [];
                  from_id_extra_constraints.push(node.getBoundConstraint(constraint));
                  fromIndex.extra_constraints = from_id_extra_constraints;
                  break;
                }
                // console.warn(`unsupported scope:${constraint.scope} from ${node.getName()}${node.id}`);
                break;
            }
          }
        }
      });
      by_category_force_constraints[category.getId()] = Object.values(force_extra_constraints);
    }

    for (const force of this.forcesIteratorRecursive()) {
      const force_extra_constraints = force.extra_constraints || [];
      force_extra_constraints.push(...force_constraints);
      if (force.id in by_id_constraints) {
        force_extra_constraints.push(...by_id_constraints[force.id]);
      }
      if (force_extra_constraints.length) {
        force.extra_constraints = force_extra_constraints;
      }
      for (const category of force.categories) {
        if (category.getId() in by_category_force_constraints) {
          force_extra_constraints.push(...by_category_force_constraints[category.getId()]);
        }
      }
      if (force_extra_constraints.length) {
        force.extra_constraints = force_extra_constraints;
      }
    }

    for (const category of this.categories) {
      const category_extra_constraints = category.extra_constraints || [];
      if (category.id in by_id_constraints) {
        category_extra_constraints.push(...by_id_constraints[category.id]);
      }
      if (category_extra_constraints.length) {
        category.extra_constraints = category_extra_constraints;
      }
    }

    this.roster_constraints = Object.values(roster_constraints);
  }
  async reload(manager: BSCatalogueManager = this.manager) {
    delete this.initialized;
    delete this.loaded;
    delete this.loaded_editor;
    delete (this as Partial<typeof this>).index;
    const key = this.isGameSystem() ? "gameSystem" : "catalogue";
    const loaded = await manager.loadData({ [key]: this } as any);
    this.processForEditor();
    return loaded;
  }
  refreshErrors(cur: EditorBase, deleted = false) {
    this.removeErrors(cur);
    if (cur.isLink()) {
      if (!cur.target) {
        this.addError(cur, {
          source: cur,
          severity: "error",
          msg: `(${cur.editorTypeName}) ${cur.name} has no target`,
          id: "no-target",
        });
        if (!this.unresolvedLinks[cur.targetId]?.includes($toRaw(cur)) && !deleted) {
          addObj(this.unresolvedLinks, cur.targetId, $toRaw(cur));
        }
        if (!this.manager.unresolvedLinks![cur.targetId]?.includes($toRaw(cur))) {
          addObj(this.manager.unresolvedLinks!, cur.targetId, $toRaw(cur));
        }
      } else {
        popObj(this.unresolvedLinks!, cur.targetId, $toRaw(cur));
        popObj(this.manager.unresolvedLinks!, cur.targetId, $toRaw(cur));
      }

      const target = resolveLink(cur.targetId, this.getIndexes()) as EditorBase;
      const parents = getAllPossibleParents(cur);
      if (parents.find((o) => o.id === cur.targetId)) {
        cur.catalogue.addError(cur, {
          id: "bad-link-target",
          msg: "Link target cannot be itself or include itself as a child",
          source: cur,
        });
      } else if (target?.isLink()) {
        cur.catalogue.addError(cur, {
          id: "bad-link-target",
          msg: "Link target Cannot be a Link",
          source: cur,
        });
        return;
      }
    } else if (cur.isProfile()) {
      if (!(cur as Profile).typeId) {
        this.addError(cur, { source: cur, severity: "error", msg: "Profile has no type", id: "no-profile-type" });
      }
    } else if (cur instanceof Condition) {
      this.updateCondition(cur);
    }
  }
  addToIndex(cur: Base) {
    if (cur.id) {
      cur.catalogue = this;

      if (this.manager?.settings?.globalDuplicateIdError) {
        // /**   Cross catalogue duplicate id check
        const index = (this.manager as any).index!;
        if (index[cur.id] && index[cur.id] !== cur) {
          if (cur.isIdUnique() || index[cur.id].isIdUnique()) {
            const existing = index[cur.id];
            const existingCatalogue = existing.getCatalogue();
            const isCatalogueDifferent = this !== existingCatalogue;
            if (existingCatalogue && isCatalogueDifferent) {
              existingCatalogue.addError(existing as EditorBase, {
                source: existing,
                severity: "error",
                msg: `Duplicate id ${cur.id} ${cur.getName()}`,
                id: "duplicate-id-1",
                other: cur,
                extra: existingCatalogue.name,
              });
              existingCatalogue.addError(cur as EditorBase, {
                source: cur,
                severity: "error",
                msg: `Duplicate id ${cur.id} ${existing.getName()}`,
                id: "duplicate-id-2",
                other: existing,
                extra: this.name,
              });
            }
            this.addError(existing as EditorBase, {
              source: existing,
              severity: "error",
              msg: `Duplicate id ${cur.id}  ${cur.getName()}`,
              id: "duplicate-id-1",
              other: cur,
              extra: isCatalogueDifferent ? existingCatalogue.name : undefined,
            });
            this.addError(cur as EditorBase, {
              source: cur,
              severity: "error",
              msg: `Duplicate id ${cur.id} ${existing.getName()}`,
              id: "duplicate-id-2",
              other: existing,
              extra: isCatalogueDifferent ? this.name : undefined,
            });
          }
        }
        index[cur.id] = cur;
      } else {
        if (this.index[cur.id] && this.index[cur.id] !== cur) {
          const existing = this.index[cur.id];
          if (cur.isIdUnique() || existing.isIdUnique() || cur.getName() !== existing.getName()) {
            this.addError(existing as EditorBase, {
              source: existing,
              severity: "error",
              msg: `Duplicate id ${cur.id} ${cur.getName()}`,
              id: "duplicate-id-1",
              other: cur,
            });
            this.addError(cur as EditorBase, {
              source: cur,
              severity: "error",
              msg: `Duplicate id ${cur.id} ${existing.getName()}`,
              id: "duplicate-id-2",
              other: existing,
            });
          }
        }
      }

      this.index[cur.id] = cur;
      if (this.unresolvedLinks && this.unresolvedLinks[cur.id]) {
        for (const lnk of [...this.unresolvedLinks[cur.id]]) {
          if (lnk.isLink() && lnk.catalogue) {
            this.updateLink(lnk as Link & EditorBase);
          } else {
            this.refreshErrors(lnk);
          }
        }
      }
      if (this.manager?.unresolvedLinks && this.manager.unresolvedLinks[cur.id]?.length) {
        for (const lnk of [...this.manager.unresolvedLinks[cur.id]]) {
          if (lnk.isLink()) {
            lnk.catalogue?.updateLink(lnk as Link & EditorBase);
          } else {
            lnk.catalogue?.refreshErrors(lnk as EditorBase);
          }
        }
      }
    }
  }
  removeFromIndex(cur: EditorBase) {
    if (cur.id && $toRaw(this.index[cur.id]) === $toRaw(cur)) {
      delete this.index[cur.id];
    }
    this.removeErrors(cur);
    for (const ref of cur.refs || []) {
      delete ref.target;
      ref.catalogue.refreshErrors(ref);
    }
    for (const ref of cur.other_refs || []) {
      ref.catalogue.refreshErrors(ref, true);
    }
  }
  getIndexes(): Record<string, Base>[] {
    const indexes = [];
    indexes.push(this.index);
    for (const importedCatalogue of this.imports) {
      indexes.push(importedCatalogue.index);
    }
    return indexes;
  }
  resolveAllLinks(deleteBadLinks = true) {
    const unresolvedLinks: Array<Link> = [];
    const unresolvedPublications: Array<BSIInfoLink | BSIRule | BSIProfile> = [];
    const unresolvedChildIds: Array<BSICondition> = [];
    const parents: Array<Base> = [];
    this.index = noObserve() as Record<string, Base>;
    forEachObjectWhitelist2(
      this,
      (cur, parent) => {
        this.addToIndex(cur);
        if ((cur as BSIReference).publicationId) {
          delete (cur as Partial<BSIReference>).publication;
          unresolvedPublications.push(cur as any);
        }
        if (cur.isLink()) {
          delete (cur as Partial<Link>).target;
          unresolvedLinks.push(cur);
          parents.push(parent);
        }
        if (hasSharedChildId(cur)) {
          unresolvedChildIds.push(cur);
        }
      },
      goodKeys,
    );

    const indexes = this.getIndexes();
    const unresolved = resolveLinks(unresolvedLinks, indexes, parents, deleteBadLinks);
    resolvePublications(unresolvedPublications, indexes);
    if (!deleteBadLinks) {
      this.unresolvedLinks = {};
      for (const lnk of unresolved) {
        addObj(this.unresolvedLinks, lnk.targetId, $toRaw(lnk) as Link & EditorBase);
        delete (lnk as Partial<typeof lnk>).target;
      }
    }
  }
  removeRef(from: EditorBase, to: EditorBase) {
    if (!to.refs) to.refs = [];
    const idx = to.refs.indexOf(from);
    if (idx >= 0) to.refs.splice(idx, 1);
  }
  addRef(from: EditorBase, to: EditorBase) {
    if (!to.refs) to.refs = [];
    if (to.refs.indexOf(from) === -1) {
      to.refs.push(from);
    }
  }
  hasOtherRef(from: EditorBase, to: EditorBase) {
    return to.other_refs && to.other_refs.includes(from);
  }

  removeOtherRef(from: EditorBase, to: EditorBase) {
    if (!to.other_refs) to.other_refs = [];
    const idx = to.other_refs.indexOf(from);
    if (idx >= 0) to.other_refs.splice(idx, 1);
  }
  addOtherRef(from: EditorBase, to: EditorBase) {
    if (!to.other_refs) to.other_refs = [];
    if (to.other_refs.indexOf(from) === -1) {
      to.other_refs.push(from);
    }
  }
  updateLink(link: Link & EditorBase) {
    if (link.target) {
      this.removeRef(link, link.target as EditorBase);
    }
    const target = resolveLink(link.targetId, this.getIndexes()) as EditorBase;
    link.target = target;
    if (link.target) {
      link.name = target.name;
      this.addRef(link, link.target as EditorBase);
      const targetType = (link.target as EditorBase).editorTypeName;
      if (targetType == "category") {
        delete link.type;
      } else {
        link.type = targetType;
      }
    }
    this.refreshErrors(link);
    return link.target !== undefined;
  }
  updateConstraint(constraint: Constraint & EditorBase, deleted = false) {
    const ids = new Set();
    const duplicate = new Set();
    for (const found of constraint.parent?.constraintsIterator() || ([] as Array<Constraint & EditorBase>)) {
      if (deleted && constraint === found) continue;
      if (ids.has(found.id)) duplicate.add(found.id);
      else ids.add(found.id);
    }
    for (const found of (constraint.parent?.constraintsIterator() || []) as Array<Constraint & EditorBase>) {
      if (deleted && constraint === found) continue;
      if (duplicate.has(found.id)) {
        found.catalogue?.addError(found, {
          id: "duplicate-constraint-id",
          msg: "Duplicate constraints id",
          source: constraint,
        });
      } else {
        found.catalogue?.removeError(found, "duplicate-constraint-id");
      }
    }
  }
  updateCondition(condition: (Constraint | Condition) & EditorBase, previousField?: string) {
    if (condition.scope) {
      const parent = getModifierOrConditionParent(condition);
      if (parent && !isScopeValid(parent, condition.scope)) {
        this.addError(condition, { source: condition, id: "invalid-scope", msg: `Invalid scope ${condition.scope}` });
      } else {
        this.removeError(condition, "invalid-scope");
      }
      if (condition.scope && !validScopes.has(condition.scope)) {
        const scope = this.findOptionById(condition.scope);
        if (scope) {
          scope.getCatalogue().addOtherRef(condition, scope as EditorBase);
        }
      }
    }
    if (condition instanceof Constraint) {
      return this.updateConstraint(condition as Constraint & EditorBase);
    }
    const isInstanceOf = ["instanceOf", "notInstanceOf"].includes(condition.type);
    if (previousField && !basicQueryFields.has(previousField)) {
      const found = isInstanceOf ? this.findOptionByIdGlobal(previousField) : this.findOptionById(previousField);
      if (found) this.removeOtherRef(condition, found as EditorBase);
    }
    if (condition.childId) {
      if (basicQueryFields.has(condition.childId)) {
        this.removeError(condition, "id-not-exist");
        return;
      }
      const target = isInstanceOf
        ? this.findOptionByIdGlobal(condition.childId)
        : this.findOptionById(condition.childId);
      if (target) {
        if (!this.hasOtherRef(condition, target as EditorBase)) {
          this.addOtherRef(condition, target as EditorBase);
        }
        this.removeError(condition, "id-not-exist");
        // popObj(this.unresolvedLinks!, condition.childId, $toRaw(condition) as Condition & EditorBase);
        popObj(this.manager.unresolvedLinks!, condition.childId, $toRaw(condition) as Condition & EditorBase);
        return;
      }
    }
    this.addError(condition, {
      source: condition,
      severity: "warning",
      msg: "child id does not exist",
      id: "id-not-exist",
    });
    // if (!this.unresolvedLinks![condition.childId]?.includes(condition)) {
    //   addObj(this.unresolvedLinks!, condition.childId, $toRaw(condition) as Condition & EditorBase);
    // }
    addObjIfMissing(this.manager.unresolvedLinks!, condition.childId, $toRaw(condition) as Condition & EditorBase);
    return;
  }

  unlinkLink(link: Link & EditorBase) {
    if (link.target) {
      this.removeRef(link, link.target as EditorBase);
    }
  }
}

export function resolveLink(id: string, indexes: Record<string, Base>[]) {
  for (const index of indexes) {
    if (id in index) {
      return index[id];
    }
  }
}
/**
 * Fills in the `.target` field with the value of the first matching key inside indexes
 * Example: indexes: [{A: 1}, {A: 2}] targetId `A` target would result in `1`
 * @param unresolved The links to resolve
 * @param indexes Array of indexes which match an id to a node
 */
export function resolveLinks(
  unresolved: Link[] = [],
  indexes: Record<string, Base>[],
  parents: Base[],
  deleteBadLinks = true,
) {
  const length = unresolved.length;
  const resolved = [];

  // Loops while unresolvedLinks.length
  // If the length is the same as the start of last iteration, stops.
  let previousLength = 0;
  while (unresolved.length !== previousLength) {
    const currentUnresolved = unresolved;
    const currentParents = parents;
    previousLength = currentUnresolved.length;
    unresolved = [];
    parents = [];

    for (let i = 0; i < currentUnresolved.length; i++) {
      const current = currentUnresolved[i];
      const currentParent = currentParents[i];

      // Find the target, stopping at first found
      const id = current.targetId;
      const target = resolveLink(id, indexes);
      if (target) {
        if (target.isLink()) {
          console.warn(`Failed to resolve link (target is a link): ${current.getName()}(${current.id})`);
        } else {
          current.target = target;
          resolved.push(current);
        }
        continue;
      }

      // Resolve again later if unresolved
      unresolved.push(current);
      parents.push(currentParent);
    }
  }

  // Delete unresolved links
  if (unresolved.length && deleteBadLinks) {
    for (let i = 0; i < unresolved.length; i++) {
      const link = unresolved[i];
      const parent = parents[i];
      for (const [k, v] of Object.entries(parent)) {
        if (v === link) delete parent[k as keyof typeof parent];

        if (Array.isArray(v)) {
          for (const i in v) {
            const val = v[i];
            if (val === link) {
              v.splice(i as any, 1);
            }
          }
        }
      }
    }
  }
  return unresolved;
}
/**
 * Fills in the `.publication` field with the value of the first matching key inside indexes
 * Example: indexes: [{A: 1}, {A: 2}] targetId `A` target would result in `1`
 * @param unresolvedPublications The publications to resolve
 * @param indexes Array of indexes which match an id to a node
 */
export function resolvePublications(
  unresolved: Array<BSIInfoLink | BSIRule | BSIProfile> = [],
  indexes: Record<string, Base>[],
) {
  const nextUnresolved = [];
  for (const current of unresolved) {
    for (const index of indexes) {
      if (current.publicationId! in index) {
        current.publication = index[current.publicationId!];
        break;
      }
    }
    nextUnresolved.push(current);
  }
}

function hasSharedChildId(obj: any): obj is BSICondition {
  return obj.shared !== false && obj.childId !== undefined;
}

export class NoObserve {
  get [Symbol.toStringTag](): string {
    // Anything can go here really as long as it's not 'Object'
    return "ObjectNoObserve";
  }
}
export function noObserve(): object {
  return new NoObserve();
}


export function getAllPossibleParents(node: EditorBase) {
  const result = [] as EditorBase[];
  if (!node.parent && !node.refs?.length) return result
  let temp = [] as EditorBase[]
  const stack = [] as EditorBase[];
  const refsStack = [node.parent, ...(node?.refs ?? [])] as EditorBase[]
  const set = new Set();
  while (refsStack.length) {
    stack.push(refsStack.shift()!)
    temp = []
    while (stack.length) {
      const cur = stack.pop()!
      if (set.has(cur.id)) continue;
      set.add(cur.id);
      temp.push(cur)
      if (cur.parent && !cur.parent.isCatalogue()) stack.push(cur.parent);
      if (cur.refs) refsStack.push(...cur.refs);
    }
    result.push(...temp.reverse())
  }
  return result
}
