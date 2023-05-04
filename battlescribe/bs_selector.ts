import { getRandomKey } from "../../../assets/ts/util";
import { BSICost } from "./bs_types";
import { BsBook } from "./bs_book";
import { Instance, HeaderInstance, ExportedNode, RootInstance } from "./bs_instance";
import { Base, Link } from "./bs_main";
import { Catalogue } from "./bs_main_catalogue";
import { Roster } from "./bs_system";
import { autoCheckCreation } from "./bs_auto_check";
import { BooksDate } from "./bs_versioning";

export class Selector {
  root!: Roster;
  parent!: Instance;

  instances: Instance[] = [];
  source: Link | Base;
  extra_instances: Instance[] = [];

  isInstanced: boolean; // if false will initialize an instance
  isUnit: boolean;
  isSubUnit: boolean; //adds an extra HeaderInstance for selecting the number of units
  isQuantifiable: boolean;
  isLimitedTo1 = false;
  id: string;
  ids: string[] = []; // for matching with id of link & target

  uid = getRandomKey();
  hidden = 0;
  book?: any;
  booksDate?: BooksDate;
  initializedHeaders?: boolean;
  notReactive?: boolean;

  constructor(source: Base | Link, parent_instance?: Instance, root?: Roster) {
    source.process();
    this.ids = [source.id];
    this.hidden += source.hidden ? 1 : 0;
    if (source.isLink()) {
      if (!source.target) throw Error("attempted to create a Selector using a link that has no target");
      this.ids.push(source.target.id);
      this.hidden += source.hidden ? 1 : 0;
    }
    this.source = source;
    this.id = source.id;

    if (parent_instance) {
      this.parent = parent_instance;
      this.root = parent_instance.selector.root;
    } else {
      this.root = root!;
    }

    this.isUnit = parent_instance ? parent_instance.source.isCategory() : false;

    for (const parent of this.getParentGroups()) if (parent.selector.isLimitedTo1) this.isLimitedTo1 = true;
    if (this.source.limited_to_one) this.isLimitedTo1 = true;

    this.isInstanced = this.checkIsInstanced();
    this.isSubUnit = this.checkIsSubUnit();
    this.isQuantifiable = this.source.isQuantifiable();
    if (parent_instance) {
      const s = parent_instance.selector;
      const sp = s?.parent;
      if ((sp && sp.isHeader()) || s.notReactive) {
        this.notReactive = true;
      }
    }
  }
  get [Symbol.toStringTag](): string {
    // Any child of a header will never be seen so it does not need to be reactive
    return this.notReactive ? "ObjectNoObserve" : "Object";
  }
  get parents(): Instance[] {
    const result = [];
    let current = this as Selector;
    while (current.parent) {
      current = current.parent.selector;
      result.push(current.parent);
    }
    return result;
  }
  initialize(): void {
    this.refreshInstances(0);
    this.initialize_headers();
  }
  initialize_headers() {
    if (!this.initializedHeaders) {
      this.initializedHeaders = true;
      // Dont initialzied if this is a selector that switched category
      if (this.parent?.isCategory()) {
        if (this.source.getPrimaryCategory() !== this.parent.getId()) {
          return;
        }
      }
      if (this.isSubUnit || this.isUnit || this.source.isForce()) {
        const inst = new HeaderInstance(this);
        this.extra_instances.push(inst);
        inst.initialize();
        if (inst.shouldBeEnabled()) {
          inst.enable();
          autoCheckCreation(inst);
        }
      }
    }
  }

  delete(): void {
    for (const instance of this.instances) instance.delete();
    for (const instance of this.extra_instances) instance.delete();
  }

  checkIsInstanced(): boolean {
    if (this.isUnit || this.source.isForce()) return true;
    if (!this.source.isQuantifiable()) return false;
    if (this.isLimitedTo1) return false;

    return !this.source.collective_recursive;
  }

  getParentGroups(): Instance[] {
    const result = [];
    let current = this.parent;
    while (current && current.isGroup()) {
      result.push(current);
      current = current.getParent();
    }
    return result;
  }

  checkIsSubUnit() {
    if (this.isUnit) return false;
    if (this.source.isGroup()) return false;
    if (!this.isInstanced) return false;
    const hasParentUnit = this.parent && (this.parent.isUnit() || this.parent.getParentUnit());
    return Boolean(hasParentUnit);
  }

