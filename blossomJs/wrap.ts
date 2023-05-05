import * as Match from "./blossomJS";
function toRescriptList<T>(input: Array<T>): Match.RescriptList<T> {
  const result = {} as Match.RescriptList<T>;
  let current = result;
  for (const value of input) {
    current.tl = {} as Match.RescriptListNode<T>;
    current = current.tl;
    current.hd = value;
  }
  current.tl = 0;
  return result.tl as any;
}
function toArray<T>(input: Match.RescriptList<T>): Array<T> {
  const result = [] as Array<T>;
  let current = input;
  while (true) {
    result.push(current.hd);
    if (current.tl === 0) break;
    current = current.tl;
  }
  return result;
}
export function blossomJs<T extends string | number>(input: Array<[T, T, number]>): Array<[T, T]> {
  if (!input.length) return [];
  let result: Match.RescriptResult<[T, T]>;
  const preparedInput = toRescriptList(input);
  const cardinality = undefined;
  if (typeof input[0][0] === "string")
    result = Match.$$String.make(cardinality, preparedInput as Match.RescriptList<[string, string, number]>);
  else if (typeof input[0][0] === "number")
    result = Match.Int.make(cardinality, preparedInput as Match.RescriptList<[number, number, number]>);
  else throw Error("Invalid Argument");
  return toArray(Match.toList(result));
}

export function blossomJsNoDuplicates<T extends string | number>(
  input: Array<[T, T, number]>,
  min?: boolean
): Array<[T, T]> {
  const raw = blossomJs(input);
  const result = [];
  const set = new Set<string>();
  for (const value of raw) {
    const str = JSON.stringify(value.sort());
    if (set.has(str)) continue;
    set.add(str);
    result.push(value);
  }
  return result;
}
