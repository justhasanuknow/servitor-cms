# Development

This page is for people who work on the code of Servitor CMS: setting up a checkout, the structure of the project, tests and conventions. Before you open a pull request, also read `CONTRIBUTING.md` in the repository.

## Setting up

Requirements: Node.js 24 with npm, and Git.

```bash
git clone https://github.com/justhasanuknow/servitor-cms.git
cd servitor-cms
npm ci
cp .env.example .env
```

Adjust `.env` for your machine:

```ini
ORIGIN=http://localhost:5173
BETTER_AUTH_SECRET=<output of openssl rand -hex 32>
DATABASE_PATH=./data/servitor.db
UPLOADS_DIR=./data/uploads
FOUNDER_PASSWORD=<a passphrase of at least 12 characters>
ADDRESS_HEADER=
XFF_DEPTH=
```

Leave `ADDRESS_HEADER` and `XFF_DEPTH` empty, because there is no proxy in front of the development server. The `data/` folder is git-ignored. Then start the development server:

```bash
npm run dev
```

Open `http://localhost:5173/panel/login` and sign in as the founder. Like the production server, the development server applies the migrations and creates the founder on the first start. Leave the SMTP variables empty unless you want to test email.

`allowScripts` in `package.json` lists the dependencies that may run install scripts. When a new dependency needs one, add it there with its exact version.

## Commands

| Command                | Purpose                                                                         |
| ---------------------- | ------------------------------------------------------------------------------- |
| `npm run dev`          | Development server with hot reload at `http://localhost:5173`.                  |
| `npm run build`        | Production build into `build/`: the SvelteKit app, `server.js` and `cli.js`.    |
| `npm run check`        | Compiles the messages and type-checks the project with `svelte-check`.          |
| `npm run lint`         | Prettier, ESLint and markdownlint, without changing files.                      |
| `npm run format`       | Formats every file with Prettier.                                               |
| `npm run test:unit`    | Vitest in watch mode. Add `-- --run` for a single run.                          |
| `npm run test:e2e`     | Builds the app and runs the Playwright tests against it.                        |
| `npm test`             | Unit tests once, then the end-to-end tests.                                     |
| `npm run db:generate`  | Creates a migration from changes to the database schema.                        |
| `npm run auth:schema`  | Regenerates the Better Auth tables in `src/lib/server/db/auth.schema.ts`.       |
| `npm run i18n:compile` | Compiles the messages into `src/lib/paraglide`.                                 |
| `npm run sbom`         | Prints the CycloneDX software bill of materials of the production dependencies. |

