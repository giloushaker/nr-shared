const splitChars = ['[', ']', ' ', '(', ')', ',', '\n', '\r']
const or = splitChars.map(o => `\\${o}`).join("|");
const regex = new RegExp(`(?<=${or})|(?=${or})`, "g")
function addToIndex(out: Record<string, any>, obj: any, words: string[], index = 0) {
    if (index < words.length) {
        const word = words[index].trim().toLowerCase()
        if (word) {
            if (!out[word]) out[word] = {}
            addToIndex(out[word], obj, words, index + 1)
        } else {
            addToIndex(out, obj, words, index + 1)
        }
    } else {
        if (!out.$) out.$ = []
        out.$.push(obj)
    }
}
export class InfoIndex<T = any> {
    index = {} as Record<string, any>;
    words(str: string) {
        return `${str}`.trim().split(regex)
    }
    add(text: string, value: T) {
        if (typeof text !== "string" || !text.match(/(?=.*[a-zA-Z].*[a-zA-Z])/)) {
            return;
        }
        addToIndex(this.index, value, this.words(text));
    }
    match(text: string | number): { match?: T[], text?: string }[] {
        if (typeof text !== "string" || !text.match(/(?=.*[a-zA-Z].*[a-zA-Z])/)) {
            return [{ text: text as string }]
        }
        const words = this.words(text)
        const clean = words.map(o => o.trim().toLowerCase());
        const result = []
        let currentText = []
        for (let i = 0; i < clean.length; i++) {
            let cur = this.index;
            let latest = 0
            let latestVal;
            if (clean[i]) {
                for (let j = i; j < clean.length; j++) {
                    const word = clean[j]
                    if (!word) continue;
                    cur = cur[word]
                    if (cur) {
                        if (cur.$) {
                            latest = 1 + (j - i)
                            latestVal = cur.$
                        }
                    } else {
                        break;
                    }
                }
            }
            if (latest) {
                if (currentText.length) {
                    result.push({ text: currentText.join("") })
                    currentText = []
                }
                result.push({ match: latestVal, text: words.slice(i, i + latest).join("") });
                i += latest - 1
            } else {
                currentText.push(words[i])
            }
        }
        if (currentText.length) {
            result.push({ text: currentText.join("") })
        }
        return result
    }
}
