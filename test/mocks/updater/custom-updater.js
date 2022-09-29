const REPLACER = /version: "(.*)"/

/** @type { import('../../../source/lib/index.js').Updater } */
const custom = {
    readVersion(contents) {
        // @ts-ignore
        return REPLACER.exec(contents)[1]
    },

    writeVersion(contents, version) {
        contents = contents.replace(
            // @ts-ignore
            REPLACER.exec(contents)?.[0],
            `version: "${version}"`
        )
        return contents
    }
}

export default custom
