import { sortByAscendingInplace, sortByAscending } from "~/assets/shared/battlescribe/bs_helpers";

type StrOrRegex = string | RegExp;
const t = sortByAscending([], (o) => o);

function isLineCondition(line: StrOrRegex[][]) {
  const token = line[0][0] as string;
  return line.length > 1 || ["type"].includes(token);
}
function parseAutoSortConfig(str: string): StrOrRegex[][][] {
  const lines = str
    .split("\n")
    .map((o) => o.trim())
    .filter((o) => o);
  const result = [];
  for (const line of lines) {
    const ands = line
      .split("&")
      .map((o) => o.trim())
      .filter((o) => o);
    const split = ands.map((o) =>
      o
        .split(":")
        .map((o) => o.trim())
        .map((o) => {
          const regexResult = /^\/(.*?)\/([gimuy]*)$/.exec(o);
          if (regexResult) {
            return RegExp(regexResult[1], regexResult[2]);
          }
          return o;
        }),
    );
    result.push(split);
  }
  return result.reverse();
}

export interface AutoSortable {
  getCosts: () => Array<{ name: string; value: number }>;
  getName: () => string;
  isGroup: () => boolean;
  isEntry: () => boolean;
  getType: () => string;
}
export interface defaultItem extends AutoSortable {
  sortIndex?: number;
}
export class AutoSortConfig<T extends AutoSortable> {
  set: (obj: T, index: number) => unknown;
  get: (obj: T) => number | undefined;
  del: (obj: T) => unknown;
  config: string;
  parsed?: StrOrRegex[][][];
  constructor(
    config: string,
    get: (obj: T) => number | undefined = (obj: defaultItem) => obj.sortIndex,
    set: (obj: T, index: number) => unknown = (obj: defaultItem, val) => (obj.sortIndex = val),
    del: (obj: T) => unknown = (obj: defaultItem) => delete obj.sortIndex,
  ) {
    this.set = set;
    this.get = get;
    this.del = del;
    this.config = config;
  }

  fixup(items: T[]) {
    let i = 1;
    for (const item of items) {
      if (this.get(item) !== undefined) {
        this.set(item, i);
        i++;
      }
    }
  }
  setConfig(config: string) {
    this.config = config;
    delete this.parsed;
  }
  evalLine(element: T, line: StrOrRegex[][]) {
    let result = 0;
    for (const rule of line) {
      const token = rule[0];
      switch (token) {
        case "type":
          const type = rule[1];
          switch (type) {
            case "group":
              result = element.isGroup() ? 0 : 1;
              break;
            case "entry":
              result = element.isEntry() ? 0 : 1;
              break;
            default:
              result = element.getType() === type ? 0 : 1;
          }
          break;
        case "name":
          result = (rule[1] as RegExp).exec(element.getName()) ? 0 : 1;
          break;
      }
      if (result === 1) return result;
    }
    return result;
  }

  doAutoSort(childs: T[], config: StrOrRegex[][][]): number {
    for (const line of config) {
      if (isLineCondition(line)) {
        sortByAscendingInplace(childs, (o) => this.evalLine(o, line));
      } else {
        const token = line[0][0] as string;
        switch (token) {
          case "cost":
            const costName = (line[0][1] as string).toLowerCase();
            sortByAscendingInplace(
              childs,
              (o) => o.getCosts().find((cost) => cost.name.toLowerCase() === costName)?.value ?? 0,
            );
            break;
          case "name":
            sortByAscendingInplace(childs, (o) => o.getName());
            break;
        }
      }
    }
    let i = 1;
    let affected = 0;
    for (const child of childs) {
      if (this.get(child) !== i) {
        affected += 1;
      }
      this.set(child, i);
      i += 1;
    }
    return affected;
  }
  autoSort(childs: T[]) {
    if (!this.parsed) {
      this.parsed = parseAutoSortConfig(this.config);
    }
    return this.doAutoSort(childs, this.parsed);
  }
}
