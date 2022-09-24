import chalk from 'chalk'
import figures from 'figures'
import util from 'util'
import type { InternalOptions } from './defaults.js'

export function checkpoint(argv: InternalOptions, msg: string, args: any[], figure?: keyof typeof figures) {
    const defaultFigure = argv.dryRun ? chalk.yellow(figures.tick) : chalk.green(figures.tick)
    if (!argv.silent) {
        console.info((figure || defaultFigure) + ' ' + util.format.apply(util, [msg].concat(args.map(function (arg) {
            return chalk.bold(arg)
        }))))
    }
}
