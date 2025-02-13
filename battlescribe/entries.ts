export const entries = {
  catalogueLinks: {
    type: "catalogueLink"
  },
  publications: {
    type: "publication"
  },
  costs: {
    type: "cost",
  },
  costTypes: {
    allowedChildrens: ["modifiers"],
    type: "costType"
  },
  costLimits: {
    type: "costLimit"
  },
  profileTypes: {
    allowedChildrens: ["characteristicTypes", "attributeTypes"],
    type: "profileType"
  },
  characteristicTypes: {
    type: "characteristicType"
  },
  characteristics: {
    type: "characteristic"
  },
  attributeTypes: {
    type: "attributeType"
  },
  attributes: {
    type: "attribute"
  },
  categoryEntries: {
    allowedChildrens: ["profiles", "rules", "infoGroups", "infoLinks", "constraints", "modifiers", "modifierGroups"],
    type: "categoryEntry"
  },
  categoryLinks: {
    allowedChildrens: ["profiles", "rules", "infoGroups", "infoLinks", "constraints", "modifiers", "modifierGroups"],
    type: "categoryLink"
  },
  forceEntries: {
    allowedChildrens: [
      "forceEntries",
      "categoryLinks",
      "profiles",
      "rules",
      "infoGroups",
      "infoLinks",
      "constraints",
      "modifiers",
      "modifierGroups",
      "costs",
    ],
    type: "forceEntry"
  },
  entryLinks: {
    allowedChildrens: "type",
    type: "entryLink"
  },
  selectionEntryGroups: {
    allowedChildrens: [
      "selectionEntries",
      "selectionEntryGroups",
      "entryLinks",
      "profiles",
      "rules",
      "infoGroups",
      "infoLinks",
      "constraints",
      "modifiers",
      "modifierGroups",
      "categoryLinks",
      "costs",
    ],
    type: "selectionEntryGroup"
  },
  sharedSelectionEntryGroups: {
    allowedChildrens: [
      "selectionEntries",
      "selectionEntryGroups",
      "entryLinks",
      "profiles",
      "rules",
      "infoGroups",
      "infoLinks",
      "constraints",
      "modifiers",
      "modifierGroups",
      "categoryLinks",
      "costs",
    ],
    type: "selectionEntryGroup"
  },
  selectionEntries: {
    allowedChildrens: [
      "selectionEntries",
      "selectionEntryGroups",
      "entryLinks",
      "profiles",
      "rules",
      "infoGroups",
      "infoLinks",
      "associations",
      "constraints",
      "modifiers",
      "modifierGroups",
      "categoryLinks",
      "costs",
    ],
    type: "selectionEntry"
  },
  sharedSelectionEntries: {
    allowedChildrens: [
      "selectionEntries",
      "selectionEntryGroups",
      "entryLinks",
      "profiles",
      "rules",
      "infoGroups",
      "infoLinks",
      "associations",
      "constraints",
      "modifiers",
      "modifierGroups",
      "categoryLinks",
      "costs",
    ],
    type: "selectionEntry"
  },
  associations: {
    type: "association"
  },
  sharedRules: {
    allowedChildrens: ["modifiers", "modifierGroups"],
    type: "rule"
  },
  rules: {
    allowedChildrens: ["modifiers", "modifierGroups"],
    type: "rule"
  },
  profiles: {
    allowedChildrens: ["modifiers", "modifierGroups", "characteristics", "attributes"],
    type: "profile"
  },
  sharedProfiles: {
    allowedChildrens: ["modifiers", "modifierGroups", "characteristics", "attributes"],
    type: "profile"
  },
  infoGroups: {
    allowedChildrens: ["profiles", "rules", "infoGroups", "infoLinks", "modifiers", "modifierGroups"],
    type: "infoGroup"
  },
  sharedInfoGroups: {
    allowedChildrens: ["profiles", "rules", "infoGroups", "infoLinks", "modifiers", "modifierGroups"],
    type: "infoGroup"
  },
  infoLinks: {
    allowedChildrens: "type", //get from type
    type: "infoLink"
  },
  modifiers: {
    allowedChildrens: ["conditions", "conditionGroups", "localConditionGroups", "repeats"],
    type: "modifier"
  },
  modifierGroups: {
    allowedChildrens: ["modifiers", "modifierGroups", "conditions", "conditionGroups", "localConditionGroups", "repeats"],
    type: "modifierGroup"
  },
  repeats: {
    allowedChildrens: [],
    type: "repeat"
  },
  conditions: {
    allowedChildrens: [],
    type: "condition"
  },
  constraints: {
    allowedChildrens: [],
    type: "constraint"
  },
  conditionGroups: {
    allowedChildrens: ["conditions", "conditionGroups", "localConditionGroups"],
    type: "conditionGroup"
  },
  localConditionGroups: {
    allowedChildrens: ["conditions", "conditionGroups"],
    type: "localConditionGroup"
  },
  catalogue: {
    allowedChildrens: [
      "catalogueLinks",
      "publications",
      "costTypes",
      "profileTypes",
      "categoryEntries",
      "forceEntries",
      "sharedSelectionEntries",
      "sharedSelectionEntryGroups",
      "sharedProfiles",
      "sharedRules",
      "sharedInfoGroups",
      "selectionEntries",
      "entryLinks",
      "infoLinks",
      "infoGroups",
      "rules",
    ],
  },

  gameSystem: {
    allowedChildrens: [
      "publications",
      "costTypes",
      "profileTypes",
      "categoryEntries",
      "forceEntries",
      "sharedSelectionEntries",
      "sharedSelectionEntryGroups",
      "sharedProfiles",
      "sharedRules",
      "sharedInfoGroups",
      "selectionEntries",
      "entryLinks",
      "infoLinks",
      "infoGroups",
      "rules",
    ],
  },
} as const;


export const types = {
  selectionEntry: { label: "Entry" },
  selectionEntryGroup: { label: "Group" },
  selectionEntryLink: { label: "Entry (link)" },
  selectionEntryGroupLink: { label: "Group (link)" },
  entryLink: { label: "Entry (link)" },
  forceEntry: { label: "Force" },
  categoryEntry: { label: "Category" },
  categoryLink: { label: "Category (link)" },
  catalogueLink: { label: "Catalogue (link)" },
  publication: { label: "Publication" },
  costType: { label: "Cost Type" },
  cost: { label: "Cost" },
  costLimit: { label: "Cost Limit" },
  link: { label: "Link" },
  profileType: { label: "Profile Type" },
  profile: { label: "Profile" },
  rule: { label: "Rule" },
  infoLink: { label: "Info (link)" },
  infoGroup: { label: "Info Group" },
  profileLink: { label: "Profile" },
  ruleLink: { label: "Rule (link)" },
  infoGroupLink: { label: "Info Group (link)" },
  characteristic: { label: "Characteristic" },
  characteristicType: { label: "Characteristic Type" },
  attribute: { label: "Attribute" },
  attributeType: { label: "Attribute Type" },
  constraint: { label: "Constraint" },
  condition: { label: "Condition" },
  modifier: { label: "Modifier" },
  modifierGroup: { label: "Modifier Group" },
  repeat: { label: "Repeat" },
  conditionGroup: { label: "Condition Group" },
  localConditionGroup: { label: "Local Condition Group" },
  association: { label: "Association" },
  catalogue: { label: "Catalogue" },
  gameSystem: { label: "Game System" }
}
