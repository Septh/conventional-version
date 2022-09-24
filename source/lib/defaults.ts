import spec, { type Config } from 'conventional-changelog-config-spec'
import { require } from './require.js'

export type ReleaseType = 'major' | 'minor' | 'patch'

export interface BaseOptions {
    packageFiles?: string[]
    bumpFiles?: string[]
    releaseAs?: string      // 'major' | 'minor' | 'patch' | x.y.z
    prerelease?: string
    infile?: string
    /** @deprecated */
    message?: string
    firstRelease?: boolean
    sign?: boolean
    noVerify?: boolean
    commitAll?: boolean
    silent?: boolean
    tagPrefix?: string
    scripts?: Record<string, any>
    skip?: Partial<Record<'bump' | 'changelog' | 'commit' | 'tag', boolean>>
    dryRun?: boolean
    gitTagFallback?: boolean
    path?: string
    /** @deprecated */
    changelogHeader?: string
    preset?: string
    lernaPackage?: string
}

export interface Options extends BaseOptions, Config {
}

export interface InternalOptions extends Required<BaseOptions>, Config {
    outputUnreleased: boolean | undefined
    verbose: boolean | undefined
    verify: boolean | undefined
}

const defaults: Options = {
    infile: 'CHANGELOG.md',
    firstRelease: false,
    sign: false,
    noVerify: false,
    commitAll: false,
    silent: false,
    tagPrefix: 'v',
    scripts: {},
    skip: {},
    dryRun: false,
    gitTagFallback: true,
    preset: require.resolve('conventional-changelog-conventionalcommits'),
}

/**
 * Merge in defaults provided by the spec
 */
Object.keys(spec.properties!).forEach(propertyKey => {
    const property = (spec.properties as any)[propertyKey]
    if (property)
        (defaults as any)[propertyKey] = property.default
})

/**
 * Sets the default for `header` (provided by the spec) for backwards
 * compatibility. This should be removed in the next major version.
 */
defaults.header = '# Changelog\n\nAll notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.\n'

defaults.packageFiles = [
    'package.json',
    'bower.json',
    'manifest.json'
]

defaults.bumpFiles = defaults.packageFiles.concat(
    'package-lock.json',
    'npm-shrinkwrap.json'
)

export { defaults }
