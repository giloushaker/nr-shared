export interface BSINamed {
  name: string;
}
export interface BSIOption {
  id: string;
  comment?: string;
}
export interface BSIHidden {
  hidden: boolean;
}
export interface BSILink extends BSINamed, BSIOption, BSIHidden {
  targetId: string;
  import?: boolean;
}

export interface BSICategoryLink extends BSILink {
  primary?: boolean;
}
export interface BSICostType extends BSIOption, BSIHidden, BSINamed {
  defaultCostLimit: number;
}
export interface BSISelectionCategory {
  name: string;
  id: string;
  primary?: boolean;
  entryId: string;
}
export interface BSICost extends BSINamed {
  value: number;
  typeId: string;
}

export interface BSIValued {
  value: number;
  percentValue?: boolean;
}

export interface BSIQuery {
  scope: string | "parent" | "force" | "roster" | "primary-catalogue" | "primary-category";
  childId?: string | "any" | "model" | "unit" | "upgrade" | "mount" | "crew";
  field: string | "selections" | "forces";
  includeChildSelections?: boolean;
  includeChildForces?: boolean;
  type?: BSIConstraint["type"] | BSICondition["type"];
  percentValue?: boolean;
  shared?: boolean;
}

export interface BSIRepeat extends BSIQuery, BSIValued {
  repeats: number;
  roundUp?: boolean;
  id: string;
}

export interface BSICondition extends BSIQuery, BSIValued {
  type: "instanceOf" | "notInstanceOf" | "atLeast" | "greaterThan" | "atMost" | "lessThan" | "equalTo" | "notEqualTo";
}
export interface BSIConditionGroup {
  type?: "and" | "or" | "exactly";
  conditions?: BSICondition[];
  conditionGroups?: BSIConditionGroup[];
}

export interface BSIConstraint extends BSIQuery, BSIValued, BSIOption {
  isLimit?: boolean;
  type: "min" | "max" | "exactly";
  shared?: boolean;
}

export interface BSICategory extends BSINamed, BSIOption { }

export type BSIModifierType =
  | "add"
  | "remove"
  | "unset-primary"
  | "set-primary"
  | "set"
  | "decrement"
  | "increment"
  | "multiply"
  | "divide"
  | "append"
  | "prepend"
  | "replace";

export interface BSIModifier {
  conditions?: BSICondition[];
  conditionGroups?: BSIConditionGroup[];
  repeats?: BSIRepeat[];

  type: BSIModifierType;
  field: "category" | "name" | "hidden" | string; //costId
  value: number | string | boolean;
  arg?: number | string | boolean;
  last_value?: number;
}
export interface BSIModifierGroup {
  modifiers?: BSIModifier[];
  modifierGroups?: BSIModifierGroup[];
  conditions?: BSICondition[];
  conditionGroups?: BSIConditionGroup[];
  repeats?: BSIRepeat[];
}

export interface BSICharacteristic {
  name: string;
  typeId: string;
  $text: string | number;
  originalValue?: string | number | boolean;
}

export interface SupportedQueries {
  conditions?: BSICondition[];
  conditionGroups?: BSIConditionGroup[];
  repeats?: BSIRepeat[];
  modifiers?: BSIModifier[];
}
export interface BSIModifiable {
  modifers?: BSIModifier[];
  modiferGroups?: BSIModifierGroup[];
}
export interface BSIConstrainable {
  constraints?: BSIConstraint[];
}

export interface BSIForce extends BSINamed, BSIOption, BSIReference, BSIHidden {
  categoryLinks?: BSICategoryLink[];
  forceEntries?: BSIForce[];
}

export interface BSIInfo {
  infoLinks?: BSIInfoLink[];
  infoGroups?: BSIInfoGroup[];
  profiles?: BSIProfile[];
  rules?: BSIRule[];
}
export interface BSISelectionEntryGroup
  extends BSINamed,
  BSIOption,
  BSIReference,
  BSIModifiable,
  BSIConstrainable,
  BSIHidden {
  defaultSelectionEntryId?: string;
  selectionEntries?: BSISelectionEntry[];
  selectionEntryGroups?: BSISelectionEntryGroup[];
  entryLinks?: BSILink[];
  categoryLinks?: BSICategoryLink[];
  import?: boolean;
}
export interface BSIEntryLink extends BSILink, BSIConstrainable, BSIModifiable, BSIReference {
  type: "selectionEntry" | "selectionEntryGroup"
  costs: BSICost[];

}
export interface BSISelectionEntry
  extends BSINamed,
  BSIOption,
  BSIReference,
  BSIModifiable,
  BSIConstrainable,
  BSIHidden,
  BSIInfo {
  type: string;
  subType?: string;
  selectionEntries?: BSISelectionEntry[];
  selectionEntryGroups?: BSISelectionEntryGroup[];
  entryLinks?: BSIEntryLink[];
  categoryLinks?: BSICategoryLink[];
  import?: boolean;
  costs: BSICost[];

}
export interface BSIData extends Partial<bookFileMetaData> {
  gameSystem?: BSIGameSystem;
  catalogue?: BSICatalogue;
  xml_hash?: string;
  url?: string;
}

