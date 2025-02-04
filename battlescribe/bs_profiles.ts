import { groupBy, sortBy, addOne, sortByAscending, sortByAscendingInplace, clone } from "./bs_helpers";
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
export function groupProfiles(profiles: BSIProfile[], bigStringLength = 40, sumAmount = true): BSIGroupedProfile[][] {
  const allVisible = (profiles as Array<BSIGroupedProfile>).filter((o) => !o?.hidden);
  const uniques = hashProfiles(allVisible, sumAmount);

  const profilesWithGroup = uniques.filter((elt) => elt.group != null);
  const groupedByGroup = groupBy(profilesWithGroup, (o) => o.group as string);

  const groupedByType = groupBy(
    uniques.filter((elt) => elt.group == null),
    (o) => o.typeId,
  );

  for (let key in groupedByGroup) {
    groupedByType[key] = groupedByGroup[key];
  }

  for (const key of Object.keys(groupedByType)) {
    const value = groupedByType[key];
    groupedByType[key] = value.map((o) => [o.name, o] as [string, BSIGroupedProfile]).map(([, v]) => v);
  }
  const profilesByType = Object.values(groupedByType)

  for (const profiles of profilesByType) {
    const maxes = {} as Record<string, number>;
    for (const profile of profiles) {
      for (const characteristic of profile.characteristics || []) {
        maxes[characteristic.typeId] = Math.max(
          characteristic.$text?.toString().length || 0,
          maxes[characteristic.typeId] || 0,
        );
      }
    }
    for (const profile of profiles) {
      profile.big = [] as BSICharacteristic[];
      profile.small = [] as BSICharacteristic[];
      for (const characteristic of profile.characteristics || []) {
        const maxCharacteristicLength = maxes[characteristic.typeId];
        const localBigStringLength = profile.characteristics.length > 5 ? bigStringLength * 0.66 : bigStringLength
        if (maxCharacteristicLength > localBigStringLength) {
          profile.big.push(characteristic);
        } else {
          profile.small.push(characteristic);
        }
      }
    }

    // Sort profiles that have a "Number" characteristic
    try {
      if (profiles.length && profiles[0].characteristics.find((elt) => elt.name === "Number")) {
        profiles.sort((p1, p2) => {
          const c1 = p1.characteristics.find((c) => c.name === "Number");
          const c2 = p2.characteristics.find((c) => c.name === "Number");

          if (!c1 || !c2) {
            return 0;
          }

          if ((c1.$text || 0) > (c2.$text || 0)) {
            return 1;
          }
          if ((c1.$text || 0) < (c2.$text || 0)) {
            return -1;
          }

          return 0;
        });
      }
    } catch {
      //
    }
  }

  return profilesByType;
}

export function isProfileModified(profile: BSIProfile) {
  for (const characteristic of profile.characteristics || []) {
    if (characteristic.originalValue !== undefined && characteristic.originalValue !== characteristic.$text)
      return true;
  }
  return false;
}
export function hashProfile(profile: BSIProfile): string {
  return JSON.stringify({
    name: profile.name,
    characteristics: profile.characteristics,
    typeId: profile.typeId,
    typeName: profile.typeName,
    hidden: profile.hidden
  })
}
export function indexProfiles<T extends BSIProfile | BSIGroupedProfile>(profiles: T[], sumAmount = true): Record<string, T> {
  const hashed: { [hash: string]: T } = {};
  // const counts: { [hash: string]: number } = {};
  for (const profile of profiles) {
    // delete profile.dupeCount;
    const hash = hashProfile(profile);
    if (hash in hashed && sumAmount) {
      hashed[hash].amount = (hashed[hash].amount || 1) + (profile.amount || 1)
    } else {
      hashed[hash] = clone(profile)
      hashed[hash].amount = (profile.amount || 1)
    }
    // addOne(counts, hash);
    // profile.dupeCount = counts[hash];
  }
  const names: Record<string, number> = {};
  const totalNames: Record<string, number> = {};
  const modifieds = [];
  const not_modified = [];
  for (const profile of Object.values(hashed)) {
    if (!profile) continue;
    if (sumAmount && profile.amount && profile.amount > 1 && profile.characteristics.length > 1) {
      profile.name = `${profile.name} (x${profile.amount})`
    }
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

export function hashProfiles<T extends BSIProfile | BSIGroupedProfile>(profiles: T[], sumAmount = true): T[] {
  const hashed = indexProfiles(profiles, sumAmount);
  return Object.values(hashed);
}

export function hashAndExcludeProfiles<T extends BSIProfile | BSIGroupedProfile>(profiles: T[], toExclude: T[], sumAmount = true): T[] {
  const hashedToExclude = indexProfiles(toExclude, false);
  const hashed = indexProfiles(profiles, sumAmount);
  const hashedFiltered = {} as typeof hashed;
  for (const key in hashed) {
    if (!(key in hashedToExclude)) {
      hashedFiltered[key] = hashed[key];
    }
  }
  return Object.values(hashedFiltered);
}
