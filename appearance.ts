import { AppearanceTheme } from "./types/appearance";

export interface RGB {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RGB | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export async function updateCssVars(appearence: AppearanceTheme /* , algo: AlgoSettings */) {
  if (appearence.background) {
    const bgRgb = hexToRgb(appearence.background);
    if (bgRgb != null) {
      for (const field in bgRgb) {
        document.documentElement.style.setProperty(`--bg-${field}`, (bgRgb as any)[field]);
      }
    }
  }

  if (appearence.title) {
    const titleRgb = hexToRgb(appearence.title);
    if (titleRgb != null) {
      for (const field in titleRgb) {
        document.documentElement.style.setProperty(`--title-${field}`, (titleRgb as any)[field]);
      }
    }
  }

  if (appearence.forcesBackground) {
    document.documentElement.style.setProperty(`--forces_background`, appearence.forcesBackground);
  } else if (appearence.title) {
    document.documentElement.style.setProperty(`--forces_background`, appearence.title);
    appearence.forcesBackground = appearence.title;
  }

  if (appearence.highlight) {
    const titleRgb = hexToRgb(appearence.highlight);
    if (titleRgb != null) {
      for (const field in titleRgb) {
        document.documentElement.style.setProperty(`--highlight-${field}`, (titleRgb as any)[field]);
      }
    }
  }

  if (appearence.borderColor) {
    document.documentElement.style.setProperty(`--box-border`, `${appearence.borderColor}`);
  }

  let filter = "";
  if (appearence.invertColors == true) {
    filter = "invert(100)";
  } else if (appearence.invertImages) {
    filter = "";
  } else {
    filter = "invert(0)";
  }

  if (appearence.hue) {
    filter += ` hue-rotate(${appearence.hue}deg)`;
  }

  if (navigator.userAgent.toLowerCase().indexOf("firefox") > -1) {
    document.documentElement.style.setProperty(`--global-filter`, "none");
  } else {
    document.documentElement.style.setProperty(`--global-filter`, filter);
  }

  if (appearence.backgroundTexture) {
    document.documentElement.style.setProperty(`--bg-texture`, appearence.backgroundTexture);
  }

  if (appearence.fitBackground) {
    document.documentElement.style.setProperty(`--backgroundRepeat`, "no-repeat");
    document.documentElement.style.setProperty(`--backgroundSize`, "auto 100%");
    document.documentElement.style.setProperty(`--backgroundPosition`, "center");
  } else {
    document.documentElement.style.setProperty(`--backgroundRepeat`, "repeat");
    document.documentElement.style.setProperty(`--backgroundSize`, "");
    document.documentElement.style.setProperty(`--backgroundPositon`, "");
  }

  if (appearence.inputRadius) {
    document.documentElement.style.setProperty(`--input-radius`, appearence.inputRadius + "px");
  }

  if (appearence.inputBackground) {
    document.documentElement.style.setProperty(`--input-background`, appearence.inputBackground);
  }

  if (appearence.hoverColor) {
    const bgRgb = hexToRgb(appearence.hoverColor);
    if (bgRgb != null) {
      for (const field in bgRgb) {
        document.documentElement.style.setProperty(`--hover-color-${field}`, (bgRgb as any)[field]);
      }
    }
  }

  if (appearence.hoverTransparency != null) {
    document.documentElement.style.setProperty(`--hover-transparency`, `${appearence.hoverTransparency / 100}`);
  }

  if (appearence.fontColor) {
    document.documentElement.style.setProperty(`--font-color`, appearence.fontColor);
  }

  document.documentElement.style.setProperty(`--italic`, appearence.italic ?? "italic");

  if (appearence.colorGray) {
    document.documentElement.style.setProperty(`--color-gray`, appearence.colorGray);
  }

  if (appearence.colorRed) {
    document.documentElement.style.setProperty(`--color-red`, appearence.colorRed);
  }

  if (appearence.colorGreen) {
    document.documentElement.style.setProperty(`--color-green`, appearence.colorGreen);
  }

  if (appearence.colorBlue) {
    document.documentElement.style.setProperty(`--color-blue`, appearence.colorBlue);
  }

  if (appearence.colorLightblue) {
    document.documentElement.style.setProperty(`--color-lightblue`, appearence.colorLightblue);
  }

  if (appearence.bga) {
    let fontColor = appearence.bga;
    if (fontColor > 1) {
      fontColor /= 100;
    }
    document.documentElement.style.setProperty(`--bg-a`, `${fontColor}`);
  }

