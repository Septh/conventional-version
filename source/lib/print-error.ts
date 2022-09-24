import chalk, { type ForegroundColor } from 'chalk'
import type { InternalOptions } from './defaults.js'

interface PrintErrorOptions {
    level: 'info' | 'warn' | 'error',
    color: ForegroundColor
}

export function printError(args: InternalOptions, msg: string, opts?: PrintErrorOptions) {
    if (!args.silent) {
        opts = Object.assign<PrintErrorOptions, PrintErrorOptions | undefined>({
            level: 'error',
            color: 'red'
        }, opts)

        console[opts.level](chalk[opts.color](msg))
    }
}
