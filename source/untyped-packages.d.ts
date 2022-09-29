declare module 'stringify-package' {
    function stringifyPackage(data: any, indent?: string | number, newline?: string): string
    export = stringifyPackage
}

declare module 'dotgitignore' {
    export interface Options {
        cwd: string
    }
    export interface DotGitIgnore {
        ignore(name: string): boolean
    }
    function dotgitignore(options?: Options): DotGitIgnore
    export = dotgitignore
}

declare module 'git-raw-commits' {
    import Stream from "node:stream"

    export interface ExecOptions {
        cwd?: string | undefined;
    }

    export interface GitOptions {
        from?: string | undefined;
        to?: string | undefined;
        format?: string | undefined;
        debug?: ((message: any) => void) | undefined;
        path?: string | undefined;
        [options: string]: any;
    }

    function gitRawCommits(gitOptions: GitOptions, execOptions?: ExecOptions): Stream.Readable
    export = gitRawCommits
}

declare module 'git-semver-tags' {
    export type Callback = (error: any, tags: string[]) => void;

    export interface Options {
        lernaTags?: boolean | undefined;
        package?: string | undefined;
        tagPrefix?: string | undefined;
        skipUnstable?: boolean | undefined;
    }

    function gitSemverTags(options: gitSemverTags.Options, callback: gitSemverTags.Callback): void;
    function gitSemverTags(callback: gitSemverTags.Callback): void;
    export = gitSemverTags
}

declare module 'conventional-changelog-config-spec' {
    import { JSONSchema7 } from 'json-schema'

    interface CommitType {
        type: string
        section?: string
        hidden?: boolean
    }

    export interface Config {
        header?: string
        types?: CommitType[]
        preMajor?: boolean
        commitUrlFormat?: string
        compareUrlFormat?: string
        issueUrlFormat?: string
        userUrlFormat?: string
        releaseCommitMessageFormat?: string
        issuePrefixes?: string[]
    }

    /** The spec is exposed as a JSON schema.  */
    const ConventionalChangelogConfigSpec: JSONSchema7
    export = ConventionalChangelogConfigSpec
}

declare module 'conventional-changelog' {
    import Stream from "node:stream"
    import {
        Context,
        Options as CoreOptions,
    } from "conventional-changelog-core"
    import { Context as WriterContext, Options as WriterOptions } from "conventional-changelog-writer"
    import { Commit, Options as ParserOptions } from "conventional-commits-parser"
    import { GitOptions as GitRawCommitsOptions } from 'git-raw-commits'

    export interface Options<TCommit extends Commit = Commit, TContext extends WriterContext = WriterContext> extends CoreOptions<TCommit, TContext> {
        preset?: string | { name: string }
    }

    function conventionalChangelog<
        TCommit extends Commit = Commit,
        TContext extends WriterContext = Context
    >(
        options?: Options<TCommit, TContext>,
        context?: Partial<TContext>,
        gitRawCommitsOpts?: GitRawCommitsOptions,
        parserOpts?: ParserOptions,
        writerOpts?: WriterOptions<TCommit, TContext>
    ): Stream.Readable
    export = conventionalChangelog
}

declare module 'conventional-changelog-core' {
    import Stream from "node:stream"
    import {
        Context as BaseContext,
        Options as BaseWriterOptions,
    } from "conventional-changelog-writer";
    import {
        Commit,
        Options as BaseParserOptions,
    } from "conventional-commits-parser";
    import { Options as RecommendedBumpOptions } from "conventional-recommended-bump";
    import { ExecOptions as GitRawExecOptions, GitOptions as BaseGitRawCommitsOptions } from "git-raw-commits";
    import { Package } from "normalize-package-data";

    export interface Context extends BaseContext {
        previousTag?: string
        currentTag?: string
        linkCompare?: boolean
    }

    export interface GitRawCommitsOptions extends BaseGitRawCommitsOptions {
        reverse?: boolean
    }

    type MergedContext<T extends BaseContext = BaseContext> = T & {
        readonly gitSemverTags?: ReadonlyArray<string>
        readonly packageData?: Readonly<Partial<Package>>
    }

