import { groupBy, sortBy, addOne } from "./bs_helpers";
import { entryToJson } from "./bs_main";
import { BSIProfile, BSICharacteristic } from "./bs_types";

export interface BSIGroupedProfile extends BSIProfile {
  big: BSICharacteristic[];
  small: BSICharacteristic[];
}

/**
 * Groups profiles and adds a `big` and `small` field
 * `small` contains any characteristic whose length is < `bigStringLength`
 * `big`   contains any characteristic whose length is >= `bigStringLength`
 * @param profiles The profiles to group
 * @param bigStringLength Any string above this length is considered `big`
 */
export function groupProfiles(profiles: BSIProfile[], bigStringLength = 40): BSIGroupedProfile[][] {
  const allVisible = (profiles as Array<BSIGroupedProfile>).filter((o) => !o.hidden);
  const uniques = hashProfiles(allVisible);

  const groupedByType = groupBy(uniques, (o) => o.typeId);
  for (const key of Object.keys(groupedByType)) {
    const value = groupedByType[key];
    groupedByType[key] = value
      .map((o) => [o.name, o] as [string, BSIGroupedProfile])
      .sort()
      .map(([, v]) => v);
  }
  const profilesByType = Object.values(groupedByType).filter((o) => o.length);
  for (const profiles of profilesByType) {
    const maxes = {} as Record<string, number>;
    for (const profile of profiles) {
      for (const characteristic of profile.characteristics) {
        maxes[characteristic.typeId] = Math.max(
          characteristic.$text?.toString().length || 0,
          maxes[characteristic.typeId] || 0
        );
      }
    }
    for (const profile of profiles) {
      profile.big = [] as BSICharacteristic[];
      profile.small = [] as BSICharacteristic[];
      for (const characteristic of profile.characteristics) {
        const maxCharacteristicLength = maxes[characteristic.typeId];
        if (maxCharacteristicLength > bigStringLength) {
          profile.big.push(characteristic);
        } else {
          profile.small.push(characteristic);
        }
      }
    }
  }

  const result = sortBy(
    profilesByType.filter((o) => o.length),
    (pbt) => pbt[0].typeName
  );
  return result;
}

export function isProfileModified(profile: BSIProfile) {
  for (const characteristic of profile.characteristics) {
    if (characteristic.originalValue !== undefined && characteristic.originalValue !== characteristic.$text)
      return true;
  }
  return false;
}
export function hashProfile(profile: BSIProfile): string {
  return entryToJson({ ...profile, id: undefined });
}
export function indexProfiles<T extends BSIProfile | BSIGroupedProfile>(profiles: T[]): Record<string, T> {
  const hashed: { [hash: string]: T } = {};
  for (const profile of profiles) {
    hashed[hashProfile(profile)] = profile;
  }
  const names: Record<string, number> = {};
  const totalNames: Record<string, number> = {};
  const modifieds = [];
  const not_modified = [];
  for (const profile of Object.values(hashed)) {
    addOne(totalNames, `${profile.typeName}-${profile.name}`);
    if (isProfileModified(profile)) {
      modifieds.push(profile);
    } else {
      not_modified.push(profile);
    }
  }
  for (const profile of not_modified) {
    const num = addOne(names, `${profile.typeName}-${profile.name}`);
    if (totalNames[`${profile.typeName}-${profile.name}`] <= 1) {
      continue;
    }
    const end = `[${num + 1}]`;
    if (!profile.name.endsWith(end)) profile.name += end;
  }

  for (const profile of modifieds) {
    if (totalNames[`${profile.typeName}-${profile.name}`] <= 1) {
      continue;
    }
    const num = addOne(names, `${profile.typeName}-${profile.name}`);
    const end = `[${num + 1}]`;
    if (!profile.name.endsWith(end)) profile.name += end;
  }
  return hashed;
}

export function getProfilesFromIndex<T extends BSIProfile | BSIGroupedProfile>(index: Record<string, T>): T[] {
  const result = [];
  const modifieds = [];
  for (const profile of Object.values(index)) {
    if (!isProfileModified(profile)) result.push(profile);
    else modifieds.push(profile);
  }
  result.push(...modifieds);
  return result as any;
}

export function hashProfiles<T extends BSIProfile | BSIGroupedProfile>(profiles: T[]): T[] {
  const hashed = indexProfiles(profiles);
  return getProfilesFromIndex(hashed);
}