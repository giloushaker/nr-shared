import { Store } from "store/index";
import { saveOptions } from "~/assets/js/save";
import { rpc } from "~/assets/js/rpc";

export function addInstalledSystemVue(store: Store, systemId: number) {
  const installed = store.state.options.installed_systems;
  if (installed.includes(systemId)) return;

  installed.push(systemId);
  store.commit("setInstalledSystems", installed);
  saveOptions(store);
  if (store.state.user) {
    rpc("inc_user_data_version");
  }
}
