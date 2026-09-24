# Servitor CMS

Servitor CMS is an open-source, self-hostable CMS for blog posts and articles.

## Features

- Write posts in multiple content languages from a single editing screen.
- Let trusted writers publish directly while other authors submit their changes to a review queue. Publications can be scheduled, and staff can hide posts with a reason the owner can read.
- Share posts through the built-in public reading pages, or pull them into other applications through a read-only REST API authenticated with API keys.
- Notify external systems, such as a static site that needs to rebuild, through webhooks when published content changes.
- Deploy the whole application with a single `docker-compose.yml`.

## Quick start

Requirements: Docker with Docker Compose.

1. Copy `.env.example` to `.env` and fill in at least `ORIGIN`, `BETTER_AUTH_SECRET` (for example `openssl rand -hex 32`) and the `FOUNDER_*` variables. Keep `DATABASE_PATH` and `UPLOADS_DIR` under `/data`. When you try Servitor CMS without a reverse proxy, set `ORIGIN=http://localhost:3000` and remove the `ADDRESS_HEADER` and `XFF_DEPTH` lines.

2. Build and start the container:

   ```bash
   docker compose up -d --build
   ```

3. Open `/panel/login` on your `ORIGIN` and sign in as the founder. The panel asks for a new password first.

The container listens on `127.0.0.1:3000`, keeps all data in the `servitor-data` volume mounted at `/data`, runs as a non-root user with a read-only root filesystem, and applies pending database migrations on every start before it accepts requests. `GET /healthz` reports whether the database is reachable and is used by the Compose health check. The image starts `node build/server.js`, a small wrapper around the SvelteKit handler that adds the baseline security headers to every response, static files included, and refuses `TRACE`, `TRACK` and `CONNECT`. A CycloneDX software bill of materials of the production dependencies is included at `/app/sbom.cdx.json`; `npm run --silent sbom` prints the same list for a checkout.

Servitor CMS runs as a single instance: rate limits, lockouts, the publishing scheduler and the webhook worker live inside the application process. Do not start more than one container on the same data.

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

Run Servitor CMS behind a reverse proxy that terminates TLS, such as Caddy, Nginx, Traefik or Coolify, and forward requests to port 3000 of the container.

- Set `ORIGIN` to the public `https` address. Form submissions from other origins are rejected, and session cookies are marked `Secure` when `ORIGIN` uses `https`.
- Keep `ADDRESS_HEADER=x-forwarded-for` and set `XFF_DEPTH` to the number of proxies in front of the app, so that rate limits and the audit log see the real client address. Make sure the app is only reachable through the proxy; otherwise clients could forge the header.
- Serve only TLS 1.2 and 1.3 with a publicly trusted certificate, as Caddy, Traefik and Coolify do by default. Redirect plain `http` requests for pages to `https`, but do not redirect `/api/`: answer those with an error, so that a client configured with an `http` address fails instead of sending its API key in clear text first.
- With Caddy, a site block such as `cms.example.com { reverse_proxy 127.0.0.1:3000 }` is enough.
- With Coolify, create a Docker Compose resource from this repository, add the variables from `.env.example` in the resource's environment settings, assign the domain to the `servitor` service on port 3000 and keep the `servitor-data` volume. Coolify's proxy is a single hop, so `XFF_DEPTH=1` fits.

## Configuration

Servitor CMS is configured through environment variables, which are validated on every start. The application refuses to start when a required variable is missing or a provided value is invalid. `.env.example` is a commented template.

The secrets `BETTER_AUTH_SECRET`, `BETTER_AUTH_PREVIOUS_SECRETS`, `SMTP_PASSWORD` and `FOUNDER_PASSWORD` can also be read from files, so that they can come from Docker secrets or another secret store instead of the environment: set, for example, `BETTER_AUTH_SECRET_FILE=/run/secrets/auth_secret`. A trailing newline in the file is ignored, and setting both a variable and its `_FILE` variant is an error.

