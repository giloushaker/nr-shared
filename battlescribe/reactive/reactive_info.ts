import type { BSIRule, BSIProfile, BSIInfoLink, BSIInfoGroup } from "../bs_types";
import { infoEnabled, setChildsEnabled as setModifiersEnabled, setInfoEnabled } from "./reactive_helpers";
import {
  modify,
  ReactiveModifier,
  reactiveModifier,
  ReactiveModifierGroup,
  reactiveModifierGroup,
} from "./reactive_modifiers";
import type { HasProfileCallback, HasRuleCallback, ParentInfo, ParentModifier, QueryReactive } from "./reactive_types";
type AnyInfo = BSIInfoGroup | BSIRule | BSIProfile | BSIInfoGroup | BSIInfoLink;
type AnyLink = BSIInfoLink<AnyInfo>;
type AnyInfoOrLink = AnyInfo | AnyLink;

class ReactiveInfo<T extends AnyInfoOrLink> {
  source: T;
  fields: Record<string, any>;
  enabled: boolean;
  computed: boolean;
  reactiveModifiers = {} as Record<string, ReactiveModifier[]>;

  modifiers?: ReactiveModifier[];
  modifierGroups?: ReactiveModifierGroup[];

  profiles?: ReactiveProfile[];
  rules?: ReactiveRule[];
  infoGroups?: ReactiveInfoGroup[];
  infoLinks?: ReactiveInfoLink[];

  queries?: QueryReactive;
  instance?: HasRuleCallback & HasProfileCallback;

