# Servitor CMS

[![CI](https://github.com/justhasanuknow/servitor-cms/actions/workflows/ci.yml/badge.svg)](https://github.com/justhasanuknow/servitor-cms/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

Servitor CMS is an open-source, self-hostable CMS for blog posts and articles in many languages. Your team writes in a structured editor, trusted writers publish directly while other authors go through review, and readers get the content from built-in reading pages, a read-only REST API or your own front end notified by webhooks. It runs as a single container with an embedded SQLite database and needs no other services.

**Website:** [servitor.rua.systems](https://servitor.rua.systems)

## Features

### Writing

- A block editor with headings, nested and task lists, quotes, tables, highlighted code, math, images from the media library and embedded YouTube and Vimeo videos.
- Automatic saving of the working draft, a revision history with restore, and previews of unpublished versions.
- A media library that re-encodes every upload to WebP in several sizes, strips metadata and keeps alternative texts per language.

### Many languages

- Every post has one translation per content language, each with its own title, slug, excerpt, tags, search and sharing fields, and publishing state.
- Content languages are added in the panel with any BCP 47 code. The panel itself speaks English, Turkish, French, German, Japanese and Simplified Chinese.

### Editorial workflow

- Three roles: the founder, admins and authors. Authors who may publish directly publish or schedule right away; others submit their changes to a review queue.
- Staff can hide a post with a reason that its owner sees, and an append-only audit log records sign-ins, account changes, publishing, moderation and configuration.

### Delivery

- Public reading pages under `/blog`, rendered on the server without JavaScript, with canonical and `hreflang` links, Open Graph and JSON-LD data, RSS feeds and sitemaps. Turn them off to run headless.
- A read-only REST API with API keys that can be limited to languages and categories, full-text search, per-key rate limits, conditional requests and an OpenAPI 3.1 description.
- Webhooks signed with HMAC-SHA256, delivered from a persistent queue with retries and protected against requests into your internal network.

### Security and operations

- Reviewed against OWASP ASVS 5.0 levels 1 and 2: no public sign-up, two-factor authentication, a nonce-based Content Security Policy, server-side permission checks and sanitized content.
- One container with a read-only root filesystem and an unprivileged user, migrations on start, a health check, command-line backups and restore, and a software bill of materials in the image. Every release is published as a signed, multi-architecture image on the GitHub Container Registry.
- Backups from the panel for the founder: on demand or on a schedule, encrypted downloads, uploads of any size and restores with a controlled restart.
- The complete documentation ships with the app at `/docs`.

## Quick start

Requirements: Docker with Docker Compose.

```bash
git clone https://github.com/justhasanuknow/servitor-cms.git
cd servitor-cms
cp .env.example .env
```

Edit `.env`: set `BETTER_AUTH_SECRET` to the output of `openssl rand -hex 32`, and fill in `FOUNDER_EMAIL`, `FOUNDER_NAME` and `FOUNDER_PASSWORD` (12 to 128 characters). To try Servitor on your own machine without a reverse proxy, also set `ORIGIN=http://localhost:3000` and leave `ADDRESS_HEADER` and `XFF_DEPTH` empty. Then start the container:

```bash
docker compose up -d
```

Compose pulls the prebuilt image `ghcr.io/justhasanuknow/servitor-cms` for amd64 or arm64 in the version set by `SERVITOR_VERSION`; add `--build` to build it from the source instead.

Open `http://localhost:3000/panel/login` and sign in as the founder; the panel asks for a new password first. For a production setup with TLS, follow [Installation](docs/installation.md) and [Deployment](docs/deployment.md).

Servitor runs as a single instance: rate limits, the publishing scheduler and the webhook worker live inside the application process, so never start more than one container on the same data.

## Documentation

The documentation lives in [docs/](docs/README.md), and every installation serves it at `/docs`; the panel links to it under **Help → Documentation**.

- **Getting started**: [Concepts](docs/getting-started.md), [Installation](docs/installation.md) and [Configuration](docs/configuration.md).
- **Deployment and operations**: [Deployment](docs/deployment.md) behind Caddy, Nginx or Coolify, [Operations](docs/operations.md) with recovery, secret rotation and logs, [Backups and restores](docs/backups.md), and [Email](docs/email.md).
- **Using the panel**: [The panel and your account](docs/panel.md), [Users and roles](docs/users.md), [Writing posts](docs/posts.md), [Publishing](docs/publishing.md), [Media](docs/media.md), [Languages and categories](docs/languages-and-categories.md), [Settings and audit log](docs/settings.md) and the [Public site](docs/public-site.md).
- **Integrations**: the [REST API](docs/api.md) and [Webhooks](docs/webhooks.md).
- **Reference**: [Security](docs/security.md), the [Security review](docs/SECURITY-REVIEW.md), [Troubleshooting](docs/troubleshooting.md) and [Development](docs/development.md).

## Built with

SvelteKit and Svelte 5, TypeScript, Tailwind CSS with shadcn-svelte, a Tiptap editor adapted from Edra, Better Auth, Drizzle ORM with SQLite, Paraglide, sharp, Vitest and Playwright, on Node.js 24.

## Development

Requirements: Node.js 24 with npm.

```bash
npm ci
cp .env.example .env
npm run dev
```

In `.env`, fill in the secret and the founder as above, set `ORIGIN=http://localhost:5173`, leave `ADDRESS_HEADER` and `XFF_DEPTH` empty, and keep the data inside the project with `DATABASE_PATH=./data/servitor.db` and `UPLOADS_DIR=./data/uploads`. [Development](docs/development.md) explains the project structure, the commands, the tests and the migrations, and [CONTRIBUTING.md](CONTRIBUTING.md) describes how to propose changes.

## Security

Please report vulnerabilities privately as described in [SECURITY.md](SECURITY.md), not in public issues. [Security](docs/security.md) summarizes the protections, and [the security review](docs/SECURITY-REVIEW.md) checks every level 1 and 2 requirement of OWASP ASVS 5.0.

## License

Servitor CMS is licensed under the [Apache License 2.0](LICENSE). Derivative works must preserve the [NOTICE](NOTICE) file, which also credits the third-party material included in this repository.
