import path from 'node:path'
import stream from 'node:stream'
import url from 'node:url'
import esmock from 'esmock'
import mockFS from 'mock-fs'
import stdMocks from 'std-mocks'
import { runExecFile as _runExecFile } from '../../source/lib/run-execFile.js'

import type { InternalOptions } from '../../source/lib/defaults.js'
import type { Options as ParserOptions } from 'conventional-commits-parser'
import type { Options as BumpOptions, Callback as BumpCallback } from 'conventional-recommended-bump'
import type { Options as ChangelogOptions } from 'conventional-changelog'
import type { Options as TagsOptions, Callback as TagsCallback } from 'git-semver-tags'
import type { Config as SpecConfig } from 'conventional-changelog-config-spec'

type ConventionalRecommendedBumpPackage = { default: typeof import('conventional-recommended-bump') }
type ConventionalChangelogPackage = { default: typeof import('conventional-changelog') }
type GitSemverTagsPackage = { default: typeof import('git-semver-tags') }
type RunExecFileModule = typeof import('../../source/lib/run-execFile.js')
type IndexModule = typeof import('../../source/lib/index.js')

export type ExecFileFunction = typeof _runExecFile
export interface Package {
    private?: boolean
    version?: string
    repository?: string | { url: string }
    'conventional-version'?: SpecConfig
}

const __filename = url.fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const fsMocks: Record<string, ReturnType<typeof mockFS.load>> = {
    'node_modules': mockFS.load(path.resolve(__dirname, '../../node_modules')),
    'source':       mockFS.load(path.resolve(__dirname, '../../source')),
    'files':        mockFS.load(path.resolve(__dirname, 'files')),
    'updater':      mockFS.load(path.resolve(__dirname, 'updater'))
}

let __mocks: {
    bump?: 'major' | 'minor' | 'patch' | Error | ((opt: BumpOptions, cb: BumpCallback) => void)
    changelog?: string | Error | ((opt: ChangelogOptions) => string | null) | (string | Error | ((opt: ChangelogOptions) => string | null))[]
    tags?: string[]
    pkg?: Package | boolean
    fs?: { [key: string]: any } | boolean
    execFile?: ExecFileFunction
} = {}

const globalMocks: {
    'conventional-recommended-bump': ConventionalRecommendedBumpPackage
    'conventional-changelog': ConventionalChangelogPackage
    'git-semver-tags': GitSemverTagsPackage
    '../../source/lib/run-execFile.ts': RunExecFileModule
} = {
    'conventional-recommended-bump': {
        default: (options: BumpOptions, parserOptions: ParserOptions | BumpCallback, cb?: BumpCallback) => {
            cb ??= parserOptions as BumpCallback

            const { bump } = __mocks
            if (typeof bump === 'function')
                bump(options, cb)
            else if (bump instanceof Error)
                cb(bump, {})
            else cb(null, bump ? { releaseType: bump }: {})
        }
    },
    'conventional-changelog': {
        default: (options?: ChangelogOptions<any, any>) => {
            const changelog = Array.isArray(__mocks.changelog) ? __mocks.changelog : [ __mocks.changelog ]
            return new stream.Readable({
                read(_size) {
                    const next = changelog.shift()
                    if (next instanceof Error)
                        this.destroy(next)
                    else if (typeof next === 'function')
                        this.push(next(options as ChangelogOptions))
                    else
                        this.push(next ? Buffer.from(next, 'utf-8') : null)
                }
            })
        }
    },
    'git-semver-tags': {
        default: (options: TagsOptions | TagsCallback, cb?: TagsCallback) => {
            cb ??= options as TagsCallback

            const { tags } = __mocks
            if (tags instanceof Error)
                cb(tags, [])
            else cb(null, tags ?? [])
        }
    },
    '../../source/lib/run-execFile.ts': {
        runExecFile(args: InternalOptions, cmd: string, cmdArgs: string[]) {
            const { execFile: runExecFile = _runExecFile } = __mocks
            return runExecFile(args, cmd, cmdArgs)
        }
    }
}

const { conventionalVersion } = await esmock('../../source/lib/index.ts', import.meta.url,
    {},
    globalMocks
) as IndexModule
export { conventionalVersion }

export async function mock(mocks: typeof __mocks = {}) {
    __mocks = mocks

    const { pkg = { version: '1.0.0' }, fs = {} } = mocks
    if (typeof pkg !== 'boolean')
        if (typeof fs !== 'boolean')
            fs['package.json'] ??= JSON.stringify(pkg)

    if (typeof fs !== 'boolean')
        mockFS({
            ...fsMocks,
            ...fs
        })

    stdMocks.use()
    return () => stdMocks.flush()
}

export function unmock() {
    __mocks = {}
    stdMocks.restore()

    if (typeof __mocks.fs !== 'boolean')
        mockFS.restore()

    const { stdout } = stdMocks.flush()
    for (const str of stdout) {
        if (str.startsWith(' '))
            process.stdout.write(str)
    }
}