  if (appearence.invertImagesBrightness) {
    const deg = 180 * (parseInt(appearence.invertImagesBrightness) / 100);
    document.documentElement.style.setProperty(
      `--image-filter`,
      `invert(${appearence.invertImagesBrightness}%) hue-rotate(${deg}deg)`
    );
  } else if (appearence.invertImages) {
    document.documentElement.style.setProperty(`--image-filter`, "invert(100%) hue-rotate(180deg)");
  } else {
    document.documentElement.style.setProperty(`--image-filter`, "");
  }

  if (appearence.costColor) {
    const fontColor = appearence.costColor;
    document.documentElement.style.setProperty(`--cost-color`, fontColor);
  }

  setAppearanceFont(appearence, "");
  setAppearanceFont(appearence, "Header");
  setAppearanceFont(appearence, "Button");

  document.documentElement.style.setProperty(`--fontHeaderTransform`, appearence.headerTransform);

  if (appearence.inputHighlights) {
    const fontColor = appearence.inputHighlights;
    document.documentElement.style.setProperty(`--input-highlights`, fontColor);
  }

  if (appearence.dark) {
    document.documentElement.style.setProperty(`--hover-brighten-color`, "rgba(0, 0, 0, 0.15)");
    document.documentElement.style.setProperty(`--hover-darken-color`, "rgba(255, 255, 255, 0.15)");
  } else {
    document.documentElement.style.setProperty(`--hover-darken-color`, "rgba(0, 0, 0, 0.15)");
    document.documentElement.style.setProperty(`--hover-brighten-color`, "rgba(255, 255, 255, 0.15)");
  }

  if (appearence.titleBarColor) {
    document.documentElement.style.setProperty(`--titleBarColor`, appearence.titleBarColor);
  }
}

export async function setAppearanceFont(
  appearence: AppearanceTheme,
  key: string,
  _defaultFamily = "sans-serif",
  _defaultSize = 16
) {
  const keyFont = `font${key}` as keyof AppearanceTheme;
  const keyFontSize = `font${key}Size` as keyof AppearanceTheme;
  let value = (appearence[keyFont] || "sans-serif") as string;

  document.documentElement.style.setProperty(`--${keyFont}`, value || _defaultFamily);
  document.documentElement.style.setProperty(`--${keyFontSize}`, (appearence[keyFontSize] || _defaultSize) + "px");
}

/* 
  const _fontDynamicImportCache: any = {};
  const isFontFaceUrl = Boolean(value.match(/^.+(\:\/\/).+(\.).+(ff)$/));
  const isImportUrl = !isFontFaceUrl && Boolean(value.match(/^.+(\:\/\/).+$/));
  if (isFontFaceUrl || isImportUrl) value = encodeURI(value);
  if (isImportUrl) {
    if (!_fontDynamicImportCache[value]) {
      _fontDynamicImportCache[value] = "lock";

      console.log(`Importing css: ${encodeURI(value)}`);
      var head = document.getElementsByTagName("head")[0];
      var fileref = document.createElement("link");
      fileref.setAttribute("rel", "stylesheet");
      fileref.setAttribute("type", "text/css");
      fileref.setAttribute("href", value);
      fileref.setAttribute("media", "none");

      let promiseResolve: Function;

      var promise = new Promise(function (resolve) {
        promiseResolve = resolve;
      });

      fileref.onload = () => {
        fileref.setAttribute("media", "all");
        console.log("loaded css");
        promiseResolve();
      };

      head.append(fileref);
      await promise;

            let foundSheet = null;
      for (let i = 0; i < document.styleSheets.length; i++) {
        const sheet = document.styleSheets[i];
        if (sheet.href === value) {
          foundSheet = sheet;
          break;
        }
      } 
      _fontDynamicImportCache[value] = fileref;
    } else {
      value = _fontDynamicImportCache[value];
    }
  } */

// if (isFontFaceUrl) {
//   if (!_fontDynamicImportCache[value]) {
//     console.log(`Importing font: ${value}`);
//     const fontName = `${keyFont}:${value}`;
//     const myFont = new FontFace(fontName, `url(${value})`);
//     await myFont.load();

//     document.fonts.add(myFont);
//     _fontDynamicImportCache[value] = fontName;
//     value = fontName;
//   } else {
//     value = _fontDynamicImportCache[value];
//   }
// } //

//  appearence [keyFontSize] = appearence[keyFontSize];
