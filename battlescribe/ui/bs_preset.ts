import type { ExportedNode } from "../bs_instance";
import type { State } from "store/index";
import Vue from "vue";

export interface IPreset<T = any> {
  systemId: number;
  unitId: string;
  unitName: string;
  name?: string;
  description?: string;
  created: Date;
  options: T;
}
export type BSIPreset = IPreset<ExportedNode>;

export interface IPresetIndex {
  [systemId: number]: {
    [unitId: string]: {
      [index: number]: IPreset;
    };
  };
}

export interface IPresetStore {
  presets?: IPresetIndex;
}

export function getPresets(
  obj: IPresetStore,
  systemId: number,
  unitId: string
): { [index: number]: IPreset } | undefined {
  const presets = obj.presets;
  if (!presets) return undefined;

  const systemPresets = presets[systemId];
  if (!systemPresets) return undefined;

  const unitPresets = systemPresets[unitId];
  if (!unitPresets) return undefined;

  return unitPresets;
}

export function getOrSetPresets(obj: IPresetStore, systemId: number, unitId: string): { [index: number]: IPreset } {
  if (!obj.presets) {
    Vue.set(obj, "presets", {});
  }

  const allPresets = obj.presets!;
  if (!allPresets[systemId]) {
    Vue.set(allPresets, systemId, {});
  }

  const systemPresets = allPresets[systemId];
  if (!systemPresets[unitId]) {
    Vue.set(systemPresets, unitId, {});
  }

  const unitPresets = systemPresets[unitId];
  return unitPresets!;
}

export function addPreset(obj: IPresetStore, systemId: number, unitId: string, preset: IPreset) {
  const presets = getOrSetPresets(obj, systemId, unitId);
  const max = Math.max(
    0,
    ...Object.keys(presets)
      .map((o) => parseInt(o))
      .filter((o) => !isNaN(o))
  );

  Vue.set(presets, max + 1, preset);
}

export function deletePreset(obj: IPresetStore, systemId: number, unitId: string, preset: IPreset) {
  const presets = getPresets(obj, systemId, unitId);
  if (presets) {
    const badEntries = Object.entries(presets).filter(([, v]) => Object.is(v, preset));
    for (const [k] of badEntries) {
      Vue.delete(presets, k);
    }
  }
}

export function deletePresetMutation(state: State, preset: IPreset) {
  deletePreset(state.options, preset.systemId, preset.unitId, preset);
}
