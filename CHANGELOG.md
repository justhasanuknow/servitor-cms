# Changelog

All notable changes to Servitor CMS are listed here. Versions follow [Semantic Versioning](https://semver.org/); before 1.0.0, a minor version may change configuration, the API or the data in incompatible ways, and its notes say so.

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
