import { IPresetIndex } from "../../ts/battlescribe/ui/bs_preset";
import { Figurine } from "../roster/figurines";

export interface AppearanceTheme {
  background: string;
  backgroundTexture: string;
  backgroundSize: string;
  bga: string | number;
  hue: number;

  title: string;
  forcesBackground: string;
  highlight: string;

  dropdownStyle: number;
  inputRadius: number;
  inputBackground: string;
  inputHighlights: string;

  categoryIcons: boolean;
  costsLeft: boolean;
  invertColors: boolean;
  invertImages: boolean;
  invertImagesBrightness: string;

  font: string;
  fontSize: number;
  fontHeader: string;
  fontHeaderSize: number;
  headerTransform: string;
  fontButton: string;
  fontButtonSize: number;

  fontColor: string;
  borderColor: string;
  colorGray: string;
  colorBlue: string;
  colorRed: string;
  colorGreen: string;
  colorLightblue: string;
  costColor: string;
}

export interface NamedTheme {
  name: string;
  preset: boolean;
  id: string;
  css: AppearanceTheme;
}

export interface SystemOptions {
  myListsBook?: number | string;
}
export interface StateOptions extends Record<string, any> {
  nlanguage: string;
  shownestedrules: boolean;
  modelRulesSmallScreen: boolean;
  noInfoAlign: boolean;
  pdfCondensedUnitProfiles: boolean;
  pdfUnitProfiles: boolean;
  tournamentInfo: boolean;
  tournamentStatus: number;
  enableSplitScreen: boolean;
  showConstants: boolean;
  lastSystem: number | null;
  enableMinis: boolean;
  showMiniIcons: boolean;
  showAllProfiles: boolean;
  army: {
    deleteonlylocal: boolean;
    displayarmorassave: boolean;
    indicators: boolean;
  };

  textFormat: {
    sweedish: boolean;
    whiteBg: boolean;
    addX: boolean;
    playerName?: string;
    catRecap?: boolean;
    insertName?: boolean;
  };

  appearence: AppearanceTheme;
  customThemes: NamedTheme[];

  algo: {
    unitHide: boolean;
    unitItalic: boolean;
    unitColor: string;
    armyHide: boolean;
    armyItalic: boolean;
    armyColor: string;
    allowModifyOtherUnits: boolean;
    automaticMode: boolean;
    warningAllowed: boolean;
  };

  // Contains the IDs of installed systems
  installed_systems: number[];
  systemOptions: Record<number | string, SystemOptions>;

  presets?: IPresetIndex;
  ownedFigurines?: { [systemId: string]: Figurine[] };

  factionGroup: boolean;
}
