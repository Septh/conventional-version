import path from 'node:path'
import fs from 'node:fs'
import chalk from 'chalk'
import conventionalRecommendedBump, { type Recommendation } from 'conventional-recommended-bump'
import figures from 'figures'
import semver, { type ReleaseType as SemverReleaseType } from 'semver'
import dotGitignore from 'dotgitignore'
import { checkpoint } from '../checkpoint.js'
import { presetLoader } from '../preset-loader.js'
import { runLifecycleScript } from '../run-lifecycle-script.js'
import { writeFile } from '../write-file.js'
import { resolveUpdaterObjectFromArgument } from '../updaters/index.js'
import type { InternalOptions, ReleaseType } from '../defaults.js'

let configsToUpdate: Record<string, boolean> = {}

export async function bump(args: InternalOptions, version: string) {
    // reset the cache of updated config files each
    // time we perform the version bump step.
    configsToUpdate = {}

    if (args.skip.bump)
        return version

    let newVersion: string = version
    await runLifecycleScript(args, 'prerelease')

    const stdout = await runLifecycleScript(args, 'prebump')
    if (stdout && stdout.trim().length)
        args.releaseAs = stdout.trim()

    const release = await bumpVersion(args.releaseAs as ReleaseType, version, args)
    if (!args.firstRelease) {
        const releaseType = getReleaseType(args.prerelease, release.releaseType!, version as SemverReleaseType)
        newVersion = semver.valid(releaseType) || semver.inc(version, releaseType, args.prerelease)!
        await updateConfigs(args, newVersion)
    }
    else {
        checkpoint(args, 'skip version bump on first release', [], chalk.red(figures.cross) as keyof typeof figures)
    }

    await runLifecycleScript(args, 'postbump')
    return newVersion
}

export function getUpdatedConfigs() {
    return configsToUpdate
}

function getReleaseType(prerelease: string, expectedReleaseType: SemverReleaseType, currentVersion: SemverReleaseType): SemverReleaseType {
    if (isString(prerelease)) {
        if (isInPrerelease(currentVersion)) {
            if (shouldContinuePrerelease(currentVersion, expectedReleaseType) ||
                getTypePriority(getCurrentActiveType(currentVersion)!) > getTypePriority(expectedReleaseType)
            ) {
                return 'prerelease'
            }
        }

        return ('pre' + expectedReleaseType) as SemverReleaseType
    } else {
        return expectedReleaseType
    }
}

function isString(val: unknown) {
    return typeof val === 'string'
}

/**
 * if a version is currently in pre-release state,
 * and if it current in-pre-release type is same as expect type,
 * it should continue the pre-release with the same type
 */
function shouldContinuePrerelease(version: string, expectType: string) {
    return getCurrentActiveType(version) === expectType
}

function isInPrerelease(version: string): version is SemverReleaseType {
    return Array.isArray(semver.prerelease(version))
}

const TypeList = [ 'major', 'minor', 'patch' ].reverse() as string[]

/**
 * extract the in-pre-release type in target version
 */
function getCurrentActiveType(version: string): string | undefined {
    const typelist = TypeList
    for (let i = 0; i < typelist.length; i++) {
        if ((semver as any)[typelist[i]](version)) {
            return typelist[i]
        }
    }
    return
}

/**
 * calculate the priority of release type,
 * major - 2, minor - 1, patch - 0
 */
function getTypePriority(type: string) {
    return TypeList.indexOf(type)
}

function bumpVersion(releaseAs: ReleaseType, currentVersion: string, args: InternalOptions): Promise<Recommendation> {
    return new Promise(async (resolve, reject) => {
        if (releaseAs) {
            return resolve({
                releaseType: releaseAs
            })
        }
        else {
            const presetOptions = presetLoader(args)
            if (typeof presetOptions === 'object') {
                if (semver.lt(currentVersion, '1.0.0'))
                    presetOptions.preMajor = true
            }

            await conventionalRecommendedBump({
                // debug: args.verbose ? console.info.bind(console, 'conventional-recommended-bump') : undefined,
                preset: presetOptions,
                path: args.path,
                tagPrefix: args.tagPrefix,
                lernaPackage: args.lernaPackage
            }, function (err, release) {
                if (err) return reject(err)
                else return resolve(release as any)
            })
        }
    })
}

/**
 * attempt to update the version number in provided `bumpFiles`
 */
async function updateConfigs(args: InternalOptions, newVersion: string) {
    const dotgit = dotGitignore()
    for (const bumpFile of args.bumpFiles) {
        const updater = await resolveUpdaterObjectFromArgument(bumpFile)
        if (!updater)
            continue

        const configPath = path.resolve(process.cwd(), updater.filename)
        try {
            if (dotgit.ignore(configPath))
                continue

            const stat = fs.lstatSync(configPath)
            if (!stat.isFile())
                continue

            const contents = fs.readFileSync(configPath, 'utf8')
            checkpoint(
                args,
                'bumping version in ' + updater.filename + ' from %s to %s',
                [ updater.updater.readVersion(contents), newVersion ]
            )
            writeFile(
                args,
                configPath,
                updater.updater.writeVersion(contents, newVersion)
            )
            // flag any config files that we modify the version # for
            // as having been updated.
            configsToUpdate[updater.filename] = true
        } catch(e) {
            const err = e as NodeJS.ErrnoException
            if (err.code !== 'ENOENT')
                console.warn(err.message)
        }
    }
}
