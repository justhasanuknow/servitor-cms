# Servitor CMS documentation

Servitor CMS is an open-source, self-hosted content management system for blog posts and articles. It runs as a single container with an embedded SQLite database, offers an editing panel in six languages, publishes posts in as many content languages as you need, and shares them through built-in reading pages, a read-only REST API and webhooks.

This documentation is available in two places: in the `docs` folder of the repository, and inside every installation at `/docs`. Inside an installation, everybody can read it while the public reading site is on; when the site runs headless, only signed-in users can.

## Getting started

- [Concepts](getting-started.md) explains roles, content languages, posts and translations, and how publishing works.
- [Installation](installation.md) takes you from an empty server to the first sign-in with Docker Compose.
- [Configuration](configuration.md) lists every environment variable.

## Deployment and operations

- [Deployment](deployment.md) covers the reverse proxy, TLS, client addresses, updates and logs in production.
- [Operations](operations.md) describes backups and restores, founder recovery, ending sessions and rotating secrets.
- [Email](email.md) explains the optional SMTP setup and every email Servitor sends.

## Using the panel

- [The panel and your account](panel.md): signing in, profile, panel language, theme, password, two-factor authentication and sessions.
- [Users and roles](users.md): the permission model, invitations and user management.
- [Writing posts](posts.md): the editor, translations, revisions, previews and search fields.
- [Publishing](publishing.md): publishing, scheduling, reviews, unpublishing and moderation.
- [Media](media.md): the media library, alternative texts and upload limits.
- [Languages and categories](languages-and-categories.md): content languages, categories and tags.
- [Settings and audit log](settings.md): system settings and the audit log.
- [Public site](public-site.md): the reading pages, feeds, sitemaps and headless mode.

## Integrations

- [REST API](api.md): API keys, endpoints, parameters, caching, rate limits and CORS.
- [Webhooks](webhooks.md): events, payloads, signature verification and retries.

## Reference

- [Security](security.md) summarizes how Servitor protects accounts, content and data.
- [Security review](SECURITY-REVIEW.md) is the complete review against OWASP ASVS 5.0.
- [Troubleshooting](troubleshooting.md) collects common problems and their fixes.
- [Development](development.md) is for people who want to change Servitor itself.
