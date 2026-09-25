# Changelog

All notable changes to Servitor CMS are listed here. Versions follow [Semantic Versioning](https://semver.org/); before 1.0.0, a minor version may change configuration, the API or the data in incompatible ways, and its notes say so.

## Unreleased

### Added

- Every password and passphrase field in the panel has a button that shows what was typed. Sending the form hides the value again so that browsers do not remember it, and without JavaScript the button is left out.

### Changed

- The app uses the Servitor icons: an adaptive SVG favicon with an ICO fallback, an Apple touch icon, and the mark next to the product name in the panel, on the sign-in pages and in the documentation.
- The README shows the logo in the light and dark themes of GitHub.

### Fixed

- `/favicon.ico` is served with the `image/x-icon` type.

## 0.2.0 - 2026-09-25

### Added

- Backups and restores in the panel under **Administration → Backups**, for the founder with two-factor authentication: create backups in the background, download them, optionally encrypted with a passphrase, upload archives of any size in chunks, delete them, and restore one through a controlled restart that applies it before the database is opened.
- Scheduled backups every day or every Monday at a UTC hour, keeping a chosen number of scheduled archives and emailing the founder when one fails.
- `decrypt-backup` on the command line for archives downloaded with a passphrase.
- A documentation page on backups and restores.

### Changed

- Backups leave out sessions and verification tokens, so restoring one signs everybody out; restores also remove sessions from older archives.
- Restores compare the database with the schema of its migration history and refuse archives from newer versions or with extra tables, triggers or views.
- The backup manifest records the app version and whether the panel, the schedule or the command line made it.
- The systemd example restarts the app always, which a restore from the panel needs.

### Upgrading

- Set `SERVITOR_VERSION=0.2` in your `.env`. A new migration adds the `backup_schedule` table; it runs on start.

## 0.1.1 - 2026-09-24

### Added

- Every release is published as a prebuilt image for `linux/amd64` and `linux/arm64` at `ghcr.io/justhasanuknow/servitor-cms`, tagged with the version, the minor line and `latest`, and with a signed build provenance attestation.

### Changed

- `docker-compose.yml` runs the prebuilt image in the version set by the new `SERVITOR_VERSION` variable instead of building on the server; `docker compose up -d --build` still builds from the source. Add `SERVITOR_VERSION`, for example `0.1`, to your `.env` when you update, and use `docker compose pull` to fetch new versions.
- The installation and update guides describe the prebuilt image and pinning a version.
- The project website is [servitor.rua.systems](https://servitor.rua.systems).

### Fixed

- An end-to-end test of the public pages could fail when it ran at the same time as the headless mode test.

## 0.1.0 - 2026-09-24

The first public release.

### Writing

- Block editor with headings, nested and task lists, quotes, tables, highlighted code, math, images from the media library and YouTube and Vimeo embeds.
- Automatic saving of the working draft, a revision history with restore, and previews of unpublished versions.
- Media library that re-encodes uploads to WebP in several sizes, removes metadata and keeps alternative texts per language.

### Languages

- One translation per content language for every post, with its own slug, excerpt, tags, search and sharing fields and publishing state.
- Content languages with any BCP 47 code; the panel in English, Turkish, French, German, Japanese and Simplified Chinese.

### Workflow

- Founder, admin and author roles, direct publishing for trusted authors, a review queue, scheduled first publication, moderation with reasons and an append-only audit log.

### Delivery

- Server-rendered public reading pages without JavaScript, with SEO metadata, RSS feeds and sitemaps, and a headless mode.
- Read-only REST API with scoped API keys, full-text search, rate limits, conditional requests and an OpenAPI 3.1 description.
- Signed webhooks with a persistent queue, retries and SSRF protection.

### Security and operations

- Reviewed against OWASP ASVS 5.0 levels 1 and 2.
- Single container with SQLite, automatic migrations, a health check, backup and restore commands and a software bill of materials.
- Documentation for installation, deployment, operations, every part of the panel and the integrations, served by the app at `/docs`.
