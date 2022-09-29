import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { conventionalVersion, mock, unmock, type ExecFileFunction } from './mocks/mocks.js'

import type { Options } from '../source/lib/defaults.js'
import { formatCommitMessage } from '../source/lib/format-commit-message.js'
import type { ReleaseType } from '../source/lib/defaults.js'

import { should } from 'chai'
should()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function exec(args: string | Options = '', git?: boolean) {
    if (typeof args === 'string') {
        const { cmdLine } = await import('../source/bin/command.js')
        args = await cmdLine.parse(`conventional-version ${args}`)
    }

    if (!git) {
        args.skip = {
            ...args.skip,
            commit: true,
            tag: true
        }
    }

    await conventionalVersion(args)
}

function getPackageVersion(): string {
    return JSON.parse(fs.readFileSync('package.json', 'utf-8')).version
}

describe('format-commit-message', () => {

    it('works for no {{currentTag}}', async () => {
        formatCommitMessage('chore(release): 1.0.0', '1.0.0').should.equal('chore(release): 1.0.0')
    })

    it('works for one {{currentTag}}', async () => {
        formatCommitMessage('chore(release): {{currentTag}}', '1.0.0').should.equal('chore(release): 1.0.0')
    })

    it('works for two {{currentTag}}', async () => {
        formatCommitMessage(
            'chore(release): {{currentTag}} \n\n* CHANGELOG: https://github.com/conventional-changelog/standard-version/blob/v{{currentTag}}/CHANGELOG.md',
            '1.0.0'
        ).should.equal(
            'chore(release): 1.0.0 \n\n* CHANGELOG: https://github.com/conventional-changelog/standard-version/blob/v1.0.0/CHANGELOG.md'
        )
    })
})

