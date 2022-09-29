import fs from 'node:fs/promises'
import util from 'node:util'
import { execFile } from 'node:child_process'

export const shell = {
    cd(path: string): string {
        const old = process.cwd()
        process.chdir(path)
        return old
    },

    cwd(): string {
        return process.cwd()
    },

    mkdir: fs.mkdir,
    rm: fs.rm,
    exec: util.promisify(execFile)
}
