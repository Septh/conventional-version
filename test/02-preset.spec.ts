import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { shell } from './mocks/shell.js'

import { should } from 'chai'
should()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function execFile(cmd: string, args: string[]) {
    return shell.exec(cmd, args, { shell: true })
}

async function exec(args: string = '') {
    const { cmdLine } = await import('../source/bin/command.js')
    const { conventionalVersion } = await import('../source/lib/index.js')

    const options = await cmdLine.parse(`conventional-version ${args} --silent`)
    options.skip = {
        commit: true,
        tag: true
    }

    await conventionalVersion(options)
}

describe('presets', () => {
    before(async function () {
        await fs.mkdir('tmp', { recursive: true })
        process.chdir('tmp')

        for (const args of [
            [ 'init' ],
            [ 'config', 'commit.gpgSign', 'false' ],
            [ 'config', 'core.autocrlf',  'false' ],
            [ 'commit', '--allow-empty',  '-m', '"initial commit."' ],
            [ 'commit', '--allow-empty',  '-m', '"feat: A feature commit."' ],
            [ 'commit', '--allow-empty',  '-m', '"perf: A performance change."' ],
            [ 'commit', '--allow-empty',  '-m', '"chore: A chore commit."' ],
            [ 'commit', '--allow-empty',  '-m', '"ci: A ci commit."' ],
            [ 'commit', '--allow-empty',  '-m', '"custom: A custom commit."' ],
        ]) {
            await execFile('git', args)
        }
    })

    after(async function () {
        process.chdir('..')
        await fs.rm('tmp', { recursive: true })
    })

    afterEach(async function () {
        await fs.rm('CHANGELOG.md')
    })

    it('Conventional Commits (default)', async function () {
        await exec()
        const content = await fs.readFile('CHANGELOG.md', 'utf-8')
        content.should.contain('### Features')
        content.should.not.contain('### Performance Improvements')
        content.should.not.contain('### Custom')
    })

    it('Angular', async function () {
        await exec('--preset angular')
        const content = await fs.readFile('CHANGELOG.md', 'utf-8')
        content.should.contain('### Features')
        content.should.contain('### Performance Improvements')
        content.should.not.contain('### Custom')
    })
})
