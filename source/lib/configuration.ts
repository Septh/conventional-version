import path from 'node:path'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { findUp } from 'find-up'
import type { Config } from 'conventional-changelog-config-spec'

const CONFIGURATION_FILES = [
    '.versionrc',
    '.versionrc.cjs',
    '.versionrc.json',
    '.versionrc.js'
]

export async function getConfiguration() {
    let config: Config = {}

    const configPath = await findUp(CONFIGURATION_FILES)
    if (!configPath)
        return config

    const ext = path.extname(configPath)
    if (ext === '.js' || ext === '.cjs') {
        const jsModule = pathToFileURL(configPath).href

        const jsConfiguration = (await import(jsModule)).default
        if (typeof jsConfiguration === 'function')
            config = await jsConfiguration()
        else
            config = jsConfiguration
    }
    else config = JSON.parse(readFileSync(configPath, 'utf-8'))

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
