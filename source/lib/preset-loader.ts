// TODO: this should be replaced with an object we maintain and
// describe in: https://github.com/conventional-changelog/conventional-changelog-config-spec
import { createRequire } from 'node:module'
import spec, { type Config } from 'conventional-changelog-config-spec'
import type { InternalOptions } from './defaults.js'

export interface Preset extends Config {
    name: string
}

const defaultPreset = createRequire(import.meta.url).resolve('conventional-changelog-conventionalcommits')

export function presetLoader(args: InternalOptions): Preset {
    const preset: Preset = {
        name: args.preset || defaultPreset
    }

    if (preset.name === defaultPreset) {
        Object.keys(spec.properties!).forEach(key => {
            const value = args[key as keyof Config]
            if (value !== undefined)
                (preset as any)[key] = value
        })
    }

    return preset
}
