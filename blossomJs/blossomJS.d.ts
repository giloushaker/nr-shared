export type RescriptResult<T> = Record<unknown, T>;
export type FROM<T = Number> = T;
export type TO<T = Number> = T;
export type WEIGHT = number;

export type MatchCmp = {
  cmp: any;
  edgeCmp: any;
  BeltCmp: any;
};

export const Int: {
  Cmp: MatchCmp;
  make(
    cardinalityOpt = "NotMax",
    edges?: RescriptListNode<[FROM, TO, WEIGHT]>
  ): RescriptResult<[FROM<number>, TO<number>]>;
};
export const $$String: {
  Cmp: MatchCmp;
  make(
    cardinalityOpt = "NotMax",
    edges: RescriptListNode<[FROM<string>, TO<string>, WEIGHT]>
  ): RescriptResult<[FROM<string>, TO<string>]>;
};

export function toList<T>(data: RescriptResult<T>): RescriptList<T>;

interface RescriptListNode<T> {
  hd: T;
  tl: 0 | RescriptListNode<T>;
}
type RescriptList<T = any> = RescriptListNode<T>;
