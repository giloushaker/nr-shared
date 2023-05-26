import { Category, Force, Link, Base, Group, CategoryLink, Rule } from "./bs_main";
import { Catalogue, CatalogueLink, Publication } from "./bs_main_catalogue";
import { isObject, isDefaultObject } from "./bs_helpers";
import { getTypeName } from "./bs_editor";

export class NoObserve {
  get [Symbol.toStringTag](): string {
    // Anything can go here really as long as it's not 'Object'
    return "ObjectNoObserve";
  }
}
export function noObserve(): object {
  return new NoObserve();
}

const keyInfoCache = {} as Record<string, any>;
function getKeyInfoClass(cache: Record<string, any>, parentKey: string, obj: any): any {
  if (parentKey in cache) {
    return cache[parentKey];
  }
  const _key = class extends Base {
    get parentKey(): string {
      return parentKey;
    }
    get editorTypeName(): string {
      return getTypeName(parentKey, this);
    }
    toString(): string {
      return `${this.editorTypeName} - ${this.getName()}`;
    }
  };
  _key.prototype.parentKey;
  Object.setPrototypeOf(_key.prototype, Object.getPrototypeOf(obj));
  cache[parentKey] = _key.prototype;
  return _key.prototype;
}
function setKeyInfo(cache: Record<string, any>, key: string, obj: any): void {
  Object.setPrototypeOf(obj, getKeyInfoClass(cache, key, obj));
}
export const protoMap = {
  "*": Base.prototype,
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
export type ProtoMap = typeof protoMap;
export function getPrototypeFromKey(key: string) {
  if (key in protoMap) {
    return protoMap[key as keyof typeof protoMap]!;
  } else {
    return protoMap["*"];
  }
}

export function setPrototype<Key extends string>(
  obj: any,
  key: Key
): Key extends keyof ProtoMap ? ProtoMap[Key] : ProtoMap[keyof ProtoMap] {
  const newProto = getPrototypeFromKey(key);
  if (newProto) {
    Object.setPrototypeOf(obj, newProto);
    if ((obj as any).post_init) obj.post_init();
    if ((globalThis as any).isEditor) {
      setKeyInfo(obj.keyInfoCache || keyInfoCache, key, obj);
    }
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
