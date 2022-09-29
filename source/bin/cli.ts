const [ major, minor ] = process.version.slice(1).split('.').map(Number)
if (major < 14 || minor < 8) {
    console.error('conventional-version: Node v14.8 or greater is required. `conventional-version` did not run.')
    process.exitCode = 1
}
else {
    const { cmdLine } = await import('./command.js')
    const { conventionalVersion } = await import('../lib/index.js')

    try {
        const argv = await cmdLine.parse()
        await conventionalVersion(argv)
    }
    catch {
        process.exitCode = 1
    }
}
