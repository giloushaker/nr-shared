import { Category, Force, Link, Base, Group, CategoryLink, Rule } from "./bs_main";
import { Catalogue, CatalogueLink, Publication } from "./bs_main_catalogue";
import { isObject, isDefaultObject } from "./bs_helpers";

export class NoObserve {
  get [Symbol.toStringTag](): string {
    // Anything can go here really as long as it's not 'Object'
    return "ObjectNoObserve";
  }
}
export function noObserve(): object {
  return new NoObserve();
}
export const protoMap = {
  "*": NoObserve.prototype,
  // "*": Base.prototype,
  catalogue: Catalogue.prototype,
  catalogueLinks: CatalogueLink.prototype,
  gameSystem: Catalogue.prototype,

  forceEntries: Force.prototype,
  forces: Force.prototype,
  force: Force.prototype,

  categoryEntries: Category.prototype,
  category: Category.prototype,
  categories: Category.prototype,

  link: Link.prototype,
  infoLinks: Link.prototype,
  categoryLinks: CategoryLink.prototype,
  entryLinks: Link.prototype,

  entry: Base.prototype,
  selectionEntries: Base.prototype,
  sharedSelectionEntries: Base.prototype,

  group: Group.prototype,
  selectionEntryGroups: Group.prototype,
  sharedSelectionEntryGroups: Group.prototype,

  sharedRules: Rule.prototype,
  rules: Rule.prototype,
  rule: Rule.prototype,

  publications: Publication.prototype,
  publication: Publication.prototype,
};
export const protoMapValues = Object.values(protoMap);

export const linkKeys = new Set(["infoLinks", "entryLinks", "categoryLinks"]);
export type ProtoMap = typeof protoMap;
export function getPrototypeFromKey(key: string) {
  if (key in protoMap) {
    return protoMap[key as keyof typeof protoMap]!;
  } else {
    return undefined;
  }
}

export function setPrototype<Key extends string>(
  obj: any,
  key: Key
): Key extends keyof ProtoMap ? ProtoMap[Key] : ProtoMap[keyof ProtoMap] {
  const newProto = getPrototypeFromKey(key);
  if (newProto) {
    Object.setPrototypeOf(obj, newProto);
    if ((newProto as any)._init) obj._init_();
  }
  return obj;
}

export function setPrototypeRecursive(obj: any): void {
  const stack = [obj];
  while (stack.length) {
    const current = stack.pop();
    for (const key of Object.keys(current)) {
      const value = current[key];

      if (isObject(value)) {
        //  If Array: Set Prototypes on each object inside array (assumes all objects if first is)
        if (Array.isArray(value)) {
          if (value.length && isObject(value[0])) {
            for (let i = value.length; i--; ) {
              const cur = value[i];
              if (isDefaultObject(cur)) {
                setPrototype(cur, key);
                stack.push(cur);
              }
            }
          }
        }
        //  If Object: Set Prototype on object
        else {
          if (isDefaultObject(value)) {
            setPrototype(value, key);
            stack.push(value);
          }
        }
      }
    }
  }

  // return result;
}
