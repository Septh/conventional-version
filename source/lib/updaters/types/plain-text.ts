import type { Updater } from '../index.js'

export const plainText: Updater = {
    readVersion(contents: string): string {
        return contents
    },

    writeVersion(contents: string, version: string): string {
        return version
    }
}
