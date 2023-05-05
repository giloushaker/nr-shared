export function idCompare(obj1) {
  return obj1.id == this.id;
}

export function lengthInUtf8Bytes(str) {
  // Matches only the 10.. bytes that are non-initial characters in a multi-byte sequence.
  const m = encodeURIComponent(str).match(/%[89ABab]/g);
  return str.length + (m ? m.length : 0);
}

export function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

export function toFileName(name) {
  const res = name.replace(/ /g, "_");
  return res.toLowerCase();
}

export function sortByField(opt, field, desc) {
  if (opt.options != undefined)
    opt.options.sort(function (a, b) {
      if (!desc) return b[field] - a[field];
      return a[field] - b[field];
    });
}

export function addUnique(arr, it) {
  let found = null;
  arr.forEach((elt) => {
    if (elt.id == it.id && found == null) found = it;
  });
  if (found == null) arr.unshift(it);
}

export function moveToFirst(arr, item) {
  if (arr.length <= 1) return;
  const index = arr.indexOf(item);
  if (index === -1) return;
  arr.splice(index, 1);
  arr.splice(0, 0, item);
}

export function setSelection(list, item, thisObj, field) {
  for (const item2 of list) {
    if (item2.id == item.id) {
      thisObj[field] = item2;
      break;
    }
  }
}

export function dateSort(l1, l2) {
  let d1;
  let d2;
  if (!l1.date_mod) d1 = new Date("1970-01-01");
  else d1 = new Date(l1.date_mod);
  if (!l2.date_mod) d2 = new Date("1970-01-01");
  else d2 = new Date(l2.date_mod);
  if (d1.getTime() >= d2.getTime()) return -1;
  return 1;
}

export function listUrl(key) {
  return "/api/rpc?m=user_get_list&key=" + key;
}

export function tournyListUrl(key) {
  return "/api/rpc?m=tourny_get_list&key=" + key;
}

export function reportUrl(id) {
  return "/api/rpc?p0=report_get&p1=" + id;
}

export function translationUrl(id_sys, id, lang) {
  return `/api/rpc?m=books_get_translation&id_sys=${id_sys}&id=${id}&lang=${lang}`;
}

export function shallowCopy(obj) {
  const res = {};

  for (const field in obj) {
    if (typeof obj[field] != "object") {
      res[field] = obj[field];
    }
  }
  return res;
}

export function notifyError(store, errorStack) {
  const errors = store.state.errors;
  if (errorStack.length != 0) {
    if (store.state.timeoutRunning) {
      clearTimeout(store.state.errorTimeout);
    }

    errors.push(errorStack[errorStack.length - 1]);
    clearErrors(store);
  }
}

function clearErrors(store) {
  const errors = store.state.errors;
  store.state.timeoutRunning = true;
  let nChar = 0;

  for (const elt of errors) {
    nChar += elt != undefined ? elt.msg.length : 0;
  }
  nChar *= 20;
  if (nChar >= 6000) nChar = 6000;
  if (nChar < 3000) nChar = 3000;
  store.state.errorTimeout = setTimeout(() => {
    errors.splice(0, errors.length);
    store.state.timeoutRunning = false;
  }, nChar);
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function updateCssVars(store) {
  const appearence = store.state.options.appearence;
  const algo = store.state.options.algo;
  if (appearence.background) {
    const bgRgb = hexToRgb(appearence.background);
    if (bgRgb != null) {
      for (const field in bgRgb) {
        document.documentElement.style.setProperty(`--bg-${field}`, bgRgb[field]);
      }
    }
  }

  if (appearence.title) {
    const titleRgb = hexToRgb(appearence.title);
    if (titleRgb != null) {
      for (const field in titleRgb) {
        document.documentElement.style.setProperty(`--title-${field}`, titleRgb[field]);
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
        document.documentElement.style.setProperty(`--highlight-${field}`, titleRgb[field]);
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

  if (appearence.backgroundTexture) {
    document.documentElement.style.setProperty(`--backgroundSize`, appearence.backgroundSize);
  }

  if (appearence.inputRadius) {
    document.documentElement.style.setProperty(`--input-radius`, appearence.inputRadius + "px");
  }

  if (appearence.inputBackground) {
    document.documentElement.style.setProperty(`--input-background`, appearence.inputBackground);
  }

  if (algo.unitColor) {
    document.documentElement.style.setProperty(`--color-unit`, algo.unitColor);
  }

  if (algo.armyColor) {
    document.documentElement.style.setProperty(`--color-army`, algo.armyColor);
  }

  if (appearence.fontColor) {
    document.documentElement.style.setProperty(`--font-color`, appearence.fontColor);
  }

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
    document.documentElement.style.setProperty(`--bg-a`, fontColor);
  }

  if (appearence.invertImagesBrightness) {
    const deg = 180 * (appearence.invertImagesBrightness / 100);
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
}

const _fontDynamicImportCache = {};
export async function setAppearanceFont(appearence, key, _defaultFamily = "sans-serif", _defaultSize = 16) {
  const keyFont = `font${key}`;
  const keyFontSize = `font${key}Size`;
  let value = appearence[keyFont] || "sans-serif";

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

      var promiseResolve, promiseReject;
      var promise = new Promise(function (resolve, reject) {
        promiseResolve = resolve;
        promiseReject = reject;
      });

      fileref.onload = () => {
        fileref.setAttribute("media", "all");
        console.log("loaded css");
        promiseResolve();
      };

      head.append(fileref);
      await promise;

      let foundSheet;
      for (const sheet of document.styleSheets) {
        if (sheet.href === value) {
          foundSheet = sheet;
          break;
        }
      }

      console.log(foundSheet.rules);
      _fontDynamicImportCache[value] = fileref;
    } else {
      value = _fontDynamicImportCache[value];
    }
  } //
  if (isFontFaceUrl) {
    if (!_fontDynamicImportCache[value]) {
      console.log(`Importing font: ${value}`);
      const fontName = `${keyFont}:${value}`;
      const myFont = new FontFace(fontName, `url(${value})`);
      await myFont.load();
      document.fonts.add(myFont);
      _fontDynamicImportCache[value] = fontName;
      value = fontName;
    } else {
      value = _fontDynamicImportCache[value];
    }
  } //

  appearence[keyFontSize] = Math.max(Math.min(appearence[keyFontSize], 40), 12);
  document.documentElement.style.setProperty(`--${keyFont}`, value || _defaultFamily);
  document.documentElement.style.setProperty(`--${keyFontSize}`, (appearence[keyFontSize] || _defaultSize) + "px");
}

/**
 * Copy a string to clipboard
 * @param  {String} string         The string to be copied to clipboard
 * @return {Boolean}               returns a boolean correspondent to the success of the copy operation.
 */
export function copyToClipboard(string) {
  let textarea;
  let result;

  try {
    textarea = document.createElement("textarea");
    textarea.setAttribute("readonly", true);
    textarea.setAttribute("contenteditable", true);
    textarea.style.position = "fixed"; // prevent scroll from jumping to the bottom when focus is set.
    textarea.value = string;

    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();

    const range = document.createRange();
    range.selectNodeContents(textarea);

    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    textarea.setSelectionRange(0, textarea.value.length);
    result = document.execCommand("copy");
  } catch (err) {
    console.error(err);
    result = null;
  } finally {
    document.body.removeChild(textarea);
  }

  return result;
}
