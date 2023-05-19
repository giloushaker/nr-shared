import { groupBy, sortBy, clone, addObj, escapeRegex, textSearchRegex, generateBattlescribeId } from "./bs_helpers";
import {
  Base,
  UNCATEGORIZED_ID,
  ILLEGAL_ID,
  Category,
  Link,
  Group,
  CategoryLink,
  goodKeys,
  Rule,
  goodKeysWiki,
} from "./bs_main";
import type {
  BSICostType,
  BSICondition,
  BSIConstraint,
  BSIInfoLink,
  BSIProfile,
  BSIRule,
  BSIPublication,
  BSIProfileType,
} from "./bs_types";
import type { Force, BSIExtraConstraint } from "./bs_main";
import type { BsBook } from "./bs_book";
import type { GameSystem } from "../../ts/systems/game_system";
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
  catalogue: Catalogue;

  parentKey(): string;
  editorTypeName(): string;

  showInEditor?: boolean;
  openInEditor?: boolean;
}
export class CatalogueLink extends Base {
  targetId!: string;
  declare target: Catalogue;
  importRootEntries?: boolean;
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

  battleScribeVersion?: number;

  costTypes?: BSICostType[];
  catalogueLinks?: CatalogueLink[];

  // Processed
  gameSystem!: Catalogue;
  declare loaded?: boolean;
  loaded_wiki?: boolean;
  loaded_editor?: boolean;

  imports!: Catalogue[];
  importRootEntries!: Catalogue[];
  index!: Record<string, Base>;

  forces!: Force[];
  categories!: Category[];
  units!: Array<Base | Link>;
  roster_constraints!: BSIExtraConstraint[];

  book!: BsBook;
  short!: string;
  version!: string;
  nrversion!: string;
  lastUpdated: string | undefined;
  costIndex!: Record<string, BSICostType>;

