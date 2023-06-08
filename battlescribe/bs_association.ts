import { Instance, ExportedNode } from "./bs_instance";
import { getInSelections } from "./bs_condition";
import { arrayRemove, sortBy, addOne } from "./bs_helpers";
import { Roster } from "./bs_system";
import { BSIQuery, BSIConditionGroup, BSICondition } from "./bs_types";
import { ErrorMessageWithHash, ErrorMessage } from "../error_manager";
import { evalConditionGroup } from "./bs_condition";
import { getAllQueries } from "./bs_modifiers";
import { buildErrorMessage } from "./bs_error";

export interface AssociationConstraint {
  type: "min" | "max";
  value: number;
  childId: string;
  field: "associations";
}
export interface NRAssociation {
  label: string;
  labelMembers: string;
  ids?: string[];
  id?: string;

  scope: string;

  min?: number;
  max?: number;
  includeChildSelections?: boolean;
  of: string;

  type?: "and" | "or";
  // constraints?: AssociationConstraint[];
  conditions?: BSICondition[];
  conditionGroups?: BSIConditionGroup[];
}
export interface Candidate {
  instance: Instance;
  selected: boolean;
  invalid: boolean;
}
export interface AssociationParent {
  onAssociationChanged(asso: NRAssociationInstance): void;
}
export class NRAssociationInstance implements NRAssociation {
  label!: string;
  labelMembers!: string;
  maxAssociationsPerMember?: number;
  ids?: string[];
  id?: string;

  scope!: string;
  min?: number;
  max?: number;
  includeChildSelections?: boolean;
  of!: string;

  type?: "and" | "or";
  conditions?: BSICondition[];
  conditionGroups?: BSIConditionGroup[];

