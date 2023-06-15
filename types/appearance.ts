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
  titleBarColor: string;

  dark?: boolean;
}
