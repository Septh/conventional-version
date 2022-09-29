import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { Options } from '../source/lib/index.js'
import { shell } from './mocks/shell.js'
import { conventionalVersion, mock, unmock, type Package } from './mocks/mocks.js'

import { should } from 'chai'
should()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function execFile(cmd: string, args: string[] = []) {
    return shell.exec(cmd, args, { shell: true })
}

async function exec(args: string | Options = '') {

    if (typeof args === 'string') {
        const { cmdLine } = await import('../source/bin/command.js')
        args = await cmdLine.parse(args)

        // Force reload configuration on each run
        const { getConfiguration } = await import('../source/lib/configuration.js')
        Object.assign(args, await getConfiguration())

        // Force reload package.json on each run
        try {
            const pkg = JSON.parse(await fs.readFile('package.json', 'utf-8'))
            Object.assign(args, pkg['conventional-version'])
        }
        catch {}
    }

    await conventionalVersion(args)
}

async function writePackageJson(version: string, option: any = {}) {
    const pkg = Object.assign({}, option, { version })
    await fs.writeFile('package.json', JSON.stringify(pkg), 'utf-8')
}

async function writeHook(hookName: string, causeError: boolean = false, script: string = '') {
    await shell.mkdir('scripts', { recursive: true })
    let content = script || 'console.error("' + hookName + ' ran")'
    content += causeError ? '\nthrow new Error("' + hookName + '-failure")' : ''
    await fs.writeFile('scripts/' + hookName + '.js', content, 'utf-8')
    await fs.chmod('scripts/' + hookName + '.js', '755')
}

async function getPackageVersion() {
    return JSON.parse(await fs.readFile('package.json', 'utf-8')).version
}