  first() {
    return this.instances[0];
  }

  getId(): string {
    return this.source.getId();
  }

  getBook(): BsBook {
    return this.source.isCatalogue() ? this.source.book : this.root.book!;
  }

  getName(): string {
    return this.source.getName();
  }

  addInstance(to_add?: Instance): Instance {
    if (!to_add) {
      to_add = new Instance(this);
    }
    this.instances.push(to_add);
    to_add.initialize();

    if (this.isSubUnit || this.isUnit || this.source.isForce()) {
      // to_add.amount = 1;
      to_add.enable(1);
    }
    if (to_add.shouldBeEnabled()) {
      to_add.enable();
      // autoCheckCreation(to_add);
    }

    return to_add;
  }

  popInstance(index?: number): Instance {
    let removed: Instance;
    if (index !== undefined) removed = this.instances.splice(index, 1)[0];
    else removed = this.instances.splice(this.instances.length - 1, 1)[0];
    removed.delete();
    return removed;
  }

  getSelectionsCountSum(): number {
    if (this.isInstanced) return this.instances.length;
    if (this.instances.length) return this.instances[0].amount;
    return 0;
  }

  deleteInstance(obj: any): number {
    const index = this.instances.findIndex((o) => Object.is(o, obj));
    if (index === -1) return 1;
    this.popInstance(index);
    return 0;
  }

  /**
   * Returns all selectors from direct childs
   */
  getSelections(): Selector[] {
    const result: Selector[] = [];
    this.instances.forEach((elt) => result.push(...elt.selectors));
    return result;
  }

  refreshInstances(n: number) {
    const num_instances = this.isInstanced ? n : 1;
    // Dont replace with while otherwise it can loop indefinitly if the instances count is modified by something else
    for (let i = this.instances.length; i < num_instances; i++) {
      this.addInstance();
    }
    for (let i = this.instances.length; i > num_instances; i--) {
      this.popInstance();
    }
  }

  setSelections(n: number): boolean {
    this.refreshInstances(n);
    if (!this.isInstanced) {
      const instance = this.first();
      if (instance) {
        instance.amount = n;
      }
    }

    return true;
  }

  toListJson(): ExportedRoot {
    const first = this.first();
    const root: ExportedRoot = {
      ...first.toJsonObject(),
      maxCosts: first.getMaxCosts(),
    };
    return root;
  }

  /**
   * Returns wether this is a subUnit, used for export.
   * subUnits should have a deeper level of indentation
   */
  isOptionSubUnit(): boolean {
    const isModel = this.source.getType() === "model";
    const isSubUnit = this.isQuantifiable && !this.source.collective_recursive && isModel;
    return isSubUnit;
  }

  findSourceOptionById(id: string): Base | undefined {
    let found = false;
    let result = undefined;
    this.source.forEach((o) => {
      if (o.isLink() ? o.target.id === id : o.id === id) {
        found = true;
        result = o;
      }
      return found;
    });
    return result;
  }
}
2;
export class SwitchedSelector extends Selector {
  source_selector: Selector;

  constructor(source: Base, parent_instance: Instance, root: Roster, source_selector: Selector) {
    super(source, parent_instance, root);
    this.source_selector = source_selector;
  }
}
export interface ExportedRoot extends ExportedNode {
  options: ExportedNode[];
  maxCosts: BSICost[];
}

export class RootSelector extends Selector {
  is_loading!: boolean;
  root!: Roster;
  instances!: RootInstance[];
  constructor(mainBook: BsBook) {
    const source = new Roster({}, mainBook, [mainBook.getMainCatalogue()]);
    super(source, undefined);
    this.root = source;
    this.is_loading = false;
  }
  addInstance(to_add?: RootInstance): RootInstance {
    if (!to_add) {
      to_add = new RootInstance(this);
    }
    this.instances.push(to_add);
    to_add.initialize();
    if (to_add.shouldBeEnabled()) {
      to_add.enable();
    }
    return to_add;
  }
  first(): RootInstance {
    return this.instances[0];
  }
}

export function newList(catalogue: Catalogue, is_loading = false): RootSelector {
  const root = new RootSelector(catalogue.book);
  root.is_loading = is_loading;
  root.initialize();
  const roster = root.first();
  roster.addBook(catalogue.book);
  return root;
}
