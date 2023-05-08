import type { Instance } from "../bs_instance";

export function removeCP(name: string): string {
  return name.replace(/[-+]?[0-9]+ *CP/g, "").trim();
}
export function shortCategoryName(name: string): string {
  return name.substring(0, 2).toUpperCase();
}
export function makePlural(str: string): string {
  return str.endsWith("s") ? str : `${str}s`;
}
export function numberToStringWithPlusOrMinus(num: number): string {
  return num > 0 ? `+${num}` : `${num}`;
}
export function stripNumber(str: string): string {
  return str.replace(/[0-9]+ *[.-] *(.*)/, "$1");
}
export function parentMult(opt: Instance): number {
  if (!opt || !opt.getParent()) {
    return 1;
  }
  if (opt.getParent().getAmount() == 0) {
    return 1;
  }
  return opt.getParent().getAmount() * parentMult(opt.getParent());
}
export class StringBuilder {
  strings: string[] = [];
  addLine(text: string): void {
    this.strings.push(text);
  }
  append(text: string): void {
    if (this.strings.length) this.strings[this.strings.length - 1] += text;
    else this.addLine(text);
  }

  get(linebreak = "<br />"): string {
    return this.strings.join(linebreak);
  }

  endLine(): void {
    this.addLine("");
  }
}
export function getTimesString(num: number): string {
  return num > 1 ? `${num}x ` : "";
}