  constructor(source: T, parent?: ParentModifier & ParentInfo) {
    this.enabled = infoEnabled(parent);
    this.source = source;
    this.computed = false;
    this.fields = {};
  }
  modifiersEnabled(): number {
    return this.enabled ? 1 : 0;
  }
  infoEnabled(): boolean {
    return this.computed;
  }
  setEnabled(_new: boolean): void {
    this.enabled = _new;
    setModifiersEnabled(this, _new ? 1 : 0);
    this.update();
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  notify(_old: boolean) {
    throw Error("Unimplemented function: ReactiveCommon::notify");
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getDefault(_field: string) {
    throw Error("Unimplemented function: ReactiveCommon::getDefault");
  }
  onModifierChanged(modifier: ReactiveModifier) {
    const field = modifier.source.field as "hidden" | "name" | "page"; /** | "description" */
    this.fields[field] = modify(this.getDefault(field), this.reactiveModifiers[field]);
    if (field === "hidden") {
      this.update();
    } else {
      this.notify(this.computed);
    }
  }
  update() {
    const old = this.computed;
    this.computed = this.compute();
    if (old !== this.computed) {
      this.notify(old);
    }
  }
  compute(): boolean {
    return this.enabled && !this.fields.hidden;
  }

  setCallback(instance: HasProfileCallback & HasRuleCallback, immediate = false) {
    this.instance = instance;
    if (immediate && this.computed) {
      this.notify(false);
    }
  }
}
export class ReactiveRule extends ReactiveInfo<BSIRule> implements ParentModifier {
  constructor(source: BSIRule, parent?: ParentModifier & ParentInfo) {
    super(source, parent);
    this.source = source;
    this.fields = {
      name: source.name,
      hidden: source.hidden,
      page: source.page,
      description: source.description,
    };
  }
  notify(old: boolean) {
    if (this.instance) {
      this.instance.onRuleChanged(this, this.computed, old);
    }
  }
  getDefault(field: "hidden" | "name" | "page" | "description") {
    return this.source[field];
  }
}

export class ReactiveProfile extends ReactiveInfo<BSIProfile> implements ParentModifier {
  constructor(source: BSIProfile, parent?: ParentModifier & ParentInfo) {
    super(source, parent);
    this.fields = {
      name: source.name,
      hidden: source.hidden,
      page: source.page,
    };
    for (const c of source.characteristics) {
      this.fields[c.typeId] = c.$text;
    }
  }
  getDefault(field: string) {
    switch (field) {
      case "hidden":
        return this.source.hidden;
      case "name":
        return this.source.name;
      case "page":
        return this.source.page;
      default:
        return this.source.characteristics.find((o) => o.typeId === field)?.$text;
    }
  }
  notify(old: boolean) {
    if (this.instance) {
      this.instance.onProfileChanged(this, this.computed, old);
    }
  }
}

export class ReactiveInfoLink<T extends AnyInfo = AnyInfo>
  extends ReactiveInfo<BSIInfoLink<T>>
  implements ParentModifier, ParentInfo
{
  instance?: HasProfileCallback & HasRuleCallback;
  constructor(source: BSIInfoLink<T>, parent?: ParentModifier & ParentInfo) {
    super(source, parent);
    this.fields = {
      name: source.target.name,
      hidden: source.hidden || source.target.hidden,
      page: source.page || source.target.page,
    };
    if (this.isProfile()) {
      for (const c of this.source.target.characteristics) {
        this.fields[c.typeId] = c.$text;
      }
    } else if (this.isRule()) {
      this.fields.description = (source.target as BSIRule).description;
    }
  }
  isRule(): this is ReactiveInfoLink<BSIRule> {
    return this.source.type === "rule";
  }
  isGroup(): this is ReactiveInfoLink<BSIInfoGroup> {
    return this.source.type === "infoGroup";
  }
  isProfile(): this is ReactiveInfoLink<BSIProfile> {
    return this.source.type === "profile";
  }
  getDefault(field: string) {
    switch (field) {
      case "description":
        return (this.source as BSIInfoLink<BSIRule>).target.description;
      case "hidden":
        return this.source.hidden || this.source.target.hidden;
      case "name":
        return this.source.name;
      case "page":
        return this.source.page || this.source.target.page;
      default:
        return (this.source as BSIInfoLink<BSIProfile>).target.characteristics.find((o) => o.typeId === field)?.$text;
    }
  }
  notify(old: boolean) {
    if (this.isProfile()) {
      if (this.instance) this.instance.onProfileChanged(this, this.computed, old);
    } else if (this.isRule()) {
      if (this.instance) this.instance.onRuleChanged(this, this.computed, old);
    } else if (this.isGroup()) {
      setInfoEnabled(this, this.computed);
    }
  }
}
export class ReactiveInfoGroup extends ReactiveInfo<BSIInfoGroup> implements ParentModifier, ParentInfo {
  constructor(source: BSIInfoGroup, parent?: ParentModifier & ParentInfo) {
    super(source, parent);
    this.fields = {
      name: source.name,
      hidden: source.hidden,
      page: source.page,
    };
  }
  update() {
    const old = this.computed;
    this.computed = this.compute();
    if (old !== this.computed) {
      setInfoEnabled(this, this.computed);
    }
  }
  getDefault(field: string) {
    return this.fields[field];
  }
}

export function reactiveRule(src: BSIRule, parent?: ParentModifier & ParentInfo, found?: MakeReactiveInfoResult) {
  const foundModifiers: ReactiveModifier[] = [];
  const reactive = new ReactiveRule(src, parent);
  if (src.modifiers) {
    reactive.modifiers = src.modifiers.map((o) => reactiveModifier(o, reactive, found?.foundQueries, foundModifiers));
  }
  if (src.modifierGroups) {
    reactive.modifierGroups = src.modifierGroups.map((o) =>
      reactiveModifierGroup(o, reactive, found?.foundQueries, foundModifiers)
    );
  }
  for (const modifier of foundModifiers) {
    if (modifier.source.field in reactive.reactiveModifiers) {
      reactive.reactiveModifiers[modifier.source.field].push(modifier);
    } else {
      reactive.reactiveModifiers[modifier.source.field] = [modifier];
    }
    modifier.setCallback(reactive, true);
  }
  if (found?.foundRules) {
    found.foundRules.push(reactive);
  }
  reactive.update();
  return reactive;
}
export function reactiveProfile(src: BSIProfile, parent?: ParentModifier & ParentInfo, found?: MakeReactiveInfoResult) {
  const foundModifiers: ReactiveModifier[] = [];
  const reactive = new ReactiveProfile(src, parent);
  if (src.modifiers) {
    reactive.modifiers = src.modifiers.map((o) => reactiveModifier(o, reactive, found?.foundQueries, foundModifiers));
  }
  if (src.modifierGroups) {
    reactive.modifierGroups = src.modifierGroups.map((o) =>
      reactiveModifierGroup(o, reactive, found?.foundQueries, foundModifiers)
    );
  }
  for (const modifier of foundModifiers) {
    if (modifier.source.field in reactive.reactiveModifiers) {
      reactive.reactiveModifiers[modifier.source.field].push(modifier);
    } else {
      reactive.reactiveModifiers[modifier.source.field] = [modifier];
    }
    modifier.setCallback(reactive, true);
  }
  if (found?.foundProfiles) {
    found.foundProfiles.push(reactive);
  }
  reactive.update();
  return reactive;
}
export function reactiveInfoLink(
  src: BSIInfoLink,
  parent?: ParentModifier & ParentInfo,
  found?: MakeReactiveInfoResult
): ReactiveInfoLink {
  const foundModifiers: ReactiveModifier[] = [];
  const reactive = new ReactiveInfoLink(src, parent);
  if (src.modifiers) {
    reactive.modifiers = reactive.modifiers || [];
    for (const o of src.modifiers) {
      reactive.modifiers.push(reactiveModifier(o, reactive, found?.foundQueries, foundModifiers));
    }
  }
  if (src.target.modifiers) {
    reactive.modifiers = reactive.modifiers || [];
    for (const o of src.target.modifiers) {
      reactive.modifiers.push(reactiveModifier(o, reactive, found?.foundQueries, foundModifiers));
    }
  }
  if (src.modifierGroups) {
    reactive.modifierGroups = reactive.modifierGroups || [];
    for (const o of src.modifierGroups) {
      reactive.modifierGroups.push(reactiveModifierGroup(o, reactive, found?.foundQueries, foundModifiers));
    }
  }
  if (src.target.modifierGroups) {
    reactive.modifierGroups = reactive.modifierGroups || [];
    for (const o of src.target.modifierGroups) {
      reactive.modifierGroups.push(reactiveModifierGroup(o, reactive, found?.foundQueries, foundModifiers));
    }
  }
  for (const modifier of foundModifiers) {
    if (modifier.source.field in reactive.reactiveModifiers) {
      reactive.reactiveModifiers[modifier.source.field].push(modifier);
    } else {
      reactive.reactiveModifiers[modifier.source.field] = [modifier];
    }
    modifier.setCallback(reactive, true);
  }
  if (reactive.isGroup()) {
    reactiveInfo(src, reactive, found);
    reactiveInfo(src.target, reactive, found);
  } else if (reactive.isRule()) {
    found?.foundRules.push(reactive);
  } else if (reactive.isProfile()) {
    found?.foundProfiles.push(reactive);
  }

  reactive.update();
  return reactive;
}
function reactiveInfo(src: BSIInfoGroup, parent: ReactiveInfoGroup | ReactiveInfoLink, found?: MakeReactiveInfoResult) {
  if (src.rules) {
    parent.rules = parent.rules || [];
    for (const o of src.rules) {
      parent.rules.push(reactiveRule(o, parent, found));
    }
  }
  if (src.profiles) {
    parent.profiles = parent.profiles || [];
    for (const o of src.profiles) {
      parent.profiles.push(reactiveProfile(o, parent, found));
    }
  }
  if (src.infoLinks) {
    parent.infoLinks = parent.infoLinks || [];
    for (const o of src.infoLinks) {
      parent.infoLinks.push(reactiveInfoLink(o, parent, found));
    }
  }

  if (src.infoGroups) {
    parent.infoGroups = parent.infoGroups || [];
    for (const o of src.infoGroups) {
      parent.infoGroups.push(reactiveInfoGroup(o, parent, found));
    }
  }
}
export function reactiveInfoGroup(
  src: BSIInfoGroup,
  parent?: ParentModifier & ParentInfo,
  found?: MakeReactiveInfoResult
) {
  const foundModifiers: ReactiveModifier[] = [];
  const reactive = new ReactiveInfoGroup(src, parent);
  if (src.modifiers) {
    reactive.modifiers = src.modifiers.map((o) => reactiveModifier(o, reactive, found?.foundQueries, foundModifiers));
  }
  if (src.modifierGroups) {
    reactive.modifierGroups = src.modifierGroups.map((o) =>
      reactiveModifierGroup(o, reactive, found?.foundQueries, foundModifiers)
    );
  }
  for (const modifier of foundModifiers) {
    if (modifier.source.field in reactive.reactiveModifiers) {
      reactive.reactiveModifiers[modifier.source.field].push(modifier);
    } else {
      reactive.reactiveModifiers[modifier.source.field] = [modifier];
    }
    modifier.setCallback(reactive, true);
  }
  reactiveInfo(src, reactive, found);
  reactive.update();
  return reactive;
}
export type ReactiveRuleT = ReactiveInfoLink<BSIRule> | ReactiveRule;
export type ReactiveProfileT = ReactiveInfoLink<BSIProfile> | ReactiveProfile;

interface MakeReactiveInfoResult {
  foundQueries: Array<QueryReactive>;
  foundRules: Array<ReactiveRuleT>;
  foundProfiles: Array<ReactiveProfileT>;
}

export function makeReactiveInfo(
  obj: HasProfileCallback & HasRuleCallback,
  rules?: Iterable<BSIRule>,
  profiles?: Iterable<BSIProfile>,
  infoLinks?: Iterable<BSIInfoLink>,
  infoGroups?: Iterable<BSIInfoGroup>
) {
  const result = {
    foundRules: [],
    foundProfiles: [],
    foundQueries: [],
  } as MakeReactiveInfoResult;
  if (rules) {
    for (const rule of rules) {
      reactiveRule(rule, undefined, result);
    }
  }
  if (profiles) {
    for (const profile of profiles) {
      reactiveProfile(profile, undefined, result);
    }
  }
  if (infoLinks) {
    for (const link of infoLinks) {
      reactiveInfoLink(link, undefined, result);
    }
  }
  if (infoGroups) {
    for (const group of infoGroups) {
      reactiveInfoGroup(group, undefined, result);
    }
  }
  for (const rule of result.foundRules) {
    rule.setCallback(obj, true);
  }
  for (const profile of result.foundProfiles) {
    profile.setCallback(obj, true);
  }
  return result;
}

export function ReactiveProflileToBSIProfile(profile: ReactiveProfileT): BSIProfile {
  const source = profile.source;
  const target = (source as BSIInfoLink<BSIProfile>).target
    ? (source as BSIInfoLink<BSIProfile>).target
    : (profile.source as BSIProfile);
  return {
    characteristics: target.characteristics.map((o) => {
      return {
        name: o.name,
        typeId: o.typeId,
        $text: profile.fields[o.typeId],
        originalValue: profile.getDefault(o.typeId),
      };
    }),
    id: profile.source.id,
    name: profile.fields.name,
    hidden: profile.fields.hidden,
    typeId: target.typeId,
    typeName: target.typeName,
    page: target.page,
    publication: source.publication || target.publication,
  } as BSIProfile;
}
export function ReactiveRuleToBSIRule(rule: ReactiveRuleT): BSIRule {
  const source = rule.source;
  const fields = rule.fields;
  const target = (source as BSIInfoLink<BSIRule>).target as BSIRule | undefined;
  return {
    id: source.id,
    hidden: !rule.computed,
    name: fields.name,
    description: fields.description,
    page: fields.page,
    publication: source.publication || target?.publication,
  };
}