describe('cli', function () {
    afterEach(unmock)

    describe('CHANGELOG.md does not exist', function () {
        it('populates changelog with commits since last tag by default', async function () {
            await mock({ bump: 'patch', changelog: 'patch release\n', tags: ['v1.0.0'] })
            await exec()

            const content = fs.readFileSync('CHANGELOG.md', 'utf-8')
            content.should.match(/patch release/)
        })

        it('includes all commits if --first-release is true', async function () {
            await mock({
                bump: 'minor',
                changelog: 'first commit\npatch release\n',
                pkg: { version: '1.0.1' }
            })
            await exec('--first-release')

            const content = fs.readFileSync('CHANGELOG.md', 'utf-8')
            content.should.match(/patch release/)
            content.should.match(/first commit/)
        })

        it('skipping changelog will not create a changelog file', async function () {
            await mock({ bump: 'minor', changelog: 'foo\n' })
            await exec('--skip.changelog true')
            getPackageVersion().should.equal('1.1.0')

            try {
                fs.readFileSync('CHANGELOG.md', 'utf-8')
                throw new Error('File should not exist')
            }
            catch (e: any) {
                e.code.should.equal('ENOENT')
            }
        })
    })

    describe('CHANGELOG.md exists', function () {
        it('appends the new release above the last release, removing the old header (legacy format)', async function () {
            await mock({
                bump: 'patch',
                changelog: 'release 1.0.1\n',
                fs: { 'CHANGELOG.md': 'legacy header format<a name="1.0.0">\n' },
                tags: ['v1.0.0']
            })
            await exec()
            const content = fs.readFileSync('CHANGELOG.md', 'utf-8')
            content.should.match(/1\.0\.1/)
            content.should.not.match(/legacy header format/)
        })

        it('appends the new release above the last release, removing the old header (new format)', async function () {
            const { defaults: { header } } = await import('../source/lib/defaults.js')
            const changelog1 =
                '### [1.0.1](/compare/v1.0.0...v1.0.1) (YYYY-MM-DD)\n\n\n### Bug Fixes\n\n* patch release ABCDEFXY\n'
            await mock({ bump: 'patch', changelog: changelog1, tags: ['v1.0.0'] })
            await exec()
            let content = fs.readFileSync('CHANGELOG.md', 'utf-8')
            content.should.equal(header + '\n' + changelog1)

            const changelog2 =
                '### [1.0.2](/compare/v1.0.1...v1.0.2) (YYYY-MM-DD)\n\n\n### Bug Fixes\n\n* another patch release ABCDEFXY\n'
            unmock()
            await mock({
                bump: 'patch',
                changelog: changelog2,
                fs: { 'CHANGELOG.md': content },
                tags: ['v1.0.0', 'v1.0.1']
            })
            await exec()
            content = fs.readFileSync('CHANGELOG.md', 'utf-8')
            content.should.equal(header + '\n' + changelog2 + changelog1)
        })

        it('[DEPRECATED] (--changelogHeader) allows for a custom changelog header', async function () {
            const header = '# Pork Chop Log'
            await mock({
                bump: 'minor',
                changelog: header + '\n',
                fs: { 'CHANGELOG.md': '' }
            })
            await exec(`--changelogHeader="${header}"`)
            const content = fs.readFileSync('CHANGELOG.md', 'utf-8')
            content.should.match(new RegExp(header))
        })

        it('[DEPRECATED] (--changelogHeader) exits with error if changelog header matches last version search regex', async function () {
            await mock({ bump: 'minor', fs: { 'CHANGELOG.md': '' } })
            try {
                await exec('--changelogHeader="## 3.0.2"')
                throw new Error('That should not have worked')
            }
            catch (error: any) {
                error.message.should.match(/custom changelog header must not match/)
            }
        })
    })

    describe('lifecycle scripts', () => {
        describe('prerelease hook', function () {
            it('should run the prerelease hook when provided', async function () {
                const flush = await mock({
                    bump: 'minor',
                    fs: { 'CHANGELOG.md': 'legacy header format<a name="1.0.0">\n' }
                })
                await exec({
                    scripts: { prerelease: 'node -e "console.error(\'prerelease\' + \' ran\')"' }
                })
                const { stderr } = flush()
                stderr.join('\n').should.match(/prerelease ran/)
            })

            it('should abort if the hook returns a non-zero exit code', async function () {
                await mock({
                    bump: 'minor',
                    fs: { 'CHANGELOG.md': 'legacy header format<a name="1.0.0">\n' }
                })
                try {
                    await exec({
                        scripts: {
                            prerelease: 'node -e "throw new Error(\'prerelease\' + \' fail\')"'
                        }
                    })
                    throw new Error('Unexpected success')
                }
                catch (error: any) {
                    error.message.should.match(/prerelease fail/)
                }
            })
        })

        describe('prebump hook', function () {
            it('should allow prebump hook to return an alternate version #', async function () {
                const flush = await mock({
                    bump: 'minor',
                    fs: { 'CHANGELOG.md': 'legacy header format<a name="1.0.0">\n' }
                })
                await exec({ scripts: { prebump: 'node -e "console.log(Array.of(9, 9, 9).join(\'.\'))"' } })
                const { stdout } = flush()
                stdout.join('').should.match(/9\.9\.9/)
            })
        })

        describe('postbump hook', function () {
            it('should run the postbump hook when provided', async function () {
                const flush = await mock({
                    bump: 'minor',
                    fs: { 'CHANGELOG.md': 'legacy header format<a name="1.0.0">\n' }
                })
                await exec({
                    scripts: { postbump: 'node -e "console.error(\'postbump\' + \' ran\')"' }
                })
                const { stderr } = flush()
                stderr.join('\n').should.match(/postbump ran/)
            })

            it('should run the postbump and exit with error when postbump fails', async function () {
                await mock({
                    bump: 'minor',
                    fs: { 'CHANGELOG.md': 'legacy header format<a name="1.0.0">\n' }
                })
                try {
                    await exec({
                        scripts: { postbump: 'node -e "throw new Error(\'postbump\' + \' fail\')"' }
                    })
                    await exec('--patch')
                    throw new Error('Unexpected success')
                }
                catch (error: any) {
                    error.message.should.match(/postbump fail/)
                }
            })
        })
    })

    describe('manual-release', function () {
        describe('release-types', function () {
            const regularTypes: ReleaseType[] = ['major', 'minor', 'patch']
            const nextVersion: Record<ReleaseType, string> = { major: '2.0.0', minor: '1.1.0', patch: '1.0.1' }

            regularTypes.forEach(function (type) {
                it('creates a ' + type + ' release', async function () {
                    await mock({
                        bump: 'patch',
                        fs: { 'CHANGELOG.md': 'legacy header format<a name="1.0.0">\n' }
                    })
                    await exec('--release-as ' + type)
                    getPackageVersion().should.equal(nextVersion[type])
                })
            })

            // this is for pre-releases
            regularTypes.forEach(function (type) {
                it('creates a pre' + type + ' release', async function () {
                    await mock({
                        bump: 'patch',
                        fs: { 'CHANGELOG.md': 'legacy header format<a name="1.0.0">\n' }
                    })
                    await exec('--release-as ' + type + ' --prerelease ' + type)
                    getPackageVersion().should.equal(`${nextVersion[type]}-${type}.0`)
                })
            })
        })

        describe('release-as-exact', function () {
            it('releases as v100.0.0', async function () {
                await mock({
                    bump: 'patch',
                    fs: { 'CHANGELOG.md': 'legacy header format<a name="1.0.0">\n' }
                })
                await exec('--release-as v100.0.0')
                getPackageVersion().should.equal('100.0.0')
            })

            it('releases as 200.0.0-amazing', async function () {
                await mock({
                    bump: 'patch',
                    fs: { 'CHANGELOG.md': 'legacy header format<a name="1.0.0">\n' }
                })
                await exec('--release-as 200.0.0-amazing')
                getPackageVersion().should.equal('200.0.0-amazing')
            })
        })

        it('creates a prerelease with a new minor version after two prerelease patches', async function () {
            let releaseType: ReleaseType = 'patch'
            await mock({
                bump: (_, cb) => cb(null, { releaseType }),
                fs: { 'CHANGELOG.md': 'legacy header format<a name="1.0.0">\n' }
            })

            await exec('--release-as patch --prerelease dev')
            getPackageVersion().should.equal('1.0.1-dev.0')

            await exec('--prerelease dev')
            getPackageVersion().should.equal('1.0.1-dev.1')

            releaseType = 'minor'
            await exec('--release-as minor --prerelease dev')
            getPackageVersion().should.equal('1.1.0-dev.0')

            await exec('--release-as minor --prerelease dev')
            getPackageVersion().should.equal('1.1.0-dev.1')

            await exec('--prerelease dev')
            getPackageVersion().should.equal('1.1.0-dev.2')
        })
    })

    it('appends line feed at end of package.json', async function () {
        await mock({ bump: 'patch' })
        await exec()
        const pkgJson = fs.readFileSync('package.json', 'utf-8')
        pkgJson.should.equal('{\n  "version": "1.0.1"\n}\n')
    })

    it('preserves indentation of tabs in package.json', async function () {
        await mock({
            bump: 'patch',
            fs: { 'package.json': '{\n\t"version": "1.0.0"\n}\n' }
        })
        await exec()
        const pkgJson = fs.readFileSync('package.json', 'utf-8')
        pkgJson.should.equal('{\n\t"version": "1.0.1"\n}\n')
    })

    it('preserves indentation of spaces in package.json', async function () {
        await mock({
            bump: 'patch',
            fs: { 'package.json': '{\n    "version": "1.0.0"\n}\n' }
        })
        await exec()
        const pkgJson = fs.readFileSync('package.json', 'utf-8')
        pkgJson.should.equal('{\n    "version": "1.0.1"\n}\n')
    })

    it('preserves carriage return + line feed in package.json', async function () {
        await mock({
            bump: 'patch',
            fs: { 'package.json': '{\r\n  "version": "1.0.0"\r\n}\r\n' }
        })
        await exec()
        const pkgJson = fs.readFileSync('package.json', 'utf-8')
        pkgJson.should.equal('{\r\n  "version": "1.0.1"\r\n}\r\n')
    })

    it('does not print output when the --silent flag is passed', async function () {
        const flush = await mock()
        await exec('--silent')
        flush().should.eql({ stdout: [], stderr: [] })
    })
})

