# Servitor CMS

Servitor CMS is an open-source, self-hostable CMS for blog posts and articles.

> Servitor CMS is under active development and not ready for production use.

## Features

- Write posts in multiple content languages from a single editing screen.
- Let trusted writers publish directly while other authors submit their changes to a review queue. Publications can be scheduled, and staff can hide posts with a reason the owner can read.
- Share posts through the built-in public reading pages, or pull them into other applications through a read-only REST API authenticated with API keys.
- Notify external systems, such as a static site that needs to rebuild, through webhooks when published content changes.
- Deploy the whole application with a single `docker-compose.yml`.

## Quick start

The Docker quick start will be documented once the container setup is complete.

### Local development

Requirements: Node.js 24 (current LTS).

1. Install the dependencies:

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env` and fill it in. For local development, use `ORIGIN=http://localhost:5173` and keep the data inside the project, for example `DATABASE_PATH=./data/servitor.db` and `UPLOADS_DIR=./data/uploads`. The `data/` folder is git-ignored.

3. Start the development server:

   ```bash
   npm run dev
   ```

## Reverse proxy and Coolify

Servitor CMS is designed to run behind a TLS-terminating reverse proxy. The setup notes will follow together with the deployment files.

## Configuration

Servitor CMS is configured through environment variables, which are validated on every start. The application refuses to start when a required variable is missing or a provided value is invalid. `.env.example` is a commented template.

| Variable                                                                           | Required       | Default             | Notes                                                                                                   |
| ---------------------------------------------------------------------------------- | -------------- | ------------------- | ------------------------------------------------------------------------------------------------------- |
| `ORIGIN`                                                                           | Yes            |                     | Public URL, for example `https://cms.example.com`. Also used as the Better Auth base URL.               |
| `BETTER_AUTH_SECRET`                                                               | Yes            |                     | At least 32 random characters.                                                                          |
| `DATABASE_PATH`                                                                    | No             | `/data/servitor.db` | SQLite database file.                                                                                   |
| `UPLOADS_DIR`                                                                      | No             | `/data/uploads`     | Uploaded media.                                                                                         |
| `FOUNDER_EMAIL`                                                                    | First start    |                     | Used only to create the founder account.                                                                |
| `FOUNDER_NAME`                                                                     | First start    |                     | Used only to create the founder account.                                                                |
| `FOUNDER_PASSWORD`                                                                 | First start    |                     | Used only to create the founder account. Must pass the password policy.                                 |
| `DEFAULT_CONTENT_LANGUAGE`                                                         | No             | `en`                | Initial default content language, used only on the first start.                                         |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_SECURE` | No             |                     | Enables email when all are set. A partial set keeps email off and logs a warning.                       |
| `WEBHOOK_ALLOW_PRIVATE`                                                            | No             | `false`             | Allows webhooks to private network targets.                                                             |
| `ADDRESS_HEADER`, `XFF_DEPTH`                                                      | Behind a proxy |                     | Client IP detection for rate limiting.                                                                  |
| `BODY_SIZE_LIMIT`                                                                  | No             | `512K`              | Largest accepted request body (adapter-node). Set it to `12M` or more so that 10 MB image uploads work. |
| `LOG_LEVEL`                                                                        | No             | `info`              | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`.                                         |

## First sign-in and founder recovery

On the first start, Servitor CMS creates the founder account from `FOUNDER_EMAIL`, `FOUNDER_NAME` and `FOUNDER_PASSWORD`. Sign in at `/panel/login`. Before anything else, the panel asks the founder to replace the seeded password. Once the founder exists, the `FOUNDER_*` variables are ignored.

If the founder loses access, run the recovery command inside the container:

```bash
docker compose exec servitor node build/cli.js reset-founder
```

The command prints a temporary password once, requires a new password at the next sign-in, turns off the founder's two-factor authentication, signs the founder out of every session and writes an audit log entry. There is deliberately no environment variable for this, so a restart can never reset the founder by accident.

## API usage

The read-only REST API will be documented once it is implemented.

## Webhook signature verification

Webhook signature verification will be documented once webhooks are implemented.

## Backups and restore

Backups and restore will be documented once the command line tools are implemented.

## Security notes

- Public sign-up does not exist. Accounts come only from the founder seed and, later, from invitations.
- Passwords must be 12 to 128 characters long and must not appear in the bundled list of the 10,000 most common passwords from [SecLists](https://github.com/danielmiessler/SecLists). There are no composition rules.
- Sign-in attempts are limited per client IP address (3 attempts in 10 seconds) and per account (10 failures within 15 minutes pause sign-in for that account for 15 minutes). The pause is temporary on purpose, so an attacker cannot lock a user out for good. Lockouts and failed sign-ins are written to the audit log.
- Sign-in answers are identical for unknown accounts and wrong passwords.
- Two-factor authentication uses TOTP authenticator apps. Every user gets 10 single-use backup codes, which are stored only as keyed hashes. A system setting can require two-factor authentication for the founder and admins.
- Session cookies are `HttpOnly`, `SameSite=Lax`, host-only and `Secure` when `ORIGIN` uses `https`. Sessions expire after 7 days without activity. Users can review and sign out their sessions in the panel, and changing the password or turning off two-factor authentication signs out the other sessions.
- Sensitive account changes ask for the current password again, plus a current authenticator code when two-factor authentication is on.
- Rate limits and lockouts live in memory, and scheduled publications are handled by a job inside the application process that runs every minute, so Servitor CMS supports a single running instance.
- Post content is stored as editor JSON. Every save validates it against an allowlist of blocks, marks and attributes, renders it to HTML on the server and runs the HTML through an allowlist sanitizer before storing it. Links may only use `http`, `https`, `mailto` or relative addresses, images must come from the media library, and videos can only be embedded from `youtube-nocookie.com` and `player.vimeo.com` with a fixed sandbox. Math is rendered with KaTeX with trusted commands turned off.
- Image uploads are recognised by their content, never by the file name or the browser-supplied type. JPEG, PNG, WebP, GIF and AVIF are accepted; SVG is rejected. Files may be at most 10 MB and 40 megapixels. Every image is re-encoded to WebP, and metadata such as EXIF and GPS data is removed.
- Media addresses are public and hard to guess. Anyone who knows the address of an image can open it, even when the image is only used in an unpublished draft. Do not upload images that must stay private.

Further security notes will be added as the remaining features are implemented.

## License

Servitor CMS is licensed under the [Apache License 2.0](LICENSE). Derivative works must preserve the [NOTICE](NOTICE) file.
