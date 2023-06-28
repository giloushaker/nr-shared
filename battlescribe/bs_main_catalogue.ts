import type { ItemTypeNames } from "./bs_editor";
import { addObj, clone, generateBattlescribeId, groupBy, popObj, sortBy, textSearchRegex } from "./bs_helpers";
import {
  BSIExtraConstraint,
  Base,
  Category,
  Condition,
  Force,
  ILLEGAL_ID,
  Link,
  Profile,
  Rule,
  UNCATEGORIZED_ID,
  basicQueryFields,
  goodJsonArrayKeys,
  goodKeys,
  goodKeysWiki,
} from "./bs_main";
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

export interface IErrorMessage {
  msg: string;
  severity?: "error" | "warning" | "info" | "debug";
  source?: any;
  id?: string;
}

export interface WikiLink extends Link {
  parent: WikiBase;
  links?: WikiLink[];
}
export interface WikiBase extends Base {
  parent?: WikiBase;
  links?: WikiLink[];
}
export interface EditorBase extends Base {
  parent?: EditorBase;
  links?: EditorBase[];
  other_links?: EditorBase[];
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
  unresolvedLinks: Record<string, Array<(Condition | Link) & EditorBase>> = {};

  forces!: Force[];
  categories!: Category[];
  units!: Array<Base | Link>;
  roster_constraints!: BSIExtraConstraint[];

  manager!: BSCatalogueManager;
  book!: any;
  short!: string;
  version!: string;
  nrversion!: string;
  lastUpdated: string | undefined;
  costIndex!: Record<string, BSICostType>;

  fullFilePath?: string;