    export interface Options<TCommit extends Commit = Commit, TContext extends BaseContext = BaseContext> {
        config?: Config<TCommit, TContext>
        pkg?: Pkg
        append?: boolean
        releaseCount?: number
        skipUnstable?: boolean
        debug?: Logger
        warn?: Logger
        transform?: Transform<TCommit>
        outputUnreleased?: boolean
        lernaPackage?: string | null
        tagPrefix?: string
    }

    export type Config<TCommit extends Commit = Commit, TContext extends BaseContext = BaseContext> =
        | Promise<ConfigObject<TCommit, TContext>>
        | ConfigFunction<TCommit, TContext>
        | ConfigObject<TCommit, TContext>

    type ConfigFunction<TCommit extends Commit = Commit, TContext extends BaseContext = BaseContext>
        = (callback: ConfigCallback<TCommit, TContext>) => void

    type ConfigCallback<TCommit extends Commit = Commit, TContext extends BaseContext = BaseContext>
        = (error: any, config: ConfigObject<TCommit, TContext>) => void

    interface ConfigObject<TCommit extends Commit = Commit, TContext extends BaseContext = BaseContext> {
        context?: Partial<TContext>
        gitRawCommitsOpts?: GitRawCommitsOptions
        parserOpts?: ParserOptions
        recommendedBumpOpts?: RecommendedBumpOptions
        writerOpts?: WriterOptions<TCommit, TContext>
    }

    type Logger = (message?: any) => void

    interface Pkg {
        path?: string
        transform?: ((pkg: Record<string, any>) => Record<string, any>)
    }

    interface Transform<T extends Commit = Commit> {
        (commit: Commit, cb: (error: any, commit: T) => void): void
    }

    export interface ParserOptions extends BaseParserOptions {
    }

    export interface WriterOptions<TCommit extends Commit = Commit, TContext extends BaseContext = BaseContext> extends BaseWriterOptions<TCommit, MergedContext<TContext>> {
    }

    function conventionalChangelogCore<TCommit extends Commit = Commit, TContext extends BaseContext = Context>(
        options?: Options<TCommit, TContext>,
        context?: Partial<TContext>,
        gitRawCommitsOpts?: GitRawCommitsOptions,
        parserOpts?: ParserOptions,
        writerOpts?: WriterOptions<TCommit, TContext>,
        execOpts?: GitRawExecOptions
    ): Stream.Readable
    export = conventionalChangelogCore
}

declare module 'conventional-changelog-writer' {
    import Stream from "node:stream"
    import { Commit, Note } from "conventional-commits-parser";

    interface CommitGroup<T extends Commit = Commit> {
        title: string | false
        commits: Array<TransformedCommit<T>>
    }

    export interface Context {
        version?: string
        title?: string
        isPatch?: boolean
        host?: string
        owner?: string
        repository?: string
        repoUrl?: string
        linkReferences?: boolean
        commit: string;
        issue: string;
        date: string;
    }

    type GeneratedContext<TCommit extends Commit = Commit, TContext extends Context = Context> =
        TContext & TransformedCommit<TCommit> & ExtraContext<TCommit>

    interface ExtraContext<T extends Commit = Commit> {
        commitGroups: Array<CommitGroup<T>>
        noteGroups: NoteGroup[]
    }

    interface NoteGroup {
        title: string | false;
        commits: Note[]
    }

    export interface Options<TCommit extends Commit = Commit, TContext extends Context = Context> {
        transform?: Transform<TCommit, TContext>
        groupBy?: string | false
        commitGroupsSort?: Sort<CommitGroup<TCommit>>
        commitsSort?: Sort<TransformedCommit<TCommit>>
        noteGroupsSort?: Sort<NoteGroup>
        notesSort?: Sort<Note>
        generateOn?: GenerateOn<TContext, TCommit>
        finalizeContext?: FinalizeContext<TContext, TCommit>
        debug?: ((message?: any) => void)
        reverse?: boolean
        includeDetails?: boolean
        ignoreReverted?: boolean
        doFlush?: boolean
        mainTemplate?: string
        headerPartial?: string
        commitPartial?: string
        footerPartial?: string
        partials?: Record<string, string>
    }

    type FinalizeContext<TContext extends Context = Context, TCommit extends Commit = Commit> =
    (
        context: GeneratedContext<TCommit, TContext>,
        options: Options<TCommit, TContext>,
        commits: Array<TransformedCommit<TCommit>>,
        keyCommit: TransformedCommit<TCommit>
    ) => GeneratedContext<TCommit, TContext>

