import type { Updater } from '../index.js'

const plainText: Updater = {
    readVersion(contents: string): string {
        return contents
    },

    writeVersion(contents: string, version: string): string {
        return version
    }
}

export default plainText