  instances: Array<Instance>;
  parent: Instance;
  constructor(association: NRAssociation, parent: Instance & AssociationParent) {
    Object.assign(this, association);
    this.parent = parent;
    this.instances = [];
  }
  autoCheckOnInit() {
    if (!this.min) return;
    const min = this.min;
    const candidates = this.getCandidates();
    const unselected = candidates.filter((o) => !o.selected);
    const amount = this.instances.length;
    const missing = min - amount;
    if (unselected.length === missing) {
      for (const associate of unselected) {
        this.addAssociation(associate.instance);
      }
    }
  }
  getId() {
    return this.id || `${this.label}-${this.labelMembers}-${this.of}`;
  }
  autoCheckOnChecked(lastChecked: Instance) {
    if (this.min === 1) {
      const selected = this.getCandidates()
        .filter((o) => o.selected)
        .filter((o) => o.instance !== lastChecked);
      for (const associate of selected) {
        this.popAssociation(associate.instance);
      }
    }
  }
  getAmountAndMaxString(): string {
    if (this.max) {
      return `(${this.instances.length}/${this.max})`;
    }
    return `(${this.instances.length})`;
  }
  getErrors(): ErrorMessageWithHash[] {
    const errors = [];
    const name = `${this.label} ${this.labelMembers}`;
    const ofWhat = this.labelMembers;

    if (this.min !== undefined && this.instances.length < this.min) {
      errors.push(buildErrorMessage(name, "min", this.min, "associations", false, ofWhat));
    }
    if (this.max !== undefined && this.instances.length > this.max) {
      errors.push(buildErrorMessage(name, "max", this.min, "associations", false, ofWhat));
    }

    let invalid = 0;
    for (const instance of this.instances) {
      if (!this.checkAssociation(instance)) invalid++;
    }
    if (invalid) {
      errors.push(buildErrorMessage(name, "associate", invalid, "associactions", false, ofWhat));
    }

    const result = [] as ErrorMessageWithHash[];
    const unit = this.parent.getParentUnit();
    for (const msg of errors) {
      result.push({
        type: 1,
        unit: unit,
        msg: msg,
        depth: 0,
        severity: "error",
        hash: `${this.parent.getUid()}::${this.label} ${this.labelMembers}`,
      });
    }
    return result;
  }
  /** Returns wether an association with the provided instance is valid */
  checkAssociation(instance: Instance): boolean {
    if (!instance.amount) return false;
    if (instance.isHidden()) return false;
    if (this.of && !instance.hasFilter(this.of)) return false;
    if (!evalConditionGroup(instance, this)) return false;
    return true;
  }
  getMemberConstraints(instance: Instance) {
    let min = -Infinity;
    let max = Infinity;
    for (const constraint of instance.getAssociationConstraints()) {
      if (constraint.childId === "any" || this.ids?.includes(constraint.childId)) {
        switch (constraint.type) {
          case "min":
            min = Math.max(min, constraint.value);
            break;
          case "max":
            max = Math.min(max, constraint.value);
            break;
        }
      }
    }
    let amount = 0;
    loop: for (const associated of instance.associatedTo || []) {
      if (this.ids) {
        for (const id of associated.ids || []) {
          if (this.ids.includes(id)) {
            amount++;
            continue loop;
          }
        }
      }
    }
    return {
      amount: amount,
      min: min === -Infinity ? undefined : min,
      max: max === Infinity ? undefined : max,
    };
  }
  getAssociationErrors(instance: Instance): ErrorMessage[] {
    const result = [];
    if (instance.isHidden()) result.push("is Hidden");
    const constraints = this.getMemberConstraints(instance);
    if (constraints.max && constraints.amount > constraints.max) result.push(`limited to ${constraints.max}`);
    if (this.of && !instance.hasFilter(this.of)) {
      result.push(`is not a ${this.parent.getRoot().findOptionById(this.of)}`);
    }
    if (!evalConditionGroup(instance, this)) result.push(`Doesn't match conditions`);
    return result.map((msg) => {
      return {
        type: 1,
        msg: msg,
        depth: 0,
        severity: "error",
        hash: instance.uid + msg,
      };
    });
  }
  hasAssociaction(instance: Instance): boolean {
    return this.instances.find((o) => o === instance) !== undefined;
  }
  geAssociatedAmountAndMaxString(instance: Instance): string {
    const constraints = this.getMemberConstraints(instance);

    return constraints.max ? `(${constraints.amount}/${constraints.max})` : `(${constraints.amount})`;
  }
  getCandidates(): Candidate[] {
    const includeChilds = this.includeChildSelections;
    const includeChildForces = false;

    const has = {};
    for (const have of this.instances) addOne(has, have.uid);

    const cIn = getInSelections(this.parent, this.scope, undefined, includeChilds, includeChildForces);
    const cOf = cIn.filter((o) => this.checkAssociation(o) || o.uid in has);

    const result = [] as Candidate[];
    const candidates = {} as Record<string, Candidate>;
    for (const candidate of cOf) {
      candidates[candidate.uid] = {
        instance: candidate,
        selected: false,
        invalid: false,
      };
    }

    for (const selected of this.instances) {
      if (selected.uid in candidates) {
        candidates[selected.uid].selected = true;
        candidates[selected.uid].invalid = !this.checkAssociation(selected);
      } else {
        result.push({
          instance: selected,
          selected: true,
          invalid: true,
        });
      }
    }
    result.push(...Object.values(candidates));
    return result;
  }
  addAssociation(instance: Instance) {
    const already = this.instances.find((o) => o === instance);
    if (already === undefined) {
      this.instances.push(instance);
      if (!instance.associatedTo) instance.associatedTo = [];
      instance.associatedTo.push(this);
      this.instances = sortBy(this.instances, (o) => this.getInstanceLabel(o));
      this.parent.onAssociationChanged();
      instance.onAssociationChanged();
      // this.parent._cache_checkConstraints.invalidate();
      // instance._cache_checkConstraints.invalidate();
    }
  }
  popAssociation(instance: Instance) {
    arrayRemove(this.instances, instance);
    if (instance.associatedTo) {
      arrayRemove(instance.associatedTo, this);
      this.parent.onAssociationChanged();
      instance.onAssociationChanged();
      // this.parent._cache_checkConstraints.invalidate();
      // instance._cache_checkConstraints.invalidate();
    }
  }
  toggleAssociation(candidate: Candidate) {
    if (candidate.selected) {
      this.popAssociation(candidate.instance);
    } else {
      this.addAssociation(candidate.instance);
      this.autoCheckOnChecked(candidate.instance);
    }
  }
  toQueries(): Iterable<BSIQuery> {
    return associationToQueries(this);
  }
  getInstanceLabel(instance: Instance) {
    const selector = instance.selector;

    const unit = instance.isUnit() ? instance : instance.getParentUnit();
    const category = instance.getParentCategory();
    const categoryIndex = category.getChildren().findIndex((o) => o === unit);
    const categoryStr = `${category.getName()}${categoryIndex + 1}`;
    let label = `[${categoryStr}] ${instance.getName()}`;

    if (selector.instances.length > 1) {
      const headerIndex = selector.instances.findIndex((o) => o === instance);
      label += (headerIndex + 1).toString();
    }
    return label;
  }
}

