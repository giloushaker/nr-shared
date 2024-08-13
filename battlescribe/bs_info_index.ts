import { stripHtml } from "../util";


export class InfoIndex<T = any> {
    index = {} as Record<string, any>;
    words(str: string): string[] {
        const stringed = `${str}`
        return stringed.trim().match(/(\w+|\s|\W)/g) ?? [stringed]
    }
    clean(word: string): string {
        return word.match(/[a-z]/) ? word.toLowerCase() : word;
    }
    add(text: string, value: T) {
        if (typeof text !== "string" || !text.match(/(?=.*[a-zA-Z0-9].*[a-zA-Z0-9])/)) {
            return;
        }
        this.addToIndex(this.index, value, this.words(text));
    }
    private addToIndex(out: Record<string, any>, obj: any, words: string[], index = 0) {
        if (index < words.length) {
            const word = this.clean(words[index])
            if (word !== " ") {
                if (!out[word]) out[word] = {}
                this.addToIndex(out[word], obj, words, index + 1)
            } else {
                this.addToIndex(out, obj, words, index + 1)
            }
        } else {
            if (!out.$) out.$ = []
            out.$.push(obj)
        }
    }
    match(text: string | number): { match?: T[], text?: string }[] {
        if (typeof text !== "string" || !text.match(/(?=.*[a-zA-Z0-9].*[a-zA-Z0-9])/)) {
            return [{ text: text as string }]
        }
        const words = this.words(text)
        const clean = words.map(this.clean, this)



        const result = []
        let currentText = []
        for (let i = 0; i < clean.length; i++) {
            let cur = this.index;
            let latest = 0
            let latestVal;
            if (isMultilineCodeBlockStart(clean, i)) {
                let end = findMultilineCodeBlockEnd(i, clean)
                if (end !== -1) {
                    currentText.push(words.slice(i, end).join(""))
                    i = end - 1;
                }
                continue;
            } else if (isCodeBlockStart(clean, i)) {
                let end = findCodeBlockEnd(i, clean)
                if (end !== -1) {
                    currentText.push(words.slice(i, end).join(""))
                    i = end - 1;
                }
                continue;
            }


            if (clean[i] !== " ") {
                for (let j = i; j < clean.length; j++) {
                    const word = clean[j]
                    if (word === " ") continue;
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
function findMultilineCodeBlockEnd(i: number, clean: string[]) {
    let end = -1
    for (let j = i + 3; j < clean.length; j++) {
        if (clean[i] === "`" && clean[i + 1] === "`" && clean[i + 2] === "`") {
            end = j + 3
        }
    }
    return end
}
function findCodeBlockEnd(i: number, clean: string[]) {
    let end = -1
    for (let j = i + 1; j < clean.length; j++) {
        if (clean[i] === "`" || clean[i] == "\n") {
            end = j + 1
        }
    }
    return end
}
function isCodeBlockStart(clean: string[], i: number) {
    return clean[i] === "`"
}

function isMultilineCodeBlockStart(clean: string[], i: number) {
    return clean[i] === "`" && clean[i + 1] === "`" && clean[i + 2] === "`"
}
function escapeHtml(htmlString: string) {
    if (globalThis.document) {
        const div = document.createElement("div");
        div.appendChild(document.createTextNode(htmlString));
        return div.innerHTML;
    } else {
        return stripHtml(htmlString);
    }
}