describe('conventional-version', function () {
    afterEach(unmock)

    it('should exit on bump error', async function () {
        await mock({ bump: new Error('bump err') })
        try {
            await exec()
            throw new Error('Unexpected success')
        }
        catch (err: any) {
            err.message.should.match(/bump err/)
        }
    })

    it('should exit on changelog error', async function () {
        await mock({ bump: 'minor', changelog: new Error('changelog err') })
        try {
            await exec()
            throw new Error('Unexpected success')
        }
        catch (err: any) {
            err.message.should.match(/changelog err/)
        }
    })

    it('should exit with error without a package file to bump', async function () {
        await mock({ bump: 'patch', pkg: false })
        try {
            await exec({ gitTagFallback: false })
            throw new Error('Unexpected success')
        }
        catch (err: any) {
            err.message.should.equal('no package file found')
        }
    })

    it('bumps version # in bower.json', async function () {
        await mock({
            bump: 'minor',
            fs: { 'bower.json': JSON.stringify({ version: '1.0.0' }) },
            tags: ['v1.0.0']
        })
        await exec()
        JSON.parse(fs.readFileSync('bower.json', 'utf-8')).version.should.equal(
            '1.1.0'
        )
        getPackageVersion().should.equal('1.1.0')
    })

    it('bumps version # in manifest.json', async function () {
        await mock({
            bump: 'minor',
            fs: { 'manifest.json': JSON.stringify({ version: '1.0.0' }) },
            tags: ['v1.0.0']
        })
        await exec()
        JSON.parse(fs.readFileSync('manifest.json', 'utf-8')).version.should.equal(
            '1.1.0'
        )
        getPackageVersion().should.equal('1.1.0')
    })

    describe('custom `bumpFiles` support', function () {
        /**
         * Not sure why, this one won't pass - mock/version.txt gets updated but mocks/mix.exs does not.
         */
        it.skip('mix.exs + version.txt', async function () {
            await mock({
                bump: 'minor',
                tags: ['v1.0.0']
            })
            await exec({
                bumpFiles: [
                    'files/version.txt',
                    { filename: 'files/mix.exs', updater: 'updater/customer-updater.js' }
                ]
            })

            fs.readFileSync('files/version.txt', 'utf-8').should.equal('1.1.0')
            fs.readFileSync('files/mix.exs', 'utf-8').should.contain('version: "1.1.0"')
        })

        it('bumps a custom `plain-text` file', async function () {
            await mock({
                bump: 'minor',
                fs: {
                    'VERSION_TRACKER.txt': fs.readFileSync(path.resolve(__dirname, 'mocks/files/VERSION-6.3.1.txt'), 'utf-8')
                }
            })
            await exec({
                bumpFiles: [{ filename: 'VERSION_TRACKER.txt', type: 'plain-text' }]
            })
            fs.readFileSync('VERSION_TRACKER.txt', 'utf-8').should.equal('1.1.0')
        })
    })

    describe('custom `packageFiles` support', function () {
        it('reads and writes to a custom `plain-text` file', async function () {
            await mock({
                bump: 'minor',
                fs: {
                    'VERSION_TRACKER.txt': fs.readFileSync(path.resolve(__dirname, 'mocks/files/VERSION-6.3.1.txt'), 'utf-8')
                }
            })
            await exec({
                packageFiles: [
                    { filename: 'VERSION_TRACKER.txt', type: 'plain-text' }
                ],
                bumpFiles: [
                    { filename: 'VERSION_TRACKER.txt', type: 'plain-text' }
                ]
            })
            fs.readFileSync('VERSION_TRACKER.txt', 'utf-8').should.equal('6.4.0')
        })

        it('allows same object to be used in packageFiles and bumpFiles', async function () {
            await mock({
                bump: 'minor',
                fs: {
                    'VERSION_TRACKER.txt': fs.readFileSync(path.resolve(__dirname, 'mocks/files/VERSION-6.3.1.txt'), 'utf-8')
                }
            })
            const origWarn = console.warn
            console.warn = () => {
                throw new Error('console.warn should not be called')
            }
            const filedesc = { filename: 'VERSION_TRACKER.txt', type: 'plain-text' }
            try {
                await exec({ packageFiles: [filedesc], bumpFiles: [filedesc] })
                fs.readFileSync('VERSION_TRACKER.txt', 'utf-8').should.equal('6.4.0')
            }
            finally {
                console.warn = origWarn
            }
        })
    })

    it('`packageFiles` are bumped along with `bumpFiles` defaults [standard-version#533]', async function () {
        await mock({
            bump: 'minor',
            fs: {
                '.gitignore': '',
                'package-lock.json': JSON.stringify({ version: '1.0.0' }),
                'manifest.json': fs.readFileSync(path.resolve(__dirname, 'mocks/files/manifest-6.3.1.json'), 'utf-8')
            },
            tags: ['v1.0.0']
        })

        await exec({
            silent: true,
            packageFiles: [
                {
                    filename: 'manifest.json',
                    type: 'json'
                }
            ]
        })

        JSON.parse(fs.readFileSync('manifest.json',     'utf-8')).version.should.equal('6.4.0')
        JSON.parse(fs.readFileSync('package.json',      'utf-8')).version.should.equal('6.4.0')
        JSON.parse(fs.readFileSync('package-lock.json', 'utf-8')).version.should.equal('6.4.0')
    })

    it('bumps version # in npm-shrinkwrap.json', async function () {
        await mock({
            bump: 'minor',
            fs: {
                'npm-shrinkwrap.json': JSON.stringify({ version: '1.0.0' })
            },
            tags: ['v1.0.0']
        })
        await exec()
        JSON.parse(fs.readFileSync('npm-shrinkwrap.json', 'utf-8')).version.should.equal('1.1.0')
        getPackageVersion().should.equal('1.1.0')
    })

    it('bumps version # in package-lock.json', async function () {
        await mock({
            bump: 'minor',
            fs: {
                '.gitignore': '',
                'package-lock.json': JSON.stringify({ version: '1.0.0' })
            },
            tags: ['v1.0.0']
        })
        await exec()
        JSON.parse(fs.readFileSync('package-lock.json', 'utf-8')).version.should.equal('1.1.0')
        getPackageVersion().should.equal('1.1.0')
    })

    describe('skip', () => {
        it('allows bump and changelog generation to be skipped', async function () {
            const changelogContent = 'legacy header format<a name="1.0.0">\n'
            await mock({
                bump: 'minor',
                changelog: 'foo\n',
                fs: { 'CHANGELOG.md': changelogContent }
            })

            await exec('--skip.bump true --skip.changelog true')
            getPackageVersion().should.equal('1.0.0')

            const content = fs.readFileSync('CHANGELOG.md', 'utf-8')
            content.should.equal(changelogContent)
        })
    })

    it('does not update files present in .gitignore', async () => {
        await mock({
            bump: 'minor',
            fs: {
                '.gitignore': 'package-lock.json\nbower.json',
                // test a defaults.packageFiles
                'bower.json': JSON.stringify({ version: '1.0.0' }),
                // test a defaults.bumpFiles
                'package-lock.json': JSON.stringify({
                    name: '@org/package',
                    version: '1.0.0',
                    lockfileVersion: 1
                })
            },
            tags: ['v1.0.0']
        })
        await exec()
        JSON.parse(fs.readFileSync('package-lock.json', 'utf-8')).version.should.equal('1.0.0')
        JSON.parse(fs.readFileSync('bower.json', 'utf-8')).version.should.equal('1.0.0')
        getPackageVersion().should.equal('1.1.0')
    })

    describe('configuration', () => {
        it('--header', async function () {
            await mock({ bump: 'minor', fs: { 'CHANGELOG.md': '' } })
            await exec('--header="# Welcome to our CHANGELOG.md"')
            const content = fs.readFileSync('CHANGELOG.md', 'utf-8')
            content.should.match(/# Welcome to our CHANGELOG.md/)
        })

        it('--issuePrefixes and --issueUrlFormat', async function () {
            const format = 'http://www.foo.com/{{prefix}}{{id}}'
            const prefix = 'ABC-'
            // TODO: Looks like our typings are wrong here...
            const changelog: any = ({ preset }: { preset: any }) =>
                preset.issueUrlFormat + ':' + preset.issuePrefixes

            await mock({
                bump: 'minor',
                changelog
            })

            await exec(`--issuePrefixes="${prefix}" --issueUrlFormat="${format}"`)
            const content = fs.readFileSync('CHANGELOG.md', 'utf-8')
            content.should.include(`${format}:${prefix}`)
        })
    })

    describe('pre-major', () => {
        it('bumps the minor rather than major, if version < 1.0.0', async function () {
            await mock({
                bump: 'minor',
                pkg: {
                    version: '0.5.0',
                    repository: { url: 'https://github.com/yargs/yargs.git' }
                }
            })
            await exec()
            getPackageVersion().should.equal('0.6.0')
        })

        it('bumps major if --release-as=major specified, if version < 1.0.0', async function () {
            await mock({
                bump: 'major',
                pkg: {
                    version: '0.5.0',
                    repository: { url: 'https://github.com/yargs/yargs.git' }
                }
            })
            await exec('-r major')
            getPackageVersion().should.equal('1.0.0')
        })
    })
})

describe('GHSL-2020-111', function () {
    afterEach(unmock)

    it('does not allow command injection via basic configuration', async function () {
        await mock({ bump: 'patch' })
        await exec({
            noVerify: true,
            infile: 'foo.txt',
            releaseCommitMessageFormat: 'bla `touch exploit`'
        })

        const stat = fs.statSync('./exploit', { throwIfNoEntry: false }) ?? 'nope'
        stat.should.equal('nope')
    })
})

describe('with mocked git', function () {
    afterEach(unmock)

    it('--sign signs the commit and tag', async function() {
        const gitArgs = [
            ['add', 'CHANGELOG.md', 'package.json'],
            ['commit', '-S', 'CHANGELOG.md', 'package.json', '-m', 'chore(release): 1.0.1'],
            ['tag', '-s', 'v1.0.1', '-m', 'chore(release): 1.0.1'],
            ['rev-parse', '--abbrev-ref', 'HEAD']
        ]
        const execFile: ExecFileFunction = (_args, cmd, cmdArgs) => {
            cmd.should.equal('git')
            const expected = gitArgs.shift()!
            cmdArgs.should.deep.equal(expected)
            if (expected[0] === 'rev-parse')
                return Promise.resolve('master')
            return Promise.resolve('')
        }
        await mock({ bump: 'patch', changelog: 'foo\n', execFile })

        await exec('--sign', true)
        gitArgs.should.have.lengthOf(0)
    })

    it('fails if git add fails', async function () {
        const gitArgs = [
            ['add', 'CHANGELOG.md', 'package.json']
        ]
        const execFile: ExecFileFunction = (_args, cmd, cmdArgs) => {
            cmd.should.equal('git')
            const expected = gitArgs.shift()!
            cmdArgs.should.deep.equal(expected)
            if (expected[0] === 'add') {
                return Promise.reject(new Error('Command failed: git\nfailed add'))
            }
            return Promise.resolve('')
        }
        await mock({ bump: 'patch', changelog: 'foo\n', execFile })

        try {
            await exec({}, true)
            throw new Error('Unexpected success')
        }
        catch(e) {
            const error = e as NodeJS.ErrnoException
            error.message.should.match(/failed add/)
        }
    })

    it('fails if git commit fails', async function () {
        const gitArgs = [
            ['add', 'CHANGELOG.md', 'package.json'],
            ['commit', 'CHANGELOG.md', 'package.json', '-m', 'chore(release): 1.0.1']
        ]
        const execFile: ExecFileFunction = (_args, cmd, cmdArgs) => {
            cmd.should.equal('git')
            const expected = gitArgs.shift()!
            cmdArgs.should.deep.equal(expected)
            if (expected[0] === 'commit') {
                return Promise.reject(new Error('Command failed: git\nfailed commit'))
            }
            return Promise.resolve('')
        }
        await mock({ bump: 'patch', changelog: 'foo\n', execFile })

        try {
            await exec({}, true)
            throw new Error('Unexpected success')
        }
        catch (e) {
            const error = e as NodeJS.ErrnoException
            error.message.should.match(/failed commit/)
        }
    })

    it('fails if git tag fails', async function () {
        const gitArgs = [
            ['add', 'CHANGELOG.md', 'package.json'],
            ['commit', 'CHANGELOG.md', 'package.json', '-m', 'chore(release): 1.0.1'],
            ['tag', '-a', 'v1.0.1', '-m', 'chore(release): 1.0.1']
        ]
        const execFile: ExecFileFunction = (_args, cmd, cmdArgs) => {
            cmd.should.equal('git')
            const expected = gitArgs.shift()!
            cmdArgs.should.deep.equal(expected)
            if (expected[0] === 'tag') {
                return Promise.reject(new Error('Command failed: git\nfailed tag'))
            }
            return Promise.resolve('')
        }
        await mock({ bump: 'patch', changelog: 'foo\n', execFile })

        try {
            await exec({}, true)
            throw new Error('Unexpected success')
        }
        catch(e) {
            const error = e as NodeJS.ErrnoException
            error.message.should.match(/failed tag/)
        }
    })
})
