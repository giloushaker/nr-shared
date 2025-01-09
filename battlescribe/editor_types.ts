export type ItemTypeNames =
  | "catalogue"
  | "gameSystem"
  | "selectionEntry"
  | "selectionEntryGroup"
  | "category"
  | "force"
  | "selectionEntryLink"
  | "selectionEntryGroupLink"
  | "categoryLink"
  | "catalogueLink"
  | "profile"
  | "rule"
  | "profileType"
  | "characteristic"
  | "characteristicType"
  | "publication"
  | "infoGroup"
  | "infoLink"
  | "association"
  | "constraint"
  | "condition"
  | "modifier"
  | "modifierGroup"
  | "repeat"
  | "conditionGroup"
  | "localConditionGroup"
  | "cost"
  | "costType"
  | "link"
  | "profileLink"
  | "ruleLink"
  | "infoGroupLink";

export function getTypeName(key: string, obj?: any): ItemTypeNames {
  switch (key) {
    case "selectionEntries":
      return "selectionEntry";
    case "selectionEntryGroups":
      return "selectionEntryGroup";

    case "sharedSelectionEntries":
      return obj?.targetId ? "selectionEntryLink" : "selectionEntry";
    case "sharedSelectionEntryGroups":
      return obj?.targetId ? "selectionEntryLink" : "selectionEntryGroup";

    case "entryLinks":
      return obj?.target ? ((obj.target.editorTypeName + "Link") as any) : "link";
    case "forceEntries":
      return "force";
    case "categoryEntries":
      return "category";
    case "categoryLinks":
      return "categoryLink";

    case "catalogueLinks":
      return "catalogueLink";
    case "publications":
      return "publication";
    case "costTypes":
      return "costType";
    case "costs":
      return "cost";

    case "profileTypes":
      return "profileType";
    case "profiles":
      return "profile";
    case "rules":
      return "rule";
    case "characteristics":
      return "characteristic";
    case "characteristicTypes":
      return "characteristicType";
    case "sharedProfiles":
      return "profile";
    case "sharedRules":
      return "rule";
    case "sharedInfoGroups":
      return "infoGroup";

    case "infoLinks":
      return obj ? (`${obj.type || "info"}Link` as ItemTypeNames) : "infoLink";
    case "infoGroups":
      return "infoGroup";

    case "associations":
      return "association";
    case "constraints":
      return "constraint";
    case "conditions":
      return "condition";
    case "modifiers":
      return "modifier";
    case "modifierGroups":
      return "modifierGroup";
    case "repeats":
      return "repeat";
    case "conditionGroups":
      return "conditionGroup";
    case "localConditionGroups":
      return "localConditionGroup";
    case "catalogue":
    case "gameSystem":
      return key;
    default:
      console.warn("unknown getTypeName key", key);
      return key as any;
  }
}
