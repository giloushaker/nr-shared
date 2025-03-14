export interface BSICommentable {
  comment?: string
}
export interface BSIOption extends BSICommentable {
  id: string;
  sortIndex?: number
}
export interface BSINamed extends BSICommentable {
  name: string;
  id: string;
}
export interface BSIAliasable {
  alias?: string[]
  noindex?: boolean;
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
export interface BSICostType extends BSIOption, BSIHidden, BSINamed, BSIModifiable {
  defaultCostLimit: number;
}
export interface BSISelectionCategory extends BSINamed {
  primary?: boolean;
  entryId: string;
}
export interface BSICost {
  name: string;
  value: number;
  typeId: string;
}

export interface BSIValued {
  value: number;
  percentValue?: boolean;
}

export interface BSIQuery extends BSICommentable {
  scope: string | "parent" | "force" | "roster" | "primary-catalogue" | "primary-category";
  childId?: string | "any" | "model" | "unit" | "upgrade" | "mount" | "crew";
  field: string | "selections" | "forces";
  includeChildSelections?: boolean;
  includeChildForces?: boolean;
  type?: BSIConstraint["type"] | BSICondition["type"];
  percentValue?: boolean;
  shared?: boolean;
}
export interface BSIRepeatable {
  repeats: number;
  roundUp?: boolean;
}

export interface BSIRepeat extends BSIQuery, BSIValued, BSIRepeatable { }
export interface BSICosts {
  costs?: BSICost[]
}

export interface BSICondition extends BSIQuery, BSIValued {
  type: "instanceOf" | "notInstanceOf" | "atLeast" | "greaterThan" | "atMost" | "lessThan" | "equalTo" | "notEqualTo";
}

export interface BSIConditional {
  conditions?: BSICondition[];
  conditionGroups?: BSIConditionGroup[];
  localConditionGroups?: BSILocalConditionGroup[];
}

export interface BSIConditionGroup extends BSIConditional, BSICommentable {
  type?: "and" | "or" | "not" | "greater" | "greaterOrEqual" | "less" | "lessOrEqual" | "equal" | "notEqual";
}

export interface BSILocalConditionGroup extends BSIConditional, BSICommentable, BSIQuery, BSIValued, BSIRepeatable {
  type: "atLeast" | "greaterThan" | "atMost" | "lessThan" | "equalTo" | "notEqualTo";
}

export interface BSIConstraint extends BSIQuery, BSIValued, BSICommentable {
  id: string;
  isLimit?: boolean;
  type: "min" | "max" | "exactly";
  shared?: boolean;
  negative?: boolean;
  message?: string;
  automatic?: boolean;
}

export interface BSICategory extends BSINamed { }

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
  | "modulo"
  | "append"
  | "prepend"
  | "replace"
  | "floor"
  | "ceil";

export interface BSIModifier extends BSIConditional, BSICommentable {
  repeats?: BSIRepeat[];
  type: BSIModifierType;
  field: "category" | "name" | "hidden" | string; //costId
  value: number | string | boolean;
  arg?: number | string | boolean;
  position?: number;
  join?: string;

  scope?: string;
  affects?: string;
}
export interface BSIModifiable {
  modifiers?: BSIModifier[];
  modifierGroups?: BSIModifierGroup[];
}
export interface BSIModifierGroup extends BSIConditional, BSIModifiable, BSICommentable {
  repeats?: BSIRepeat[];
}

export interface BSICharacteristic {
  name: string;
  typeId: string;
  $text: string | number;
  originalValue?: string | number | boolean;
}
export interface BSIAttribute {
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

export interface BSIConstrainable {
  constraints?: BSIConstraint[];
}

export interface BSIForce extends BSINamed, BSIReference, BSIHidden {
  categoryLinks?: BSICategoryLink[];
  forceEntries?: BSIForce[];
  childForcesLabel?: string;
}

export interface BSIInfo {
  infoLinks?: BSIInfoLink[];
  infoGroups?: BSIInfoGroup[];
  profiles?: BSIProfile[];
  rules?: BSIRule[];
}
export interface BSISelectionEntryGroup
  extends BSINamed,
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
  collective?: boolean;
}
export interface BSIEntryLink extends BSILink, BSIConstrainable, BSIModifiable, BSIReference {
  type: "selectionEntry" | "selectionEntryGroup"
  costs: BSICost[];
  collective?: boolean;

}
export interface BSISelectionEntry
  extends BSINamed,
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
  costs?: BSICost[];
  collective?: boolean;

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
  library?: boolean;

  fullFilePath?: string;
  sha?: string;
  xmlns?: string;
}
export interface BSIGameSystem extends BSIDataCommon {
  gameSystemId?: undefined;
  catalogueLinks?: undefined;
}
export interface BSICatalogue extends BSIDataCommon {
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

export interface BSIProfile extends BSINamed, BSIHidden, BSICommentable, BSIReference, BSIModifiable {
  characteristics: BSICharacteristic[];
  attributes: BSIAttribute[];
  typeId: string;
  typeName: string;
  group?: string;
  amount?: number;
}

export interface BSICharacteristicType extends BSINamed {
}
export interface BSIAttributeType extends BSINamed {
}

export interface BSIProfileType extends BSINamed {
  characteristicTypes?: BSICharacteristicType[];
  attributeTypes?: BSIAttributeType[]
  sortIndex?: number;
}

export interface BSIRule extends BSINamed, BSIHidden, BSIModifiable, BSICommentable, BSIReference {
  description: string;
}

export interface BSIInfoLink<
  T extends BSIInfoGroup | BSIRule | BSIProfile | BSIInfoGroup = BSIInfoGroup | BSIRule | BSIProfile | BSIInfoGroup
> extends BSINamed, BSIHidden, BSICommentable, BSIModifiable, BSIReference {
  targetId: string;
  target?: T;
  type: "profile" | "rule" | "infoGroup";
  characteristics?: BSICharacteristic[];
}
export interface BSIInfoGroup extends BSICommentable, BSINamed, BSIHidden, BSIModifiable, BSIReference {
  profiles?: BSIProfile[];
  rules?: BSIRule[];
  infoGroups?: BSIInfoGroup[];
  infoLinks?: BSIInfoLink[];
}

export interface BSIPublication extends BSICommentable, BSINamed {
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
export interface NRAssociation extends BSINamed, BSICommentable {
  ids?: string[];
  min?: number;
  max?: number;

  scope: string;
  includeChildSelections?: boolean;
  childId: string;


  // if in same unit defaults to "add" else "keep"
  info?: "none" | "append" | "replace" | "append-self" | "replace-self"
}