export interface BSICatalogueLink {
  name?: string;
  targetId: string;
  importRootEntries?: boolean;
  targetRevision?: number;
}
export interface BSIDataCommon {
  id: string;
  name: string;
  revision: number;
  battleScribeVersion: string;
  authorName?: string;
  authorContact?: string;
  authorUrl?: string;
  publications?: BSIPublication[];
  costTypes?: BSICostType[];
  profileTypes?: BSIProfileType[];
  categoryEntries?: BSICategory[];
  forceEntries?: BSIForce[];
  sharedSelectionEntries?: BSISelectionEntry[];
  sharedSelectionEntryGroups?: BSISelectionEntryGroup[];
  sharedProfiles?: BSIProfile[];
  sharedRules?: BSIRule[];
  sharedInfoGroups?: BSIInfoGroup[];
  selectionEntries?: BSISelectionEntry[];
  rules?: BSIRule[];

  fullFilePath?: string;
  xmlns?: string;
}
export interface BSIGameSystem extends BSIDataCommon {
  gameSystemId?: undefined;
  catalogueLinks?: undefined;
}
export interface BSICatalogue extends BSIDataCommon {
  library: boolean;
  gameSystemId: string;
  gameSystemRevision: number;
  catalogueLinks?: BSICatalogueLink[];
}
export interface BSIDataCatalogue extends Partial<bookFileMetaData> {
  catalogue: BSICatalogue;
  gameSystemId?: string;
}
export interface BSIReference {
  publicationId?: string;
  publication?: BSIPublication;
  page?: string;
}
export interface bookFileMetaData {
  name: string;
  short: string;
  id: number | string;
  bsid?: string;
  path: string;
  playable: boolean;

  lastUpdated?: string;
  version: number | string;
  nrversion: number;

  gameSystemId?: string;
  gstpath?: string;

  include: number[];

  url?: string;
  xml_hash?: string;
}

export interface BSIDataSystem extends Partial<bookFileMetaData> {
  gameSystem: BSIGameSystem;
}
export interface SavedRoster {
  id: string;
  name: string;
  battleScribeVersion: string;
  gameSystemId: string;
  gameSystemName: string;
  gameSystemRevision: string;
  xmlns: string;
  forces: SavedForce[];
  selections: SavedSelection[];
  costs: BSICost[];
  costLimits: BSICost[];
}
export interface SavedForce {
  id: string;
  name: string;
  customName?: string;
  entryId: string;
  catalogueId: string;
  catalogueRevision: string;
  catalogueName: string;
  selections: SavedSelection[];
  forces?: SavedForce[];
}
export interface SavedSelection {
  id: string;
  name: string;
  customName?: string;
  entryId: string;
  number: number;
  type: string;
  costs: any[];
  selections?: SavedSelection[];
  associations?: Array<{ to: string; associationId: string }>;
  categories?: SavedCategory[];
  entryGroupId?: string;
}

export interface SavedCategory {
  id: string;
  name: string;
  entryId: string;
  primary: boolean;
}
export interface SupportedQueries {
  conditions?: BSICondition[];
  conditionGroups?: BSIConditionGroup[];
  repeats?: BSIRepeat[];
  modifiers?: BSIModifier[];
}

export interface BSIProfile {
  comment?: string;
  characteristics: BSICharacteristic[];
  id: string;
  name: string;
  hidden: boolean;
  typeId: string;
  typeName: string;
  publicationId?: string;
  publication?: BSIPublication;
  page?: string;
  modifiers?: BSIModifier[];
  modifierGroups?: BSIModifierGroup[];
}

export interface BSICharacteristicType {
  name: string;
  id: string;
}

export interface BSIProfileType extends BSINamed, BSIOption {
  characteristicTypes: BSICharacteristicType[];
  sortIndex?: number;
}

export interface BSIRule {
  id: string;
  name: string;
  description: string | string[];
  hidden: boolean;
  publicationId?: string;
  publication?: BSIPublication;
  page?: string;
  modifiers?: BSIModifier[];
  modifierGroups?: BSIModifierGroup[];
}

export interface BSIInfoLink<
  T extends BSIInfoGroup | BSIRule | BSIProfile | BSIInfoGroup = BSIInfoGroup | BSIRule | BSIProfile | BSIInfoGroup
> {
  id: string;
  name: string;
  hidden: boolean;
  publicationId?: string;
  publication?: BSIPublication;
  page?: string;
  targetId: string;
  target?: T;
  type: "profile" | "rule" | "infoGroup";
  modifiers?: BSIModifier[];
  modifierGroups?: BSIModifierGroup[];
  characteristics?: BSICharacteristic[];
}
export interface BSIInfoGroup {
  id: string;
  name: string;
  hidden: boolean;
  page?: string;

  profiles?: BSIProfile[];
  rules?: BSIRule[];
  infoGroups?: BSIInfoGroup[];
  infoLinks?: BSIInfoLink[];
  modifiers?: BSIModifier[];
  modifierGroups?: BSIModifierGroup[];
}

export interface BSIPublication {
  id: string;
  name?: string;
  shortName?: string;
  publisher?: string;
  publicationDate?: string | number;
  publisherUrl?: string;
}

export interface AssociationConstraint {
  type: "min" | "max";
  value: number;
  childId: string;
  field: "associations";
}
export interface NRAssociation {
  name: string;
  id?: string;

  ids?: string[];
  min?: number;
  max?: number;

  scope: string;
  includeChildSelections?: boolean;
  childId: string;
}