| Variable                                                                           | Required       | Default             | Notes                                                                                                   |
| ---------------------------------------------------------------------------------- | -------------- | ------------------- | ------------------------------------------------------------------------------------------------------- |
| `ORIGIN`                                                                           | Yes            |                     | Public URL, for example `https://cms.example.com`. Also used as the Better Auth base URL.               |
| `BETTER_AUTH_SECRET`                                                               | Yes            |                     | At least 32 random characters.                                                                          |
| `BETTER_AUTH_PREVIOUS_SECRETS`                                                     | No             |                     | Retired secrets, separated by commas, that can still decrypt stored data after a rotation.              |
| `DATABASE_PATH`                                                                    | No             | `/data/servitor.db` | SQLite database file.                                                                                   |
| `UPLOADS_DIR`                                                                      | No             | `/data/uploads`     | Uploaded media.                                                                                         |
| `FOUNDER_EMAIL`                                                                    | First start    |                     | Used only to create the founder account.                                                                |
| `FOUNDER_NAME`                                                                     | First start    |                     | Used only to create the founder account.                                                                |
| `FOUNDER_PASSWORD`                                                                 | First start    |                     | Used only to create the founder account. Must pass the password policy.                                 |
| `DEFAULT_CONTENT_LANGUAGE`                                                         | No             | `en`                | Initial default content language, used only on the first start.                                         |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_SECURE` | No             |                     | Enables email when all are set. A partial set keeps email off and logs a warning.                       |
| `WEBHOOK_ALLOW_PRIVATE`                                                            | No             | `false`             | Allows webhooks to private network targets, including plain `http` to them.                             |
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

To end sessions without waiting for them to expire, for example after a suspected compromise, run `sign-out` with an email address for one user, or without one for everybody. Deactivating a user in the panel also ends all of that user's sessions.

```bash
docker compose exec servitor node build/cli.js sign-out ada@example.com
```

### Rotating the secret

`BETTER_AUTH_SECRET` signs the session cookies and encrypts the stored two-factor secrets and webhook secrets. To replace it, for example once a year or right away when it may have leaked:

1. Stop the app and move the current value to `BETTER_AUTH_PREVIOUS_SECRETS`.
2. Set a new random `BETTER_AUTH_SECRET` and start the app. On start, every stored secret is decrypted with the key it was sealed with and encrypted again with the new one; the log reports how many were updated and warns about any that no configured key can open.
3. Remove the old value from `BETTER_AUTH_PREVIOUS_SECRETS`.

Everybody is signed out, because session cookies are signed with the current secret. Two-factor authentication, backup codes and webhook secrets keep working.

## Email

Email is optional. It turns on when all six `SMTP_*` variables are set; `SMTP_SECURE=true` uses TLS from the start (usually port 465), otherwise the connection must be upgraded with STARTTLS (usually port 587). Certificates are verified, TLS 1.2 is the minimum, and a plain connection is only allowed to a relay on the same machine, such as `localhost`. Messages are plain text with a simple HTML part, in the recipient's panel language.

| Situation                  | With SMTP                                                                                                           | Without SMTP                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Inviting a user            | The invitation link is emailed and also shown once in the panel.                                                    | The panel shows a one-time invitation link to share.                         |
| Forgotten password         | Users request a link on the sign-in page; staff can also send one.                                                  | Staff create a one-time reset link in the panel (founder for admins).        |
| Changing the email address | A confirmation link goes to the new address; the change applies after it is opened and the old address is notified. | The change applies immediately after the user confirms it with the password. |
| Sign-in from a new device  | The user gets a notification with the browser, operating system, IP address and time.                               | No notification.                                                             |

Password reset requests always get the same answer, whether or not an account exists, and are limited per client and per address.

## Public reading site

The built-in reading pages live under `/blog`:

- `/blog/{language}` lists the published posts of a content language, ten per page.
- `/blog/{language}/{slug}` shows a post, with links to its other published translations.
- `/blog/{language}/category/{slug}` and `/blog/{language}/tag/{slug}` list posts by category and tag.
- `/blog/{language}/rss.xml` is the RSS feed of a language, `/sitemap.xml` is the sitemap index with one sitemap per language, and `/robots.txt` points crawlers to it.

The root address redirects to the default language. Pages carry a canonical address, `hreflang` alternates with an `x-default` entry for the default language, Open Graph and Twitter card tags, and JSON-LD `Article` data. The page interface follows the content language when it is one of the panel languages and falls back to English otherwise.

A translation is public only when the post is not hidden by a moderator, the translation is published with a live revision, and its language is enabled. Drafts and submissions can be previewed from the editor and the review screen at `/panel/preview/...`, which requires a signed-in user who may view the post.

Turning off the public site in the system settings switches Servitor CMS to headless mode: every public route answers with 404, `robots.txt` disallows crawling, and the root address opens the panel.

## API usage

The read-only REST API lives under `/api/v1` and only returns publicly visible content. Create a key in the panel under **Integrations → API keys** (founder and admins, after confirming the password). The full key is shown once; only its SHA-256 hash and a short prefix are stored. A key can be limited to some languages and categories, can expire, and can have its own rate limit.

Send the key as a bearer token. Keys in the query string are rejected, and the API never uses cookies.

```bash
curl -H "Authorization: Bearer svt_…" "https://cms.example.com/api/v1/posts?lang=en&per_page=10"
```

| Endpoint                                  | Returns                                            |
| ----------------------------------------- | -------------------------------------------------- |
| `GET /api/v1/posts`                       | Posts with their published translations            |
| `GET /api/v1/posts/{id}`                  | One post with all its published translations       |
| `GET /api/v1/posts/by-slug/{lang}/{slug}` | The same, looked up by a translation slug          |
| `GET /api/v1/languages`                   | Enabled content languages                          |
| `GET /api/v1/categories`                  | Categories with their names and slugs per language |
| `GET /api/v1/tags?lang=`                  | The tags of a language with their post counts      |
| `GET /api/v1/authors`                     | Public author profiles: ID, name, bio and avatar   |

`GET /api/v1/posts` accepts `lang` (repeat it or separate codes with commas), `category`, `tag` and `author` (IDs), `q` (full-text search over title, excerpt and content), `published_from` and `published_to`, `sort` (`published_at` or `updated_at`), `order` (`asc` or `desc`), `page`, `per_page` (up to 100), `fallback=default` (return the default-language translation of posts that have none in the requested languages) and `content_format` (`html`, `json` or `both`). Unknown parameters and invalid values are answered with `400`.

List responses contain `data` and `meta` (`page`, `per_page`, `total`, `total_pages`). Media fields carry absolute URLs for every size and the alternative text per language. Errors always look like `{"error": {"code": "…", "message": "…"}}`. Responses carry `ETag` and `Last-Modified` and answer conditional requests with `304`. Every key has a per-minute limit (default 120, changeable in the system settings or per key); responses carry `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset`, and a `429` response includes `Retry-After`.

Browsers can call the API only from origins on the allowlist under **Integrations → CORS**. Origins are matched exactly by scheme, host and port, wildcards are not accepted, and credentials are never allowed.

The OpenAPI 3.1 description is served at `/api/v1/openapi.json`.

## Webhooks

Add webhooks under **Integrations → Webhooks** (founder and admins). Each webhook has an https URL, the events it wants and a signing secret that is generated on the server and shown only once; rotating it shows the new secret once and invalidates the old one immediately. Both steps need the current password.

| Event              | Sent when                                                      |
| ------------------ | -------------------------------------------------------------- |
| `post.published`   | A translation went live for the first time or was re-published |
| `post.updated`     | The live revision of a published translation changed           |
| `post.unpublished` | A translation was unpublished                                  |
| `post.hidden`      | A moderator hid a post                                         |
| `post.unhidden`    | A moderator made a post visible again                          |
| `post.deleted`     | A post was deleted                                             |

Each delivery is a `POST` with a JSON body that never contains content. Fetch the content through the API when you need it:

```json
{
  "event": "post.published",
  "delivery_id": "0f6c…",
  "timestamp": "2026-09-24T12:00:00.000Z",
  "post_id": "8b1d…",
  "languages": ["en", "de"],
  "slugs": { "en": "hello-world", "de": "hallo-welt" }
}
```

Deliveries are queued in the database and sent by a worker inside the application, so they survive restarts. A request times out after 10 seconds, redirects are not followed, and anything other than a `2xx` answer is retried up to five times with exponential backoff (30 seconds, then 1, 2, 4 and 8 minutes). The last 30 days of deliveries, with status codes, durations and errors, are visible on the webhook page.

Before connecting, Servitor resolves the host name and refuses loopback, private, link-local (including `169.254.169.254`), carrier-grade NAT, multicast and reserved addresses for IPv4 and IPv6. It then connects to the address it checked, so DNS rebinding cannot redirect the request. Set `WEBHOOK_ALLOW_PRIVATE=true` to allow targets in private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `100.64.0.0/10`, `fc00::/7`), including plain `http` to such targets; loopback, link-local and reserved addresses stay blocked.

### Webhook signature verification

Every request carries `X-Servitor-Event`, `X-Servitor-Delivery` and `X-Servitor-Signature: t=<unix seconds>,v1=<hex>`, where `v1` is the HMAC-SHA256 of `<t>.<raw body>` computed with the webhook secret. Verify the signature against the raw body before parsing it, compare in constant time, and reject timestamps older than five minutes so that captured requests cannot be replayed:

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

export function isValidServitorRequest(rawBody, header, secret, now = Date.now()) {
  const match = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header ?? '');

  if (!match) {
    return false;
  }

  const timestamp = Number(match[1]);

  if (Math.abs(now / 1000 - timestamp) > 300) {
    return false;
  }

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest();
  const received = Buffer.from(match[2], 'hex');

  return received.length === expected.length && timingSafeEqual(received, expected);
}
```

