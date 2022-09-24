import fs from 'node:fs'
import chalk from 'chalk'
import { checkpoint } from '../checkpoint.js'
import conventionalChangelog from 'conventional-changelog'
import { runLifecycleScript } from '../run-lifecycle-script.js'
import { presetLoader } from '../preset-loader.js'
import { writeFile } from '../write-file.js'
import type { InternalOptions } from '../defaults.js'

export const START_OF_LAST_RELEASE_PATTERN = /(^#+ \[?[0-9]+\.[0-9]+\.[0-9]+|<a name=)/m

export async function changelog(args: InternalOptions, newVersion: any) {
    if (args.skip!.changelog)
        return

    await runLifecycleScript(args, 'prechangelog')
    await outputChangelog(args, newVersion)
    await runLifecycleScript(args, 'postchangelog')
}

function outputChangelog(args: InternalOptions, newVersion: string): Promise<void> {
    return new Promise((resolve, reject) => {
        createIfMissing(args)

        let oldContent = args.dryRun ? '' : fs.readFileSync(args.infile!, 'utf-8')
        const oldContentStart = oldContent.search(START_OF_LAST_RELEASE_PATTERN)
        // find the position of the last release and remove header:
        if (oldContentStart !== -1) {
            oldContent = oldContent.substring(oldContentStart)
        }

        let content = ''
        const context = { version: newVersion }

        const changelogStream = conventionalChangelog(
            {
                debug: args.verbose ? console.info.bind(console, 'conventional-changelog') : undefined,
                preset: presetLoader(args),
                tagPrefix: args.tagPrefix
            },
            context,
            { merges: null, path: args.path }
        )

        changelogStream.on('error', function (err) {
                return reject(err)
            })

        changelogStream.on('data', function (buffer) {
            content += buffer.toString()
        })

        changelogStream.on('end', function () {
            checkpoint(args, 'outputting changes to %s', [ args.infile ])
            if (args.dryRun)
                console.info(`\n---\n${chalk.gray(content.trim())}\n---\n`)
            else
                writeFile(args, args.infile!, args.header + '\n' + (content + oldContent).replace(/\n+$/, '\n'))
            return resolve()
        })
    })
}

function createIfMissing(args: InternalOptions) {
    try {
        fs.accessSync(args.infile!, fs.constants.F_OK)
    }
    catch(e: unknown) {
        const err = e as NodeJS.ErrnoException
        if (err.code === 'ENOENT') {
            checkpoint(args, 'created %s', [ args.infile ])
            args.outputUnreleased = true
            writeFile(args, args.infile!, '\n')
        }
    }
}
