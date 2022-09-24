import { promisify } from 'node:util'
import child_process from 'node:child_process'
import { printError } from './print-error.js'
import type { InternalOptions } from './defaults.js'

const execFile = promisify(child_process.execFile)

export async function runExecFile(args: InternalOptions, cmd: string, cmdArgs: string[], honorDryRun = true) {
    if (honorDryRun && args.dryRun)
        return

    try {
        const { stderr, stdout } = await execFile(cmd, cmdArgs)

        // If execFile returns content in stderr, but no error, print it as a warning
        if (stderr)
            printError(args, stderr, { level: 'warn', color: 'yellow' })
        return stdout
    }
    catch(e) {
        const error = e as NodeJS.ErrnoException & { stderr?: string }

        // If execFile returns an error, print it and exit with return code 1
        printError(args, error.stderr || error.message)
        throw error
    }
}
