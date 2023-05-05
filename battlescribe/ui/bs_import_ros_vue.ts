import { Store } from "store/index";
import { unzip } from "unzipit";
import { xml_to_json } from "../bs_xml";
import { GameSystem } from "../../../ts/systems/game_system";
import { selectedSystemChanged } from "~/assets/js/selection";
import { loadBSRoster } from "../bs_import_ros";
import { Instance } from "../bs_instance";
import { addList } from "~/assets/js/list_functions";
import { addInstalledSystemVue } from "../../systems/installed";
import { initListRow } from "~/assets/ts/listdb/listrow_util";

function errormsg(str: string) {
  return {
    type: 1,
    msg: str,
  };
}
function statusmsg(str: string) {
  return {
    type: 0,
    msg: str,
  };
}
function findRosterSystem(xml: any, systems: GameSystem[]): GameSystem | undefined {
  for (const sys of systems) {
    if (sys.bsid === xml.gameSystemId) {
      return sys;
    }
  }
}
export async function importBsVue(store: Store, file: any) {
  try {
    if (!store.state.selectedSystem) {
      return;
    }

    window.location.hash = "main";
    store.commit("setLoading", true);

    const xml = await getXmlFromFile(file);
    const rosterJson = xml_to_json(xml).roster;

    if (rosterJson.forces.length === 0) {
      store.state.errorManager.showMessages([errormsg("Roster contains no forces!")]);
      store.commit("setLoading", false);
      return;
    }

    const foundSystem = findRosterSystem(rosterJson, store.state.library.array);
    if (!foundSystem) {
      store.state.errorManager.showMessages([errormsg("Could not find appropriate game system")]);
      store.commit("setLoading", false);
      return;
    }

    addInstalledSystemVue(store, foundSystem.id);
    store.commit("selectSystem", foundSystem);
    await selectedSystemChanged(store);

    const list = await rosterXmlToList(rosterJson, store.state.selectedSystem);

    await addList(store, list);
    store.commit("setLoading", false);
    store.state.errorManager.showMessages([statusmsg("Roster imported succesfully!")]);
  } catch (e) {
    console.error(e);
    store.state.errorManager.showMessages([statusmsg(e.message || e.msg)]);
    store.commit("setLoading", false);
  }
}
async function rosterXmlToList(jroster: any, system: GameSystem) {
  const first_force = jroster.forces[0];
  const book = system.books.array.find(
    (o) => o.bsid === first_force.catalogueId || o.name === first_force.catalogueName
  );
  if (!book) {
    throw Error("Couldn't find the book for this roster");
  }

  const roster = (await loadBSRoster(jroster, book, system)) as Instance;
  const roster_book = roster.selector.getBook();
  const booksDate = roster_book.catalogue.lastUpdated
    ? { [roster_book.catalogue.id]: roster_book.catalogue.lastUpdated }
    : undefined;

  const list = initListRow(
    roster.name,
    roster_book.getIdSystem(),
    roster_book.getId(),
    parseInt(roster_book.getRevision()),
    roster,
    booksDate
  );
  list.totalCost = roster.getPointsCost();
  list.totalCosts = roster.calcTotalCosts();
  return list;
}

async function getXmlFromFile(file: any): Promise<string> {
  if (file.name.endsWith(".rosz")) {
    const { entries } = await unzip(file);
    return await Object.values(entries)[0].text();
  } else if (file.name.endsWith(".ros")) {
    return await file.text();
  } else {
    throw Error("File extension must be .ros or .rosz");
  }
}