    type GenerateOn<TContext extends Context = Context, TCommit extends Commit = Commit> =
        | string
        | object
        | GenerateOnFunction<TContext, TCommit>
    type GenerateOnFunction<TContext extends Context = Context, TCommit extends Commit = Commit> =
    (
        commit: TransformedCommit<TCommit>,
        commits: Array<TransformedCommit<TCommit>>,
        context: GeneratedContext<TCommit, TContext>,
        options: Options<TCommit, TContext>
    ) => boolean

    type Sort<T = any> =
        | ((a: T, b: T) => number)
        | string
        | ReadonlyArray<string>
        | false

    type Transform<TCommit extends Commit = Commit, TContext extends Context = Context> =
        | TransformObject
        | TransformFunction<TCommit, TContext>

    type TransformFunction<TCommit extends Commit = Commit, TContext extends Context = Context> =
        (commit: Commit, context: TContext) => TCommit | false

    type TransformObject = Record<string, object | TransformObjectFunction>
    type TransformObjectFunction<T = any> = (value: T, path: string) => T

    type TransformedCommit<T extends Commit = Commit> = Omit<T, "raw"> & { raw: T; }

    function conventionalChangelogWriter<TCommit extends Commit = Commit, TContext extends Context = Context>(
        context?: Partial<TContext>,
        options?: Options<TCommit, TContext>
    ): Stream.Transform
    export = conventionalChangelogWriter
}

declare module 'conventional-commits-parser' {
    import Stream from "node:stream"

    export type Commit<Fields extends string | number | symbol = string | number | symbol> =
        CommitBase & { [Field in Exclude<Fields, keyof CommitBase>]?: Field }

    type Field = string | null
    type Actions = string[] | string | null
    type Correspondence = string[] | string | null
    type Keywords = string[] | string | null
    type Pattern = RegExp | string | null
    type Prefixes = string[] | string | null

    export interface Note {
        title: string
        text: string
    }

    interface Reference {
        issue: string
        action: Field
        owner: Field
        repository: Field
        prefix: string
        raw: string
    }

    interface Revert {
        hash: Field
        header?: Field
        [field: string]: Field | undefined
    }

    interface CommitBase {
        merge: Field
        header: Field
        body: Field
        footer: Field
        notes: Note[]
        references: Reference[]
        mentions: string[]
        revert: Revert | null
        type?: Field
        scope?: Field
        subject?: Field
    }

    export interface Options {
        mergePattern?: Pattern
        mergeCorrespondence?: Correspondence
        headerPattern?: Pattern
        headerCorrespondence?: Correspondence
        referenceActions?: Actions
        issuePrefixes?: Prefixes
        issuePrefixesCaseSensitive?: boolean
        noteKeywords?: Keywords
        fieldPattern?: Pattern
        revertPattern?: Pattern
        revertCorrespondence?: Correspondence
        commentChar?: string | null
        warn?: ((message?: any) => void) | boolean
    }

    function conventionalCommitsParser(options?: Options): Stream.Transform
    namespace conventionalCommitsParser {
        function sync(commit: string, options?: Options): Commit
    }
    export = conventionalCommitsParser
}

declare module 'conventional-recommended-bump' {
    import { Config } from "conventional-changelog-core"
    import { Commit, Options as ParserOptions } from "conventional-commits-parser"
    import { Context as WriterContext } from "conventional-changelog-writer"

    interface Result {
        level?: number
        reason?: string
    }

    export interface Recommendation extends Result {
        releaseType?: "major" | "minor" | "patch"
    }

    export interface Options {
        ignoreReverted?: boolean
        preset?: string | { name: string }
        config?: Config<Commit, WriterContext>
        whatBump?: (commits: Commit[]) => Result
        tagPrefix?: string
        skipUnstable?: boolean
        lernaPackage?: string
        path?: string
    }

    export type Callback = (error: any, recommendation: Recommendation) => void

    function conventionalRecommendedBump(options: Options, callback: Callback): void
    function conventionalRecommendedBump(options: Options, parserOpts: ParserOptions, callback: Callback): void
    export = conventionalRecommendedBump
}
