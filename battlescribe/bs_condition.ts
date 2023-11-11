import type { EditorBase } from "./bs_main_catalogue";

export const validScopes = new Set([
  "force",
  "roster",
  "self",
  "parent",
  "ancestor",
  "primary-category",
  "force",
  "roster",
  "primary-catalogue",
]);
export const validChildIds = new Set(["any", "unit", "model", "upgrade"]);
export function isScopeValid(parent: EditorBase, scope: string) {
  if (validScopes.has(scope)) return true;
  const catalogue = parent.catalogue;
  const found = catalogue.findOptionById(scope);
  if (found) {
    if (found.isForce()) return true;
    if (found.isCategory()) return true;
    if (found.isCatalogue()) return true;
  }
  const stack = [parent];
  while (stack.length) {
    const current = stack.pop()!;
    if (current.id === scope) return true;

    // check links
    // if (current.links) {
    //   for (const link of current.links) {
    //     stack.push(link);
    //   }
    // }

    if (current.parent) [stack.push(current.parent)];
  }
  return false;
}
