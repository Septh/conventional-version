import path from 'node:path'
import { pathToFileURL } from 'node:url'
import json from './types/json.js'
import plainText from './types/plain-text.js'
import { defaults } from '../defaults.js'

// Updaters
export interface Updater {
    readVersion(contents: string): string
    writeVersion(contents: string, version: string): string
    isPrivate?(contents: string): boolean
}

type UpdaterType = 'json' | 'plain-text'

export interface UpdaterSpec {
    filename: string
    type?: string
    updater?: string
}

export interface ResolvedUpdater {
    filename: string
    type: UpdaterType
    updater: Updater
}

const JSON_BUMP_FILES = defaults.bumpFiles!
const PLAIN_TEXT_BUMP_FILES = [ 'VERSION.txt', 'version.txt' ]
const updatersByType: Record<UpdaterType, Updater> = {
    json,
    'plain-text': plainText
}

function getUpdaterByType(type: UpdaterType): Updater {
    const updater = updatersByType[type]
    if (!updater) {
        throw Error(`Unable to locate updater for provided type (${type}).`)
    }
    return updater
}

function getUpdaterByFilename(filename: string): Updater {
    const basename = path.basename(filename)

    if (JSON_BUMP_FILES.includes(basename))
        return getUpdaterByType('json')

    if (PLAIN_TEXT_BUMP_FILES.includes(basename))
        return getUpdaterByType('plain-text')

    throw Error(
        `Unsupported file (${filename}) provided for bumping.\n Please specify the updater \`type\` or use a custom \`updater\`.`
    )
}

async function getCustomUpdaterFromPath(updater: string | Updater): Promise<Updater> {
    if (typeof updater === 'string') {
        const { href } = pathToFileURL(path.resolve(process.cwd(), updater))
        const module = await import(href)
        return module.default
    }

    if (isValidUpdater(updater))
        return updater

    throw new Error('Updater must be a string path or an object with readVersion and writeVersion methods')
}

function isValidUpdater(obj: any): obj is Updater {
    return (
        typeof obj.readVersion === 'function' &&
        typeof obj.writeVersion === 'function'
    )
}

export async function resolveUpdaterObjectFromArgument(arg: string): Promise<ResolvedUpdater | false> {
    let updater: ResolvedUpdater = arg as any
    if (isValidUpdater(updater))
        return updater

    if (typeof updater !== 'object')
        updater = { filename: updater } as any as ResolvedUpdater

    try {
        if (typeof updater.updater === 'string')
            updater.updater = await getCustomUpdaterFromPath(updater.updater)
        else if (updater.type)
            updater.updater = getUpdaterByType(updater.type as UpdaterType)
        else
            updater.updater = getUpdaterByFilename(updater.filename)
    }
    catch(e: unknown) {
        const err = e as NodeJS.ErrnoException
        if (err.code !== 'ENOENT')
            console.warn(`Unable to obtain updater for: ${JSON.stringify(arg)}\n - Error: ${err.message}\n - Skipping...`)
    }

    if (!isValidUpdater(updater.updater))
        return false

    return updater as ResolvedUpdater
}