describe('git', function() {
    let test_index = 0

    before(async function() {
        await shell.mkdir(`tmp`, { recursive: true })
        shell.cd(`tmp`)
    })

    after(async function() {
        shell.cd('..')
        // await shell.rm('tmp', { recursive: true })
    })

    beforeEach(async function() {
        const test_dir = `test_${++test_index}`
        await shell.mkdir(test_dir, { recursive: true })
        shell.cd(test_dir)

        for (const args of [
            ['init'],
            ['config', 'commit.gpgSign', 'false'],
            ['config', 'core.autocrlf', 'false'],
            ['commit', '--allow-empty', '-m"root-commit"'],
        ]) {
            await execFile('git', args)
        }

        await writePackageJson('1.0.0')
    })

    afterEach(async function() {
        shell.cd('..')
        unmock()
    })

    describe('tagPrefix', () => {
        // TODO: Use unmocked git-semver-tags and stage a git environment
        it('will add prefix onto tag based on version from package', async function() {
            await writePackageJson('1.2.0')
            await mock({ bump: 'minor', tags: ['p-v1.2.0'], fs: false })
            await exec('--tag-prefix p-v')
            const { stdout: tag } = await execFile('git', ['tag'])
            tag.should.match(/p-v1\.3\.0/)
        })

        it('will add prefix onto tag via when gitTagFallback is true and no package [cli]', async function() {
            await fs.rm('package.json')
            await mock({ bump: 'minor', tags: ['android/production/v1.2.0', 'android/production/v1.0.0'], fs: false })
            await exec('--tag-prefix android/production/v')
            const { stdout: tag } = await execFile('git', ['tag'])
            tag.should.match(/android\/production\/v1\.3\.0/)
        })

        it('will add prefix onto tag via when gitTagFallback is true and no package [options]', async function() {
            await mock({ bump: 'minor', tags: ['android/production/v1.2.0', 'android/production/v1.0.0'], fs: false })
            await exec({ tagPrefix: 'android/production/v', packageFiles: [] })
            const { stdout: tag } = await execFile('git', ['tag'])
            tag.should.match(/android\/production\/v1\.3\.0/)
        })
    })

    it('formats the commit and tag messages appropriately', async function() {
        await mock({ bump: 'minor', tags: ['v1.0.0'], fs: false })
        await exec({})

        // check last commit message
        const { stdout: log } = await execFile('git', ['log', '--oneline', '-n1'])
        log.should.match(/chore\(release\): 1\.1\.0/)

        // check annotated tag message
        const { stdout: tag } = await execFile('git', ['tag', '-l', '-n1', 'v1.1.0'])
        tag.should.match(/chore\(release\): 1\.1\.0/)
    })

    it('formats the tag if --first-release is true', async function() {
        await writePackageJson('1.0.1')
        await mock({ bump: 'minor', fs: false })
        await exec('--first-release')
        const { stdout: tag } = await execFile('git', ['tag'])
        tag.should.match(/1\.0\.1/)
    })

    it('commits all staged files', async function() {
        await fs.writeFile('CHANGELOG.md', 'legacy header format<a name="1.0.0">\n', 'utf-8')
        await fs.writeFile('STUFF.md', 'stuff\n', 'utf-8')
        await execFile('git', [ 'add', 'STUFF.md' ])

        await mock({ bump: 'patch', changelog: 'release 1.0.1\n', tags: ['v1.0.0'], fs: false })
        await exec('--commit-all')

        // see http://unix.stackexchange.com/questions/155046/determine-if-git-working-directory-is-clean-from-a-script
        const { stdout: status } = await execFile('git', ['status', '--porcelain'])
        status.should.equal('')
        status.should.not.match(/STUFF.md/)

        const content = await fs.readFile('CHANGELOG.md', 'utf-8')
        content.should.match(/1\.0\.1/)
        content.should.not.match(/legacy header format/)
    })

    it('does not run git hooks if the --no-verify flag is passed', async function() {
        await fs.writeFile('.git/hooks/pre-commit', '#!/bin/sh\necho "precommit ran"\nexit 1', 'utf-8')
        await fs.chmod('.git/hooks/pre-commit', '755')

        await mock({ bump: 'minor', fs: false })
        await exec('--no-verify')
        await exec('-n')
    })

    it('allows the commit phase to be skipped', async function() {
        const changelogContent = 'legacy header format<a name="1.0.0">\n'
        await writePackageJson('1.0.0')
        await fs.writeFile('CHANGELOG.md', changelogContent, 'utf-8')

        await mock({ bump: 'minor', changelog: 'new feature\n', fs: false })
        await exec('--skip.commit true')
        const version = await getPackageVersion()
        version.should.equal('1.1.0')

        const content = await fs.readFile('CHANGELOG.md', 'utf-8')
        content.should.match(/new feature/)

        const { stdout: log } = await execFile('git', [ 'log', '--oneline', '-n1' ])
        log.should.match(/root-commit/)
    })

    it('dry-run skips all non-idempotent steps', async function() {
        await execFile('git', [ 'tag', '-a', 'v1.0.0', '-m', '"my awesome first release"'])
        const flush = await mock({ bump: 'minor', changelog: '### Features\n', tags: ['v1.0.0'], fs: false })
        await exec('--dry-run')
        const { stdout } = flush()
        stdout.join('').should.match(/### Features/)

        const { stdout: log } = await execFile('git', [ 'log', '--oneline', '-n1'])
        log.should.match(/root-commit/)

        const { stdout: tag } = await execFile('git', ['tag'])
        tag.should.match(/1\.0\.0/)

        const version = await getPackageVersion()
        version.should.equal('1.0.0')
    })

    it('works fine without specifying a tag id when prereleasing', async function() {
        await writePackageJson('1.0.0')
        await fs.writeFile('CHANGELOG.md', 'legacy header format<a name="1.0.0">\n', 'utf-8')
        await mock({ bump: 'minor', fs: false })
        await exec('--prerelease')
        const version = await getPackageVersion()
        version.should.equal('1.1.0-0')
    })

    describe('gitTagFallback', () => {
        it('defaults to 1.0.0 if no tags in git history', async () => {
            await fs.rm('package.json')
            await mock({ bump: 'minor', fs: false })
            await exec({})
            const { stdout: tag } = await execFile('git', ['tag'])
            tag.should.include('v1.1.0')
        })

        it('bases version on greatest version tag, if tags are found', async () => {
            await fs.rm('package.json')
            await mock({ bump: 'minor', tags: ['v3.9.0', 'v5.0.0', 'v3.0.0'], fs: false })
            await exec({})
            const { stdout: tag } = await execFile('git', ['tag'])
            tag.should.include('v5.1.0')
        })
    })

    describe('configuration', () => {
        it('.versionrc : releaseCommitMessageFormat', async function() {
            await fs.writeFile('.versionrc', JSON.stringify({
                releaseCommitMessageFormat: 'This commit represents release: {{currentTag}}'
            }), 'utf-8')
            await mock({ bump: 'minor', fs: false })
            await exec('')

            const { stdout: log } = await execFile('git', ['log', '--oneline', '-n1'])
            log.should.include('This commit represents release: 1.1.0')
        })

        it('--releaseCommitMessageFormat', async function() {
            await mock({ bump: 'minor', fs: false })
            await exec('--releaseCommitMessageFormat="{{currentTag}} is the version."')

            const { stdout: log } = await execFile('git', ['log', '--oneline', '-n1'])
            log.should.include('1.1.0 is the version.')
        })

        it('[LEGACY] supports --message (and single %s replacement)', async function() {
            await mock({ bump: 'minor', fs: false })
            await exec('--message="V:%s"')

            const { stdout: log } = await execFile('git', ['log', '--oneline', '-n1'])
            log.should.include('V:1.1.0')
        })

        it('[LEGACY] supports -m (and multiple %s replacements)', async function() {
            await mock({ bump: 'minor', fs: false })
            await exec('--message="V:%s is the %s."')

            const { stdout: log } = await execFile('git', ['log', '--oneline', '-n1'])
            log.should.include('V:1.1.0 is the 1.1.0.')
        })
    })

    describe('precommit hook', function() {
        it('should run the precommit hook when provided', async function() {
            await writeHook('precommit')
            await writePackageJson('1.0.0', {
                'conventional-version': {
                    scripts: { precommit: 'node scripts/precommit.js' }
                }
            })
            await fs.writeFile('CHANGELOG.md', 'legacy header format<a name="1.0.0">\n', 'utf-8')

            const flush = await mock({ bump: 'minor', fs: false })
            await exec('--patch')

            const { stderr } = flush()
            stderr.join('').should.match(/precommit ran/)
        })

        it('should run the precommit hook when provided via .versionrc.json (#371)', async function() {
            await writeHook('precommit')
            await fs.writeFile('.versionrc.json', JSON.stringify({
                scripts: { precommit: 'node scripts/precommit.js' }
            }), 'utf-8')
            await fs.writeFile('CHANGELOG.md', 'legacy header format<a name="1.0.0">\n', 'utf-8')

            const flush = await mock({ bump: 'minor', fs: false })
            await exec('')

            const { stderr = [], stdout = [] } = flush()
            stderr.join('').should.match(/precommit ran/)
        })

        it('should run the precommit hook and exit with error when precommit fails', async function() {
            await writeHook('precommit', true)
            await writePackageJson('1.0.0', {
                'conventional-version': {
                    scripts: { precommit: 'node scripts/precommit.js' }
                }
            })
            await fs.writeFile('CHANGELOG.md', 'legacy header format<a name="1.0.0">\n', 'utf-8')

            await mock({ bump: 'minor', fs: false })
            try {
                await exec('--patch')
                throw new Error('Unexpected success')
            }
            catch (error: any) {
                error.message.should.match(/precommit-failure/)
            }
        })

        it('should allow an alternate commit message to be provided by precommit script', async function() {
            await writeHook('precommit', false, 'console.log("releasing %s delivers #222")')
            await writePackageJson('1.0.0', {
                'conventional-version': {
                    scripts: { precommit: 'node scripts/precommit.js' }
                }
            })
            await fs.writeFile('CHANGELOG.md', 'legacy header format<a name="1.0.0">\n', 'utf-8')

            await mock({ bump: 'minor', fs: false })
            debugger
            await exec('--patch')

            const { stdout: log } = await execFile('git', ['log', '--oneline', '-n1'])
            log.should.match(/delivers #222/)
        })
    })

    describe('Run ... to publish', function() {
        it('does normally display `npm publish`', async function() {
            const flush = await mock({ bump: 'patch', fs: false })
            await exec('')

            const { stdout } = flush()
            stdout.join('').should.match(/npm publish/)
        })

        it('does not display `npm publish` if the package is private', async function() {
            await writePackageJson('1.0.0', { private: true })
            const flush = await mock({ bump: 'patch', fs: false })
            await exec('')

            const { stdout } = flush()
            stdout.join('').should.not.match(/npm publish/)
        })

        it('does not display `npm publish` if there is no package.json', async function() {
            await fs.rm('package.json')
            const flush = await mock({ bump: 'patch', fs: false })
            await exec('')

            const { stdout } = flush()
            stdout.join('').should.not.match(/npm publish/)
        })

        it('does not display `all staged files` without the --commit-all flag', async function() {
            const flush = await mock({ bump: 'patch', fs: false })
            await exec('')

            const { stdout } = flush()
            stdout.join('').should.not.match(/all staged files/)
        })

        it('does display `all staged files` if the --commit-all flag is passed', async function() {
            const flush = await mock({ bump: 'patch', fs: false })
            await exec('--commit-all')

            const { stdout } = flush()
            stdout.join('').should.match(/all staged files/)
        })

        it('advises use of --tag prerelease for publishing to npm', async function() {
            await writePackageJson('1.0.0')
            await fs.writeFile('CHANGELOG.md', 'legacy header format<a name="1.0.0">\n', 'utf-8')

            const flush = await mock({ bump: 'patch', fs: false })
            await exec('--prerelease')

            const { stdout } = flush()
            stdout.join('').should.include('--tag prerelease')
        })

        it('advises use of --tag alpha for publishing to npm when tagging alpha', async function() {
            await writePackageJson('1.0.0')
            await fs.writeFile('CHANGELOG.md', 'legacy header format<a name="1.0.0">\n', 'utf-8')

            const flush = await mock({ bump: 'patch', fs: false })
            await exec('--prerelease alpha')

            const { stdout } = flush()
            stdout.join('').should.include('--tag alpha')
        })

        it('does not advise use of --tag prerelease for private modules', async function() {
            await writePackageJson('1.0.0', { private: true })
            await fs.writeFile('CHANGELOG.md', 'legacy header format<a name="1.0.0">\n', 'utf-8')

            const flush = await mock({ bump: 'minor', fs: false })
            await exec('--prerelease')

            const { stdout } = flush()
            stdout.join('').should.not.include('--tag prerelease')
        })
    })
})
