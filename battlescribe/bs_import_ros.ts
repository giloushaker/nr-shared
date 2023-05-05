import { SavedRoster, SavedForce, SavedSelection } from "./bs_types";
import { BookRow } from "~/assets/shared/types/db_types";
import { GameSystem } from "../../ts/systems/game_system";
import { IArmyRoster } from "../../shared/systems/army_interfaces";
import { BsBook } from "./bs_book";
import { newList, Selector } from "./bs_selector";
import { Instance, RootInstance } from "./bs_instance";

export async function loadBSRoster(
  json: SavedRoster,
  bookRow: BookRow,
  selectedSystem: GameSystem
): Promise<IArmyRoster> {
  const bs_book = (await selectedSystem.getBook(bookRow.id)) as BsBook | null;
  if (!bs_book) throw Error("Unable to load BS book");
  if (!json.forces.length) throw Error("No forces in roster");
  const firstForce = json.forces[0];

  if (bookRow.bsid !== firstForce.catalogueId)
    throw Error(`Select ${firstForce.catalogueName} before importing this roster`);

  // Create List
  const root = newList(bs_book.getMainCatalogue(), true);
  const roster = root.first() as RootInstance;
  (roster as any).nrversion = firstForce.catalogueRevision;

  // Load Books
  const forcesRecursive = [];
  const stack = [...json.forces];
  while (stack.length) {
    const current = stack.pop()!;
    forcesRecursive.push(current);
    stack.push(...(current.forces || []));
  }

  for (const catalogueToLoad of json.forces) {
    const book = await selectedSystem.findBookByBsid(catalogueToLoad.catalogueId);
    if (!book)
      throw Error(`Couldn't find book ${catalogueToLoad.catalogueName} with id ${catalogueToLoad.catalogueId}`);

    roster.addBook(book as BsBook);
  }

  // Load Forces (recursive)
  for (const roster_force of json.forces) {
    await loadBsForce(roster, roster_force);
  }

  // Fill in data
  roster.setCustomName(json.name);
  if (json.costLimits) roster.setMaxCosts(json.costLimits);
  roster.setIsListLoading(false);
  return roster;
}

async function loadBsForce(parent: Instance, roster_force: SavedForce) {
  const roster = parent.getParentRoster();
  const system = roster.getBook().getSystem();
  let book: BsBook | undefined | null = roster.selectors.find((o) => o.getId() === roster_force.catalogueId)?.getBook();

  if (!book) {
    book = (await system.findBookByBsid(roster_force.catalogueId)) as BsBook | undefined | null;
    if (!book) {
      console.warn("Catalogue", "couldn't be loaded", roster_force.catalogueName, roster_force.catalogueId);
      return;
    }
  }
  const new_force = parent.insertForce(book, roster_force.entryId);
  if (!new_force) {
    console.warn("Force", "couldn't be loaded", roster_force.name, roster_force.entryId);
    return;
  }

  //for selection in force, add to its category
  for (const roster_unit of roster_force.selections || []) {
    const unit_category = roster_unit.categories?.find((o) => o.primary);
    if (!unit_category) {
      console.warn("found Unit without Primary Category", roster_unit.name, roster_unit.entryId);
      continue;
    }
    const category = new_force.findOption(unit_category.entryId, unit_category.name);
    if (!category) {
      console.warn("Category", "couldn't be loaded", unit_category.name, unit_category.entryId);
      continue;
    }
    const splitEntryId = roster_unit.entryId.split("::");
    const unitEntryId = splitEntryId[splitEntryId.length - 1];
    let unit_selector;
    try {
      unit_selector = category.first().findOrAddSelector(unitEntryId, roster_unit.name, true);
      loadBsUnit(unit_selector, roster_unit);
    } catch (e) {
      console.warn("unit", "couldn't be loaded", roster_unit.name, roster_unit.entryId, e);
    }
  }

  for (const child_force of roster_force.forces || []) {
    await loadBsForce(new_force, child_force);
  }
}

function loadBsUnit(unit_selector: Selector, roster_unit: SavedSelection) {
  const unit = unit_selector.addInstance(new Instance(unit_selector));
  for (const selection of roster_unit.selections || []) {
    loadBsSelections(selection, unit, 1);
  }
}
function loadBsSelections(self: SavedSelection, parent: Instance, divide: number) {
  const num = self.number / divide || 1;
  const option = parent.findOption(self.entryId, self.name);
  if (!option) {
    console.warn("Option", "couldn't be loaded", self.name, self.entryId);
    return;
  }
  let instance: Instance;
  if (option.isInstanced) {
    for (let i = 0; i < num; i++) {
      instance = option.addInstance(new Instance(option));
      for (const selection of self.selections || []) {
        loadBsSelections(selection, instance, divide * num);
      }
    }
  } else {
    option.setSelections(option.getSelectionsCountSum() + num);
    instance = option.first();
    for (const selection of self.selections || []) {
      loadBsSelections(selection, instance, divide * num);
    }
  }
}