Webhook secrets are stored encrypted with AES-256-GCM under a key derived from `BETTER_AUTH_SECRET`; see [Rotating the secret](#rotating-the-secret) for changing it.

## Backups and restore

Backups are made with the command line inside the container; there is no download in the panel.

```bash
docker compose exec servitor node build/cli.js backup
```

The command writes `/data/backups/servitor-backup-<time>.tar.gz`, containing a consistent snapshot of the SQLite database taken with SQLite's online backup API, the uploaded media and a small manifest. Copy the file somewhere outside the server, for example with `docker compose cp servitor:/data/backups/<file> .`.

To restore a backup:

1. Put the archive into the volume, for example `docker compose cp ./servitor-backup-<time>.tar.gz servitor:/data/backups/`.
2. Stop the app: `docker compose stop servitor`.
3. Run the restore in a one-off container:

   ```bash
   docker compose run --rm servitor node build/cli.js restore /data/backups/servitor-backup-<time>.tar.gz
   ```

   The archive is checked first (only the expected files, no path tricks, at most 500,000 entries and no more unpacked data than the free space of the volume, a readable database that passes SQLite's integrity check). The current database and uploads are moved to `/data/.pre-restore-<time>` rather than deleted.

4. Start the app again with `docker compose up -d`. Migrations that are newer than the backup run automatically.

The restore refuses to run while the app is running. If a crash left the app's heartbeat file behind, wait a minute or add `--force`.

## Security notes

The full review against the OWASP Application Security Verification Standard 5.0 (levels 1 and 2) is in [docs/SECURITY-REVIEW.md](docs/SECURITY-REVIEW.md). How to report a vulnerability, and how quickly vulnerable dependencies are updated, is described in [SECURITY.md](SECURITY.md).

- Public sign-up does not exist. Accounts come only from the founder seed and, later, from invitations.
- Passwords must be 12 to 128 characters long. They must not appear in the bundled lists of common passwords from [SecLists](https://github.com/danielmiessler/SecLists): the 10,000 most common passwords and the 43,940 passwords of 12 to 128 characters from its list of the million most common, breach-derived passwords. The product and role names (`servitor`, `founder`, `admin`, `administrator`, `author`, `password`), the site name, the host name and the user's own name and email address do not count toward the minimum length, including common look-alike spellings such as `S3rv1t0r`. There are no composition rules.
- Passwords are hashed with scrypt (N = 2^15, r = 8, p = 3) in a self-describing format. Hashes made with older parameters are upgraded after the next successful sign-in.
- Sign-in attempts are limited per client IP address (3 attempts in 10 seconds) and per account (10 failures within 15 minutes pause sign-in for that account for 15 minutes). The pause is temporary on purpose, so an attacker cannot lock a user out for good. Lockouts and failed sign-ins are written to the audit log.
- Sign-in answers are identical for unknown accounts and wrong passwords.
- Two-factor authentication uses TOTP authenticator apps, and every code works only once. Every user gets 10 single-use backup codes of 24 random characters (120 bits), stored only as SHA-256 hashes. A system setting can require two-factor authentication for the founder and admins.
- Session cookies are `HttpOnly`, `SameSite=Lax` and host-only. With an `https` `ORIGIN` they are `Secure` and use the `__Host-` prefix, so no other host, not even a subdomain, can set them. Sessions end after 7 days without activity and 30 days after the sign-in at the latest. Users can review their sessions in the panel and sign them out after confirming the password; changing the password or turning off two-factor authentication signs out the other sessions, and signing out asks the browser to clear cached data.
- Sensitive account changes ask for the current password again, plus a current authenticator code when two-factor authentication is on.
- Rate limits and lockouts live in memory, and scheduled publications and webhook deliveries are handled by jobs inside the application process, so Servitor CMS supports a single running instance. Each user can upload at most 30 files per minute.
- Post content is stored as editor JSON. Every save validates it against an allowlist of blocks, marks and attributes, renders it to HTML on the server and runs the HTML through an allowlist sanitizer before storing it. Links may only use `http`, `https`, `mailto` or relative addresses, images must come from the media library, and videos can only be embedded from `youtube-nocookie.com` and `player.vimeo.com` with a fixed sandbox. Math is rendered with KaTeX with trusted commands turned off.
- Image uploads are recognised by their content, never by the file name or the browser-supplied type. JPEG, PNG, WebP, GIF and AVIF are accepted; SVG is rejected. Files may be at most 10 MB and 40 megapixels. Every image is re-encoded to WebP, and metadata such as EXIF and GPS data is removed; the original file is never served.
- API keys are compared in constant time against their stored SHA-256 hashes, and revoking a key takes effect on the next request. Creating and revoking keys needs the current password and is written to the audit log.
- Public reading pages are rendered on the server and ship without JavaScript. Structured data is escaped so it cannot break out of its script element.
- Every response carries `X-Content-Type-Options: nosniff`, a referrer policy, `Strict-Transport-Security` in production and a Content Security Policy with `frame-ancestors 'none'`, `object-src 'none'` and `base-uri 'none'`. Pages that carry a one-time link in their address never send it to other sites as a referrer.
- Media addresses are public and hard to guess. Anyone who knows the address of an image can open it, even when the image is only used in an unpublished draft. Do not upload images that must stay private.
- Logs are JSON lines on standard output with secrets redacted. Besides errors they contain every audit log entry and security events such as refused permissions, rate limits, rejected API keys, refused CORS origins, reused authenticator codes and blocked webhook targets. Ship them to a separate log system if you need them to survive a compromise of the server.

## License

Servitor CMS is licensed under the [Apache License 2.0](LICENSE). Derivative works must preserve the [NOTICE](NOTICE) file.