export function loadAssociations(instance: Instance, json: ExportedNode) {
  if (json.associated) {
    const root = instance.getRoot();
    if (!root.associated) root.associated = {};
    for (const associated of json.associated) {
      const hash = hashAssociation(associated.uid, associated.label, associated.labelMembers);
      if (!root.associated[hash]) root.associated[hash] = [instance];
      else root.associated[hash].push(instance);
    }
  }
  if (instance.associations) {
    const root = instance.getRoot();
    if (!root.associations) root.associations = [];
    root.associations.push(...instance.associations);
  }
}

export function hashAssociation(uid: string, label: string, labelMembers: string) {
  return `${uid}::${label}::${labelMembers}`;
}
export function loadAssociationsRoster(roster: Roster) {
  if (!roster.associated) return;
  const associated = roster.associated;
  for (const association of roster.associations || []) {
    const hash = hashAssociation(association.parent.uid, association.label, association.labelMembers);
    const found = associated[hash];
    if (found) {
      for (const instance of found) {
        association.addAssociation(instance);
      }
    }
  }
}

export function saveAssociations(instance: Instance, result: ExportedNode) {
  if (instance.associatedTo) {
    result.associated = instance.associatedTo.map((o) => {
      return { uid: o.parent.uid, label: o.label, labelMembers: o.labelMembers };
    });
  }
  if (instance.associations) {
    result.uid = instance.uid;
  }
}

export function clearAssociations(instance: Instance) {
  for (const associaction of instance.associatedTo || []) {
    associaction.popAssociation(instance);
  }
  for (const association of instance.associations || []) {
    for (const associated of association.instances) {
      association.popAssociation(associated);
    }
  }
}

export function associationToQueries(association: NRAssociation): Iterable<BSIQuery> {
  return getAllQueries(association);
}

export function checkMemberConstraints(
  instance: Instance,
  constraints?: AssociationConstraint[]
): ErrorMessageWithHash[] {
  if (!constraints) return [];
  const result = [] as string[];
  const count = {} as Record<string, number>;
  for (const association of instance.associatedTo || []) {
    if (association.ids)
      for (const id of association.ids) {
        addOne(count, id);
      }
    addOne(count, "any");
  }
  for (const constraint of constraints) {
    const value = count[constraint.childId] || 0;
    switch (constraint.type) {
      case "max":
        if (value > constraint.value)
          result.push(
            buildErrorMessage(instance.getName(), "max", constraint.value, "associations", false, constraint.childId)
          );
        break;
      case "min":
        if (value < constraint.value)
          result.push(
            buildErrorMessage(instance.getName(), "min", constraint.value, "associations", false, constraint.childId)
          );
        break;
    }
  }
  if (!result.length) return result as [];
  const unit = instance.getParentUnit();
  return result.map((msg) => {
    return {
      type: 1,
      unit: unit,
      msg: msg,
      depth: 0,
      severity: "error",
      hash: instance.uid + msg,
    };
  });
}
