import stringifyPackage from 'stringify-package'
import detectIndent from 'detect-indent'
import { detectNewline } from 'detect-newline'
import type { Updater } from '../index.js'

export const json: Updater = {
    readVersion(contents: string): string {
        return JSON.parse(contents).version
    },

    writeVersion(contents: string, version: string): string {
        const json = JSON.parse(contents)
        const { indent } = detectIndent(contents)
        const newline = detectNewline(contents)

        if (json.packages && json.packages['']) {
            // package-lock v2 stores version there too
            json.packages[''].version = version
        }

        return stringifyPackage(json, indent, newline)
    },

    isPrivate(contents: string): boolean {
        return JSON.parse(contents).private
    }
}
