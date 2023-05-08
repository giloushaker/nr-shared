import { ErrorMessage } from "../../shared/error_manager";
import { IArmyEntry } from "../../shared/systems/army_interfaces";

interface OptionMod {
  option: any;
  val: any;
}

export default class AlgoSettings {
  public currentDepth = 0;
  public errorStack: Array<ErrorMessage> = [];
  public warningStack: Array<ErrorMessage> = [];
  public modStack: Array<OptionMod> = [];

  public logWarnings = true;
  public logOwnUnitWarnings = true;
  public logErrors = true;

  public recheckingAll = false;
  public autofixOtherUnits = true;
  public autofixUnit = true;
  public allowArmyErrors = false;
  public allowModifications = true;
  public stopOnError = true;
  public automaticMode = true;
  public displayStatus = false;
  public disableLocalConstraints = false;

  public reset(): void {
    this.modStack = [];
    this.currentDepth = 0;
    this.clearErrors();
  }

  public clearErrors(): void {
    this.errorStack = [];
    this.warningStack = [];
  }

  public logError(type: number, node: any | null, unit: IArmyEntry | null, text: string): void {
    if (this.logErrors == false) {
      return;
    }
    let depth = this.currentDepth;

    if (node?.field("skipErrors") === true) {
      depth = 1000;
    }

    if (type == 0) {
      this.warningStack.push({
        type: type,
        msg: text,
        unit: unit,
        depth: depth,
      });
    }

    if (type == 1) {
      this.errorStack.push({
        type: type,
        msg: text,
        unit: unit,
        depth: depth,
      });
    }
  }
}