  errors?: IErrorMessage[];

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this.generateImports();
    this.resolveAllLinks(this.imports, true);
    this.generateCostIndex();
  }

  process() {
    if (this.loaded) return;
    this.loaded = true;
    this.init();
    const units = this.generateUnits();
    const categories = this.generateCategories(units);
    this.categories = Object.values(categories);
    this.generateForces(categories);
    this.generateExtraConstraints();
  }
  processForWiki(system: Record<string, any>) {
    if (this.loaded_wiki) return;
    this.loaded_wiki = true;
    this.process();
    const rulesObj: Record<string, any> = system.rules || {};
    (system as any).rules = rulesObj;

    this.imports.forEach((imported) => {
      addObj(imported as any, "links", this);
    });
    this.forEachObjectWhitelist((cur, parent) => {
      (cur as WikiBase).parent = parent as WikiBase;
      if (cur.target) addObj(cur.target as any, "links", parent as WikiBase);
      if (cur instanceof Rule) {
        rulesObj[cur.id] = cur;
      }
    }, goodKeysWiki);

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
    this.init();

    if (this.gameSystem) {
      addObj(this.gameSystem as any, "links", this);
    }

    this.forEachObjectWhitelist<EditorBase>((cur, parent) => {
      cur.parent = parent;
      cur.catalogue = this;
      if (cur.target) {
        addObj(cur.target as EditorBase, "links", cur);
      }
      if (cur.isProfile() && !cur.isLink()) {
        const target = this.findOptionById(cur.typeId) as EditorBase;
        if (target) {
          addObj(target, "links", cur);
        }
      }
      if (cur instanceof Condition) {
        this.updateCondition(cur as Condition & EditorBase);
      }
      const value = (cur as any).value;
      if (value) {
        const target = this.findOptionById(value) as EditorBase;
        if (target) {
          addObj(target, "other_links", cur);
        }
      }
      this.refreshErrors(cur);
    }, goodJsonArrayKeys);
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
  updateErrors(obj: EditorBase, newErrors: IErrorMessage[]) {
    if (this.errors?.length && obj.errors?.length) {
      this.errors = this.errors.filter((o) => !obj.errors!.includes(toRaw(o)));
    }
    obj.errors = newErrors;
    if (newErrors.length) {
      if (!this.errors) {
        this.errors = [];
      }
      this.errors.push(...newErrors);
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
    for (const catalogue of this.importsWithEntries) {
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
    if (this.book) {
      this.manager.getLoadedCatalogue(id);
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
  findOptionsByText(text?: string): Base[] {
    if (!text || !text.trim()) {
      const result = [];
      for (const imported of [this, ...this.imports]) {
        for (const val of Object.values(imported.index) as EditorBase[]) {
          if ((val as any).getName) {
            if (val.isLink()) {
              if (val.target && val.isCategory() && !val.parent?.isForce()) {
                continue;
              }
            }
            result.push(val);
          } else {
            console.log(val);
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
        if (name && String(name).match(regx)) {
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
  generateNonConflictingId(): string {
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
  generateImports() {
    const importsWithEntries: Record<string, Catalogue> = {};
    const imports: Record<string, Catalogue> = {};
    if (this.gameSystem) {
      this.gameSystem.init();
      importsWithEntries[this.gameSystem.id] = this.gameSystem;
      imports[this.gameSystem.id] = this.gameSystem;
      if (!this.gameSystem.import) this.gameSystem.imports = [];
    }

    for (const link of this.catalogueLinks || []) {
      const catalogue = link.target;
      if (!catalogue) continue;
      catalogue.init();

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
  generateForces(categories: Record<string, Category>): Force[] {
    const result = [];
    for (const force of this.forcesIterator()) {
      const copied = clone(force);
      copied.main_catalogue = this;
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
      const missingUnits = this.units.filter((o) => !hasUnits.has(o.id));
      if (missingUnits.length) {
        const illegal_clone = clone(categories[ILLEGAL_ID]);
        illegal_clone.childs = missingUnits;
        illegal_clone.units = missingUnits;
        forceCategories.push(illegal_clone);
      }

      copied.childs = forceCategories;
      copied.categories = forceCategories;
      this.index[copied.id] = copied;
      if (copied.forceEntries) {
        copied.generateForces(categories);
      }

      result.push(copied);
    }
    this.forces = result;
    this.childs = result;
    return result;
  }
  generateCategories(units: Record<string, Base[]>): Record<string, Category> {
    const result = {} as Record<string, Category>;
    for (const category of this.iterateCategoryEntries()) {
      const copied = clone(category);
      copied.main_catalogue = this;
      const foundUnits = units[copied.id] || [];
      copied.units = foundUnits;
      copied.childs = foundUnits;
      this.index[category.id] = category;
      result[copied.id] = copied;
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
      constraints: Iterable<BSIConstraint>
    ) {
      const target = category.target || category;
      for (const constraint of constraints) {
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
            console.warn(
              `unsupported scope:${constraint.scope} from category ${category.getName()} ${category.getId()}`
            );
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
            console.warn(
              `unsupported scope:${constraint.scope} from category ${category.getName()} ${category.getId()}`
            );

            break;
        }
      }
    }
    for (const force of this.forcesIteratorRecursive()) {
      force_or_category_ids.add(force.id);
      // Add constraints wich are on categoryLinks
      for (const category of force.categories) {
        if (category.constraints) {
          localAddBoundCategoryConstraints(
            this,
            category,
            category.constraints.filter((o) => o.scope === "roster")
          );
        }
      }
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
                console.warn(`unsupported scope:${constraint.scope} from ${node.getName()} ${node.id}`);
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
                console.warn(`unsupported scope:${constraint.scope} from ${node.getName()}${node.id}`);
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
  async reload(manager: BSCatalogueManager) {
    const sys = manager;
    delete this.loaded;
    delete this.loaded_editor;
    const key = this.isGameSystem() ? "gameSystem" : "catalogue";
    const loaded = await sys.loadData({ [key]: this } as any);
    return loaded;
  }
  refreshErrors(cur: EditorBase) {
    if (cur.isLink()) {
      if (!cur.target) {
        this.updateErrors(cur, [{ source: cur, severity: "error", msg: "Link has no target" }]);
        if (!this.unresolvedLinks[cur.targetId]?.includes(toRaw(cur))) {
          addObj(this.unresolvedLinks, cur.targetId, toRaw(cur));
        }
      } else {
        if (cur.errors) {
          this.updateErrors(cur, []);
        }
      }
    } else if (cur.isProfile() && !(cur as Profile).typeId) {
      this.updateErrors(cur, [{ source: cur, severity: "error", msg: "Profile has no type" }]);
    } else if (cur instanceof Condition) {
      this.updateCondition(cur);
    } else {
      if (cur.errors) {
        this.updateErrors(cur, []);
      }
    }
  }
  addToIndex(cur: Base) {
    if (cur.id) {
      cur.catalogue = this;
      this.index[cur.id] = cur;
      if (this.unresolvedLinks && this.unresolvedLinks[cur.id]) {
        for (const lnk of this.unresolvedLinks[cur.id]) {
          if (!lnk.isLink()) {
            this.updateLink(lnk as Link & EditorBase);
          } else {
            this.refreshErrors(lnk);
          }
        }
      }
      if (this.manager?.unresolvedLinks && this.manager.unresolvedLinks![cur.id]?.length) {
        for (const lnk of this.manager.unresolvedLinks[cur.id]) {
          lnk.catalogue.refreshErrors(lnk as EditorBase);
        }
      }
    }
  }
  removeFromIndex(cur: EditorBase) {
    if (cur.id && this.index[cur.id] === cur) {
      delete this.index[cur.id];
    }
    this.updateErrors(cur, []);
    for (const ref of cur.links || []) {
      delete ref.target;
      ref.catalogue.refreshErrors(ref);
    }
    for (const ref of cur.other_links || []) {
      ref.catalogue.refreshErrors(ref);
    }
  }
  resolveAllLinks(imports: Catalogue[], deleteBadLinks = true) {
    const unresolvedLinks: Array<Link> = [];
    const unresolvedPublications: Array<BSIInfoLink | BSIRule | BSIProfile> = [];
    const unresolvedChildIds: Array<BSICondition> = [];
    const parents: Array<Base> = [];
    const indexes = [];

    if (!this.index) {
      this.index = {};
      this.forEachObjectWhitelist((cur, parent) => {
        this.addToIndex(cur);
        if ((cur as BSIReference).publicationId) {
          unresolvedPublications.push(cur as any);
        }
        if (cur.isLink()) {
          unresolvedLinks.push(cur);
          parents.push(parent);
        }
        if (hasSharedChildId(cur)) {
          unresolvedChildIds.push(cur);
        }
      }, goodKeys);
    }
    indexes.push(this.index);

    for (const importedCatalogue of imports) {
      indexes.push(importedCatalogue.index);
    }
    const unresolved = resolveLinks(unresolvedLinks, indexes, parents, deleteBadLinks);
    resolvePublications(unresolvedPublications, indexes);
    resolveChildIds(unresolvedChildIds, indexes);
    if (!deleteBadLinks) {
      this.unresolvedLinks = {};
      for (const lnk of unresolved) {
        addObj(this.unresolvedLinks, lnk.targetId, lnk as Link & EditorBase);
      }
    }
  }
  removeRef(from: EditorBase, to: EditorBase) {
    if (!to.links) to.links = [];
    const idx = to.links.indexOf(from);
    if (idx >= 0) to.links.splice(idx, 1);
  }
  addRef(from: EditorBase, to: EditorBase) {
    if (!to.links) to.links = [];
    to.links.push(from);
  }
  removeOtherRef(from: EditorBase, to: EditorBase) {
    if (!to.other_links) to.other_links = [];
    const idx = to.other_links.indexOf(from);
    if (idx >= 0) to.other_links.splice(idx, 1);
  }
  addOtherRef(from: EditorBase, to: EditorBase) {
    if (!to.other_links) to.other_links = [];
    to.other_links.push(from);
  }
  updateLink(link: Link & EditorBase) {
    if (link.target) {
      this.removeRef(link, link.target as EditorBase);
    }
    link.target = this.findOptionById(link.targetId)!;
    if (link.target) {
      this.addRef(link, link.target as EditorBase);
    }
    if (link.target == null) {
    } else {
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

  updateCondition(condition: (BSICondition | BSIConstraint | Condition) & EditorBase, previousField?: string) {
    if (["exactly", "min", "max"].includes(condition.type)) return;
    const isInstanceOf = ["instanceOf", "notInstanceOf"].includes(condition.type);
    if (previousField && !basicQueryFields.has(previousField)) {
      const found = isInstanceOf ? this.findOptionByIdGlobal(previousField) : this.findOptionById(previousField);
      if (found) this.removeOtherRef(condition, found as EditorBase);
    }
    if (condition.childId) {
      if (basicQueryFields.has(condition.childId)) {
        this.updateErrors(condition, []);
        return;
      }
      const target = isInstanceOf
        ? this.findOptionByIdGlobal(condition.childId)
        : this.findOptionById(condition.childId);
      if (target) {
        this.addOtherRef(condition, target as EditorBase);
        this.updateErrors(condition, []);
        popObj(this.manager.unresolvedLinks!, condition.childId, condition as Condition & EditorBase);
        return;
      }
      if (!this.manager.unresolvedLinks![condition.childId]?.includes(condition)) {
        addObj(this.manager.unresolvedLinks!, condition.childId, condition as Condition & EditorBase);
      }
    }
    this.updateErrors(condition, [{ source: condition, severity: "warning", msg: "Field does not exist" }]);
    return;
  }

  unlinkLink(link: Link & EditorBase) {
    if (link.target) {
      this.removeRef(link, link.target as EditorBase);
    }
  }
}

/**
 * Fills in the `.target` field with the value of the first matching key inside nodeIndexes
 * Example: nodeIndex: [{A: 1}, {A: 2}] targetId `A` target would result in `1`
 * @param unresolved The links to resolve
 * @param indexes Array of indexes which match an id to a node
 */
export function resolveLinks(
  unresolved: Link[] = [],
  indexes: Record<string, Base>[],
  parents: Base[],
  deleteBadLinks = true
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
      let target;
      for (const index of indexes) {
        if (id in index) {
          target = index[id];
          break;
        }
      }

      if (target) {
        current.target = target;
        resolved.push(current);
        continue;
      }

      // Resolve again later if unresolved
      unresolved.push(current);
      parents.push(currentParent);
    }
  }

  // Delete unresolved links
  if (unresolved.length && deleteBadLinks) {
    console.warn(`${length - unresolved.length}/${length} links resolved in ${unresolved[0].catalogue.name}`);
    console.log(`unresolved links: ${unresolved.map((o) => `${o.id} -> ${o.targetId}`)}`);
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
 * Fills in the `.publication` field with the value of the first matching key inside nodeIndexes
 * Example: nodeIndex: [{A: 1}, {A: 2}] targetId `A` target would result in `1`
 * @param unresolvedPublications The publications to resolve
 * @param indexes Array of indexes which match an id to a node
 */
export function resolvePublications(
  unresolved: Array<BSIInfoLink | BSIRule | BSIProfile> = [],
  indexes: Record<string, Base>[]
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
export function resolveChildIds(unresolvedChildIds: BSICondition[] = [], indexes: Record<string, Base>[]) {
  for (const current of unresolvedChildIds) {
    // Find the target, stopping at first found
    const id = current.childId!;
    for (const index of indexes) {
      if (id in index) {
        current.childId = index[id].getId();
        break;
      }
    }
  }
}

function hasSharedChildId(obj: any): obj is BSICondition {
  return obj.shared !== false && obj.childId !== undefined;
}