  process() {
    if (this.loaded) return;
    this.loaded = true;
    const units = this.generateUnits();
    const categories = this.generateCategories(units);
    this.categories = Object.values(categories);
    this.generateForces(categories);
    this.generateExtraConstraints();
    this.generateCostIndex();
  }
  processForWiki(system: GameSystem) {
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

    this.imports.forEach((imported) => {
      addObj(imported as any, "links", this);
    });
    this.forEachObjectWhitelist((cur, parent) => {
      (cur as EditorBase).parent = parent as EditorBase;
      (cur as EditorBase).catalogue = this;
      if (cur.target) addObj(cur.target as any, "links", parent as EditorBase);
    }, goodKeys);
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
  isQuantifiable(): boolean {
    return false;
  }
  isEntry(): boolean {
    return false;
  }
  *iterateCategoryEntries(): Iterable<Category> {
    for (const catalogue of this.imports) {
      for (const category of catalogue.categoryEntries || []) {
        yield category;
      }
    }
    if (this.categoryEntries) yield* this.categoryEntries;
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
        yield* force.forcesIterator();
      }
    }
  }
  *iterateSelectionEntries(): Iterable<Base> {
    for (const catalogue of this.importRootEntries) {
      const system = catalogue.isGameSystem();
      for (const entry of catalogue.selectionEntries || []) {
        if (system || entry.import !== false) yield entry;
      }

      for (const entry of catalogue.sharedSelectionEntries || []) {
        if (system || entry.import !== false) yield entry;
      }
    }
    if (this.selectionEntries) yield* this.selectionEntries;
    if (this.sharedSelectionEntries) yield* this.sharedSelectionEntries;
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
  // findOptionById(id: string) {
  //   return this.index[id];
  // }
  findOptionById(id: string): Base | undefined {
    const found = this.index[id];
    if (found) return found;
    const found_import = this.imports.find((o) => id in o.index)?.index[id];
    if (found_import) return found_import;
    if (this.book) {
      return this.book.system?.books?.array?.find((o) => o.bsid === id) as any;
    }
    return undefined;
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
  findOptionsByName(name?: string): Base[] {
    if (!name || !name.trim()) {
      const result = [];
      for (const imported of [this, ...this.imports]) {
        for (const val of Object.values(imported.index)) {
          if ((val as any).getName) {
            result.push(val);
          } else {
            console.log(val);
          }
        }
      }
      return result;
    }
    const result = [];
    const regx = textSearchRegex(name);
    for (const imported of [this, ...this.imports]) {
      for (const val of Object.values(imported.index)) {
        const name = val.getName?.call(val);
        if (name && String(name).match(regx)) {
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
    if (this.imports) return this.imports;
    const importRootEntries: Record<string, Catalogue> = {};
    const imports: Record<string, Catalogue> = {};
    if (this.gameSystem) {
      importRootEntries[this.gameSystem.id] = this.gameSystem;
      imports[this.gameSystem.id] = this.gameSystem;
      if (!this.gameSystem.import) this.gameSystem.imports = [];
    }

    for (const link of this.catalogueLinks || []) {
      const catalogue = link.target;
      catalogue.generateImports();

      for (const imported of catalogue.imports) {
        imports[imported.id] = imported;
      }
      for (const imported of catalogue.importRootEntries) {
        importRootEntries[imported.id] = imported;
      }

      if (link.importRootEntries) importRootEntries[catalogue.id] = catalogue;
      imports[catalogue.id] = catalogue;
    }

    this.imports = Object.values(imports);
    this.importRootEntries = Object.values(importRootEntries);
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

      // console.log(`${this.name}/${copied.name} is missing ${missingUnits.map((o) => o.getName())}`);
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
      this.index[copied.id] = copied;
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
    for (const imported of this.importRootEntries) {
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
        if (node.isForce()) return;
        // Categories & Units are always initialized within forces so there is no need to make them extra

        // Add scope:'parent' constrainst to parent entries
        if (!node.isGroup() && !node.extra_constraints) {
          node.extra_constraints = node.getChildBoundConstraints(true);
        }
        if (node.isLink()) return;
        if (!node.constraints && !node.target?.constraints) return;

        for (const constraint of node.constraintsIterator()) {
          if (constraint.type === "min") {
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
  addToIndex(cur: Base) {
    if (cur instanceof Publication) {
      this.index[cur.id] = cur;
      return;
    }
    if (cur.id) {
      cur.catalogue = this;
      this.index[cur.id] = cur;
    }
  }
  removeFromIndex(cur: Base) {
    if (cur.id && this.index[cur.id] === cur) {
      delete this.index[cur.id];
    }
  }
  resolveAllLinks(imports: Catalogue[]) {
    const catalogue = this as Catalogue;
    const unresolvedLinks: Array<Link> = [];
    const unresolvedPublications: Array<BSIInfoLink | BSIRule | BSIProfile> = [];
    const unresolvedChildIds: Array<BSICondition> = [];
    const parents: Array<Base> = [];
    const indexes = [];

    if (!this.index) {
      this.index = {};
      this.forEachObjectWhitelist((cur, parent) => {
        this.addToIndex(cur);
        if ((cur as any).publicationId) {
          unresolvedPublications.push(cur as any);
        }
        if (cur instanceof Link) {
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
    resolveLinks(unresolvedLinks, indexes, parents);
    resolvePublications(unresolvedPublications, indexes);
    resolveChildIds(unresolvedChildIds, indexes);
  }
  updateLink(link: Link & EditorBase) {
    if (link.target) {
      const target = link.target as EditorBase;
      if (!target.links) target.links = [];
      const idx = target.links.indexOf(link);
      if (idx >= 0) target.links.splice(idx, 1);
    }
    link.target = this.findOptionById(link.targetId)!;
    if (link.target) {
      const target = link.target as EditorBase;
      if (!target.links) target.links = [];
      target.links.push(link);
    }
    return link.target !== undefined;
  }

  updateCondition(condition: (BSICondition | BSIConstraint) & EditorBase) {}

  unlinkLink(link: Link & EditorBase) {
    if (link.target) {
      const target = link.target as EditorBase;
      if (!target.links) target.links = [];
      const idx = target.links.indexOf(link);
      if (idx >= 0) target.links.splice(idx, 1);
    }
  }
}

/**
 * Fills in the `.target` field with the value of the first matching key inside nodeIndexes
 * Example: nodeIndex: [{A: 1}, {A: 2}] targetId `A` target would result in `1`
 * @param unresolved The links to resolve
 * @param indexes Array of indexes which match an id to a node
 */
export function resolveLinks(unresolved: Link[] = [], indexes: Record<string, Base>[], parents: Base[]) {
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
  if (unresolved.length) {
    console.warn(`${length - unresolved.length}/${length} links resolved`);
    console.warn(`unresolved links: ${unresolved.map((o) => `${o.id} -> ${o.targetId}`)}`);
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
  return resolved;
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
