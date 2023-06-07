import { Base, Group, Rule } from "./bs_main";
import { Publication } from "./bs_main_catalogue";

export interface BSINamed {
  name: string;
}
export interface BSIOption {
  id: string;
  comment?: string[];
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
export interface BSICostType extends BSIOption, BSIHidden, BSINamed {}
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
}

export interface BSICondition extends BSIQuery, BSIValued {
  type: "instanceOf" | "notInstanceOf" | "atLeast" | "greaterThan" | "atMost" | "lessThan" | "equalTo" | "notEqualTo";
}
export interface BSIConditionGroup {
  type?: "and" | "or";
  conditions?: BSICondition[];
  conditionGroups?: BSIConditionGroup[];
}

export interface BSIConstraint extends BSIQuery, BSIValued, BSIOption {
  isLimit?: boolean;
  type: "min" | "max";
  shared?: boolean;
}

export interface BSICategory extends BSINamed, BSIOption {}

export type BSIModifierType =
  | "add"
  | "remove"
  | "unset-primary"
  | "set-primary"
  | "set"
  | "decrement"
  | "increment"
  | "append";

export interface BSIModifier {
  conditions?: BSICondition[];
  conditionGroups?: BSIConditionGroup[];
  repeats?: BSIRepeat[];

  type: BSIModifierType;
  field: "category" | "name" | "hidden" | string; //costId
  value: number | string | boolean;
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

export interface BSIData extends bookFileMetaData {
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
export interface BSICatalogue {
  id: string;
  name: string;
  revision: number;
  battleScribeVersion: string;
  authorName?: string;
  authorContact?: string;
  authorUrl?: string;
  library: boolean;
  gameSystemId: string;
  gameSystemRevision: number;
  catalogueLinks?: BSICatalogueLink[];
  publications?: Publication[];
  costTypes?: BSICostType[];
  profileTypes?: BSIProfileType[];
  categoryEntries?: BSICategory[];
  forceEntries?: Publication[];
  sharedSelectionEntries?: Base[];
  sharedSelectionEntryGroups?: Group[];
  sharedProfiles?: BSIProfile[];
  sharedRules?: BSIRule[];
  sharedInfoGroups?: BSIInfoGroup[];
  selectionEntries?: Base[];
  rules?: Rule[];

  xmlns: string;
  fullFilePath?: string;
}
export interface BSIDataCatalogue extends bookFileMetaData {
  catalogue: BSICatalogue;
  gameSystemId?: string;
}
export interface bookFileMetaData {
  name: string;
  short: string;
  id: number;
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
export interface BSIGameSystem {
  id: string;
  name: string;
  revision: number;
  battleScribeVersion: string;
  authorName?: string;
  authorContact?: string;
  authorUrl?: string;
  library?: boolean;
  gameSystemId?: undefined;
  catalogueLinks?: undefined;

  fullFilePath?: string;
}
export interface BSIDataSystem extends bookFileMetaData {
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
  target: T;
  type: "profile" | "rule" | "infoGroup";
  modifiers?: BSIModifier[];
  modifierGroups?: BSIModifierGroup[];
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
