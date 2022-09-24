import fs from 'node:fs'
import type { InternalOptions } from './defaults.js'

export function writeFile(args: InternalOptions, filePath: string, content: any) {
    if (args.dryRun)
        return
    fs.writeFileSync(filePath, content, 'utf-8')
}
