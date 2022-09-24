import chalk from 'chalk'
import figures from 'figures'
import { getUpdatedConfigs } from '../lifecycles/bump.js'
import { checkpoint } from '../checkpoint.js'
import { formatCommitMessage } from '../format-commit-message.js'
import { runExecFile } from '../run-execFile.js'
import { runLifecycleScript } from '../run-lifecycle-script.js'
import type { InternalOptions } from '../defaults.js'

export async function tag(newVersion: string, pkgPrivate: boolean, args: InternalOptions) {
    if (args.skip!.tag)
        return
    await runLifecycleScript(args, 'pretag')
    await execTag(newVersion, pkgPrivate, args)
    await runLifecycleScript(args, 'posttag')
}

async function execTag(newVersion: string, pkgPrivate: boolean, args: InternalOptions) {
    let tagOption: string
    if (args.sign) {
        tagOption = '-s'
    } else {
        tagOption = '-a'
    }
    checkpoint(args, 'tagging release %s%s', [args.tagPrefix, newVersion])
    await runExecFile(args, 'git', ['tag', tagOption, args.tagPrefix + newVersion, '-m', `${formatCommitMessage(args.releaseCommitMessageFormat!, newVersion)}`])

    const currentBranch = await runExecFile(args, 'git', ['rev-parse', '--abbrev-ref', 'HEAD'], false)
    let message = 'git push --follow-tags origin ' + currentBranch!.trim()
    if (pkgPrivate !== true && getUpdatedConfigs()['package.json']) {
        message += ' && npm publish'
        if (args.prerelease !== undefined) {
            if (args.prerelease === '') {
                message += ' --tag prerelease'
            } else {
                message += ' --tag ' + args.prerelease
            }
        }
    }

    checkpoint(args, 'Run `%s` to publish', [message], chalk.blue(figures.info) as keyof typeof figures)
}
