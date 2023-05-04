import type { IArmyEntry } from "./systems/army_interfaces";
import type { BSIConstraint } from "./battlescribe/bs_types";

export interface ErrorMessage {
  msg: string;
  skip?: boolean;
  unit?: IArmyEntry | null;
  parent?: IArmyEntry | null;
  type: number;
  depth?: number;
  scope?: string;
  constraint?: BSIConstraint;
  severity?: "error" | "warning" | "info" | "debug";
}
export interface ErrorMessageWithHash extends ErrorMessage {
  hash: string;
}
export default class ErrorManager {
  private timeoutId = 0;
  public errors: Array<ErrorMessage>;

  constructor() {
    this.errors = new Array<ErrorMessage>();
  }

  public notifyLastError(errorStack: Array<ErrorMessage>): void {
    const errors = this.errors;
    if (errorStack.length != 0) {
      if (this.timeoutId != 0) {
        clearTimeout(this.timeoutId);
        this.timeoutId = 0;
      }

      errorStack.sort((elt1, elt2): number => {
        if ((elt1.depth || 0) < (elt2.depth || 0)) {
          return -1;
        }
        return 1;
      });
      errors.push(errorStack[0]);
      this.clearErrors();
    }
  }

  public clearErrors(): void {
    let nChar = 0;

    for (const elt of this.errors) {
      nChar += elt != undefined ? elt.msg.length : 0;
    }
    nChar *= 20;
    if (nChar >= 6000) nChar = 6000;
    if (nChar < 3000) nChar = 3000;
    this.timeoutId = window.setTimeout(() => {
      this.errors.splice(0, this.errors.length);
      this.timeoutId = 0;
    }, nChar);
  }

  private alreadyHasMessage(msgObj: ErrorMessage): boolean {
    let res = false;
    for (const elt of this.errors) {
      if (res == false && elt.msg == msgObj.msg && elt.unit == msgObj.unit) {
        res = true;
      }
    }
    return res;
  }

  public showMessages(stack: Array<ErrorMessage>): void {
    if (this.timeoutId != 0) {
      clearTimeout(this.timeoutId);
      this.timeoutId = 0;
    }

    for (const elt of stack) {
      if (this.alreadyHasMessage(elt) == false) {
        this.errors.push(elt);
      }
    }

    this.clearErrors();
  }
}
