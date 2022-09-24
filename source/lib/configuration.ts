import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { findUp } from 'find-up'
import { require } from './require.js'
import { createRequire } from 'node:module'
import type { Config } from 'conventional-changelog-config-spec'

const CONFIGURATION_FILES = [
    '.versionrc',
    '.versionrc.js',
    '.versionrc.cjs',
    '.versionrc.mjs',
    '.versionrc.json',
]

// Like path.extname() but accounts for names with multiple extenions: index.d.ts => .d.ts
function extname(filename: string) {
    filename = path.basename(filename)
    while (filename.startsWith('.'))
        filename = filename.slice(1)
    const dot = filename.indexOf('.')
    return ~dot ? filename.slice(dot) : ''
}

async function importCfg(configPath: string): Promise<Config> {
    const cfg = (await import(configPath)).default
    return typeof cfg === 'function' ? cfg() : cfg
}

async function requireCfg(configPath: string): Promise<Config> {
    const cfg = createRequire(import.meta.url)(configPath)
    return typeof cfg === 'function' ? cfg() : cfg
}

async function loadCfg(configPath: string): Promise<Config> {
    return JSON.parse(await readFile(configPath, 'utf-8'))
}

export async function getConfiguration() {
    let config: Config = {}

    const configPath = await findUp(CONFIGURATION_FILES)
    if (!configPath)
        return config

    let cfg: Config
    switch(extname(configPath)) {
        case '.js':
        case '.mjs':
            cfg = await importCfg(configPath)
            break

        case '.cjs':
        case '.json':
            cfg = await requireCfg(configPath)
            break

        default:
            cfg = await loadCfg(configPath)
    }

    const ext = extname(configPath)
    if (ext === '.js' || ext === '.cjs') {
        const jsConfiguration = require(configPath) //as Configuration | (() => Configuration)
        if (typeof jsConfiguration === 'function')
            config = jsConfiguration()
        else
            config = jsConfiguration
    }
    else config = JSON.parse(await readFile(configPath, 'utf-8'))

    /**
     * @todo we could eventually have deeper validation of the configuration (using `ajv`) and
     * provide a more helpful error.
     */
    if (typeof config !== 'object') {
        throw Error(
            `[conventional-version] Invalid configuration in ${configPath} provided. Expected an object but found ${typeof config}.`
        )
    }

    return config
}
