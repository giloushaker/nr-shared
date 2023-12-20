export interface AppearanceTheme {
  background: string;
  backgroundTexture: string;

  bga: number;
  hue: number;

  title: {
    colors: string[];
    alpha: number;
  };

  forcesBackground: {
    colors: string[];
    alpha: number;
  };

  unitsBackground: {
    colors: string[];
    alpha: number;
  };

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
  hoverColor: string;
  hoverTransparency: number;
}
