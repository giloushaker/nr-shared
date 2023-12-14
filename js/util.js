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

export function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function fallbackCopyTextToClipboard(text) {
  var textArea = document.createElement("textarea");
  textArea.value = text;

  // Avoid scrolling to bottom
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    var successful = document.execCommand("copy");
  } catch (err) {
    console.error("Fallback: Could not copy text", err);
  }

  document.body.removeChild(textArea);
}
export function copyTextToClipboard(text) {
  if (!navigator.clipboard) {
    fallbackCopyTextToClipboard(text);
    return;
  }
  navigator.clipboard.writeText(text).then(
    function () {},
    function (err) {
      console.error("Async: Could not copy text", err);
    }
  );
}
