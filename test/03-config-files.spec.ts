import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { conventionalVersion, mock, unmock, type Package } from './mocks/mocks.js'

import { should } from 'chai'
should()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function exec() {
    const { cmdLine } = await import('../source/bin/command.js')
    const { getConfiguration } = await import('../source/lib/configuration.js')

    // Force reload package.json on each run
    let pkg: any = {}
    try {
        pkg = JSON.parse(await fs.readFile('package.json', 'utf-8'))
    }
    catch {}

    const options = Object.assign({},
        await cmdLine.parse('conventional-version'),
        // Need to force reload configuration on each run
        await getConfiguration(),
        pkg['conventional-version'],
        {
            skip: {
                commit: true,
                tag: true
        }
    })

    await conventionalVersion(options)
}

describe('config files', () => {
    let test_index = 0

    before(async function() {
        await fs.mkdir(`tmp`, { recursive: true })
        process.chdir(`tmp`)
    })

    after(async function () {
        process.chdir('..')
        await fs.rm('tmp', { recursive: true })
    })

    beforeEach(async function () {
        const test_dir = `test_${++test_index}`
        await fs.mkdir(test_dir, { recursive: true })
        process.chdir(test_dir)
    })

    afterEach(async function () {
        unmock()
        process.chdir('..')
    })

    it('reads config from package.json', async function () {
        const issueUrlFormat = 'https://company.net/browse/{{id}}'
        const pkg = {
            version: '1.0.0',
            repository: { url: 'git+https://company@scm.org/office/app.git' },
            'conventional-version': { issueUrlFormat }
        }
        await fs.writeFile('package.json', JSON.stringify(pkg), 'utf-8')

        await mock({
            bump: 'minor',
            changelog: ({ preset }: any) => preset.issueUrlFormat,
            fs: false
        })
        await exec()

        const content = await fs.readFile('CHANGELOG.md', 'utf-8')
        content.should.include(issueUrlFormat)
    })

    it('reads config from .versionrc', async function () {
        const issueUrlFormat = 'http://www.foo.com/{{id}}'
        await fs.writeFile('.versionrc', JSON.stringify({ issueUrlFormat }), 'utf-8')
        await fs.writeFile('package.json', JSON.stringify({ version: '1.0.0' }), 'utf-8')

        await mock({
            bump: 'minor',
            changelog: ({ preset }: any) => preset.issueUrlFormat,
            fs: false
        })
        await exec()

        const content = await fs.readFile('CHANGELOG.md', 'utf-8')
        content.should.include(issueUrlFormat)
    })

    it('reads config from .versionrc.json', async function () {
        const issueUrlFormat = 'http://www.bar.com/{{id}}'
        await fs.writeFile('.versionrc.json', JSON.stringify({ issueUrlFormat }), 'utf-8')
        await fs.writeFile('package.json', JSON.stringify({ version: '1.0.0' }), 'utf-8')

        await mock({
            bump: 'minor',
            changelog: ({ preset }: any) => preset.issueUrlFormat,
            fs: false
        })
        await exec()

        const content = await fs.readFile('CHANGELOG.md', 'utf-8')
        content.should.include(issueUrlFormat)
    })

    it('evaluates a config-function from .versionrc.js', async function () {
        const issueUrlFormat = 'http://www.baz.com/{{id}}'
        const src = `module.exports = function() { return ${JSON.stringify({issueUrlFormat})} }`
        await fs.writeFile('.versionrc.js', src, 'utf-8')
        await fs.writeFile('package.json', JSON.stringify({ version: '1.0.0' }), 'utf-8')

        await mock({
            bump: 'minor',
            changelog: ({ preset }: any) => preset.issueUrlFormat,
            fs: false
        })
        await exec()

        const content = await fs.readFile('CHANGELOG.md', 'utf-8')
        content.should.include(issueUrlFormat)
    })

    it('evaluates a config-object from .versionrc.js', async function () {
        const issueUrlFormat = 'http://www.doe.com/{{id}}'
        const src = `module.exports = ${JSON.stringify({ issueUrlFormat })}`
        await fs.writeFile('.versionrc.js', src, 'utf-8')
        await fs.writeFile('package.json', JSON.stringify({ version: '1.0.0' }), 'utf-8')

        await mock({
            bump: 'minor',
            changelog: ({ preset }: any) => preset.issueUrlFormat,
            fs: false
        })
        await exec()

        const content = await fs.readFile('CHANGELOG.md', 'utf-8')
        content.should.include(issueUrlFormat)
    })

    it('throws an error when a non-object is returned from .versionrc.js', async function () {
        await fs.writeFile('.versionrc.js', 'module.exports = 3', 'utf-8')
        await fs.writeFile('package.json', JSON.stringify({ version: '1.0.0' }), 'utf-8')

        await mock({ bump: 'minor', fs: false })
        try {
            await exec()
            throw new Error('Unexpected success')
        }
        catch (e: unknown) {
            const error = e as NodeJS.ErrnoException
            error.message.should.match(/Invalid configuration/)
        }
    })
})
