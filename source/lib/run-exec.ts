import { promisify } from 'node:util'
import child_process from 'node:child_process'
import { printError } from './print-error.js'
import type { InternalOptions } from './defaults.js'

const exec = promisify(child_process.exec)

export async function runExec(args: InternalOptions, cmd: string) {
    if (args.dryRun)
        return

    try {
        const { stderr, stdout } = await exec(cmd)

        // If exec returns content in stderr, but no error, print it as a warning
        if (stderr)
            printError(args, stderr, { level: 'warn', color: 'yellow' })
        return stdout
    }
    catch (e: unknown) {
        const error = e as NodeJS.ErrnoException & { stderr?: string }

        // If exec returns an error, print it and exit with return code 1
        printError(args, error.stderr || error.message)
        throw error
    }
}
