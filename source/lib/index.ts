import path from 'node:path'
import fs from 'node:fs/promises'
import type { Package } from 'normalize-package-data'
import { changelog, START_OF_LAST_RELEASE_PATTERN } from './lifecycles/changelog.js'
import { resolveUpdaterObjectFromArgument } from './updaters/index.js'
import { printError } from './print-error.js'
import { latestSemverTag } from './latest-semver-tag.js'
import { bump } from './lifecycles/bump.js'
import { commit } from './lifecycles/commit.js'
import { tag } from './lifecycles/tag.js'
import type { Options, InternalOptions } from './defaults.js'

export type { Options }
export type { Updater } from './updaters/index.js'

export async function conventionalVersion(options: Options = {}) {
    const { defaults } = await import('./defaults.js')

    if (options.message) {
        options.releaseCommitMessageFormat = options.message.replace(/%s/g, '{{currentTag}}')
        if (!options.silent) {
            console.warn('[conventional-version]: --message (-m) will be removed in the next major release. Use --releaseCommitMessageFormat.')
        }
    }

    if (options.changelogHeader) {
        options.header = options.changelogHeader
        if (!options.silent) {
            console.warn('[conventional-version]: --changelogHeader will be removed in the next major release. Use --header.')
        }
    }

    if (options.header && options.header.search(START_OF_LAST_RELEASE_PATTERN) !== -1) {
        throw Error(`custom changelog header must not match ${START_OF_LAST_RELEASE_PATTERN}`)
    }

    // If an argument for `packageFiles` was provided, we include it as a "default" `bumpFile`.
    if (options.packageFiles)
        defaults.bumpFiles = defaults.bumpFiles!.concat(options.packageFiles)

    const opts: InternalOptions = Object.assign(Object.create(null), defaults, options)

    let pkg: Partial<Package> = {}
    for (const packageFile of opts.packageFiles) {
        const resolvedUpdater = await resolveUpdaterObjectFromArgument(packageFile)
        if (!resolvedUpdater)
            return

        try {
            const contents = await fs.readFile(path.resolve(resolvedUpdater.filename), 'utf-8')
            pkg = {
                version: resolvedUpdater.updater.readVersion(contents),
                private: typeof resolvedUpdater.updater.isPrivate === 'function'
                    ? resolvedUpdater.updater.isPrivate(contents)
                    : false
            }
            break
        }
        catch {}
    }

    try {
        let version: string
        if (typeof pkg.version === 'string')
            version = pkg.version
        else if (opts.gitTagFallback)
            version = await latestSemverTag(opts.tagPrefix)
        else
            throw new Error('no package file found')

        const newVersion = await bump(opts, version)
        await changelog(opts, newVersion)
        await commit(opts, newVersion)
        await tag(newVersion, pkg?.private ?? false, opts)
    }
    catch(e: unknown) {
        const err = e as NodeJS.ErrnoException
        printError(opts, err.message)
        throw err
    }
}