The command line from [Operations](operations.md#command-line) works on a local build as well. It reads its configuration from the environment, so pass the `.env` file to Node:

```bash
npm run build
node --env-file=.env build/cli.js backup
```

## Project structure

```text
src/
  server.ts                production entry: security headers, then the SvelteKit handler
  cli.ts                   command line: backup, restore, reset-founder, sign-out
  hooks.server.ts          request pipeline: runtime, sessions, access rules, locale, headers
  routes/
    panel/                 the panel: sign-in pages, signed-in pages and previews
    blog/                  public reading pages, feeds and sitemaps
    api/v1/                the REST API
    docs/                  this documentation
    media/                 image delivery
    healthz/               the health check
  lib/
    components/            Svelte components; ui/ holds the shadcn-svelte components
    constants/             routes, limits and other shared values
    content/               editor extensions shared by the editor and the server
    i18n/                  locale detection and helpers for messages
    modules/interfaces/    shared TypeScript interfaces
    server/                server-only modules, one folder per area
messages/                  panel texts per locale
drizzle/                   SQL migrations
docs/                      this documentation in Markdown
tests/e2e/                 Playwright tests
```

Routes stay thin: they parse the request, call a module in `src/lib/server` and return the result. The modules receive the runtime from `src/lib/server/runtime.ts`, which holds the database, the logger, the mailer, the rate limiters and the background jobs for scheduled publishing and webhook deliveries.

All permission checks live in `src/lib/server/permissions/permissions.ts`. Server code asks it with the acting user and, where it matters, the target, for example the post or user being changed.

## Database and migrations

Servitor uses SQLite through better-sqlite3 and Drizzle ORM. The tables are defined in `src/lib/server/db/tables/`, the Better Auth tables are generated into `src/lib/server/db/auth.schema.ts`, and the migrations in `drizzle/` run automatically when the app or the command line starts.

To change the schema:

1. Change the table definitions.
2. Run `npm run db:generate` and review the new SQL file in `drizzle/`.
3. Commit the migration together with the code that needs it.

Never change a migration that was released. For triggers, virtual tables and other SQL that the table definitions cannot express, create an empty migration with `npx drizzle-kit generate --custom --name <name>` and write the SQL yourself. `0001_invariants.sql`, with the integrity triggers and the append-only audit log, and `0003_post_search.sql`, with the full-text search, are examples.

## Panel languages

The texts of the panel are in `messages/<locale>.json`, one file per panel language, with English as the base. Paraglide compiles them into functions:

```svelte
<script lang="ts">
  import { m } from '$lib/paraglide/messages';
</script>

<h1>{m.docs_title()}</h1>
```

Every text a user can see goes through a message, and every key exists in all six files: a test fails when a key or a placeholder is missing in any locale. Content languages are separate; they are managed in the panel and need no code.

To add a panel language, add it to `locales` in `project.inlang/settings.json`, create its message file, add it to `UI_LOCALES` and `UI_LOCALE_AUTONYMS` in `src/lib/constants/preferences.ts`, and extend the `ui_locale` check of the user table with a migration.

## Tests

Unit and integration tests use Vitest. They live next to the code as `*.spec.ts` and run in Node. The helpers in `src/lib/server/testing` create a migrated database in a temporary folder and a complete runtime with helpers for users, sign-ins and posts, a clock that tests can advance and a mailer that collects messages. Temporary files belong in the git-ignored `.tmp/` folder.

```bash
npm run test:unit -- --run
npx vitest run src/lib/server/docs
```

End-to-end tests use Playwright and live in `tests/e2e`. The configuration builds the app, starts `build/server.js` at `http://127.0.0.1:4173` with a fresh data folder under `.tmp/e2e`, and runs a setup step that signs in the founder and replaces the seeded password before the other tests start.

```bash
npm run test:e2e
npx playwright test tests/e2e/docs.e2e.ts
```

Every test must make at least one assertion. Permission-sensitive behavior needs tests for the allowed and the refused case.

## Conventions

- Code, commit messages and documentation are written in English.
- TypeScript runs in strict mode. `any`, `@ts-ignore`, non-null assertions and the conditional operator `? :` are not used, and comparisons use strict equality; ESLint enforces these rules.
- Code has no comments: names and small functions explain it.
- Interfaces live in `*.interfaces.ts` files next to the code that uses them; interfaces shared across areas live in `src/lib/modules/interfaces`.
- Prettier formats everything, with tabs. Run `npm run format` instead of formatting by hand.
- Raw HTML is inserted only by `src/lib/components/content/content-html.svelte`, and only after it was sanitized on the server.
- Commits are focused and their subjects use the imperative mood, for example "Add webhook retries".

## Writing documentation

The pages in `docs/` are served at `/docs`. Their order and sections come from `src/lib/server/docs/docs-manifest.ts`, so a new page must be added there. Tests fail when a page is missing from the manifest or when a link points to a page or heading that does not exist.

- Link to other pages by file name, such as `[Webhooks](webhooks.md#events)`, so that links work on GitHub and in the app.
- The first heading of a page is its title. The headings of the second and third level appear in the table of contents.
- Raw HTML is not rendered. Use Markdown only.
- markdownlint checks the files as part of `npm run lint`.

## Continuous integration

`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests:

- `npm audit` for known vulnerabilities, lint, type check, unit tests, the build and the Playwright tests;
- a Docker job that builds the image, starts it from an empty volume and checks the health endpoint, the sign-in page, a backup, the unprivileged user and the software bill of materials.

Dependabot proposes updates for npm packages, GitHub Actions and the Docker base image every week.

## Releasing

1. Open a pull request that sets the new version with `npm version <version> --no-git-tag-version`, adds its section to `CHANGELOG.md`, updates the version in the examples of `.env.example`, `docs/installation.md` and `docs/deployment.md`, and, when a new minor line starts, updates `SERVITOR_VERSION` in `.env.example`.
2. Merge it once continuous integration passes.
3. Publish a GitHub release with the tag `v<version>` on the merge commit and the notes from the changelog.

Publishing the release starts `.github/workflows/release.yml`. It builds the image from the tagged commit for `linux/amd64` and `linux/arm64`, each on a native runner of its architecture, combines both into one multi-platform image, pushes it to `ghcr.io/<owner>/servitor-cms` as `<version>`, `<major>.<minor>` and `latest`, and attaches a signed build provenance attestation. Every job has a time limit, so a stuck build fails instead of holding up the release. To build the image of an existing tag again, run the workflow by hand under **Actions → Release image** with that tag.

## Branch rules

`.github/rulesets/` holds the rules for `main` as GitHub ruleset files:

- `main-protection.json` applies to everybody: changes arrive only through squash-merged pull requests, `verify` and `docker` must pass, review threads must be resolved, and force pushes and deleting the branch are blocked.
- `main-review.json` also requires an approving review from a code owner, listed in `.github/CODEOWNERS`. Repository admins may skip only this rule when they merge a pull request, because nobody can approve their own pull request.

GitHub enforces rulesets on public repositories and on private repositories of paid plans. Apply them once with the GitHub CLI:

```bash
gh api -X POST repos/{owner}/{repo}/rulesets --input .github/rulesets/main-protection.json
gh api -X POST repos/{owner}/{repo}/rulesets --input .github/rulesets/main-review.json
```

To change a rule later, edit the file and update the ruleset under **Settings → Rules → Rulesets**, or with `gh api -X PUT repos/{owner}/{repo}/rulesets/<id> --input <file>`.
