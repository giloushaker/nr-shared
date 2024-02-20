export interface AppearanceColor {
  colors: string[];
  alpha: number;
}

export interface AppearanceTheme {
  background: AppearanceColor;
  title: AppearanceColor;
  forcesBackground: AppearanceColor;
  unitsBackground: AppearanceColor;
  hoverColor: AppearanceColor;

  backgroundTexture: string;
  backgroundSize: string;

  hue: number;
  highlight: string;

  dropdownStyle: number;
  inputRadius: number;
  inputBackground: string;
  inputHighlights: string;

  categoryIcons: boolean;
  costsLeft: boolean;
  invertColors: boolean;
  invertImages: boolean;
  invertImagesBrightness: number | string;

  italic?: "italic" | "normal";
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

  dark?: boolean;
  fitBackground: boolean;

  titleBarColor: string;
}
