# Security Review

This review checks Servitor CMS against the [OWASP Application Security Verification Standard (ASVS) 5.0.0](https://owasp.org/www-project-application-security-verification-standard/), levels 1 and 2, and against the security requirements of the project specification. It was completed on 24 September 2026.

Every one of the 253 level 1 and level 2 requirements is listed in [Requirement results](#requirement-results) with one of three results:

- **Pass**: the application met the requirement before the review.
- **Fixed**: the review found a gap, it was closed with code or documentation and, for code, covered by tests.
- **Not applicable**: the requirement concerns a technology or feature that Servitor CMS does not have; the reason is given.

No finding is open.

| Result         | Level 1 | Level 2 | Total   |
| -------------- | ------- | ------- | ------- |
| Pass           | 49      | 81      | 130     |
| Fixed          | 10      | 38      | 48      |
| Not applicable | 11      | 64      | 75      |
| **Total**      | **70**  | **183** | **253** |

## Findings fixed in this review

Cookies and headers:

1. Session and preference cookies use the `__Host-` prefix over `https`. Better Auth only supports `__Secure-`, so its cookies are renamed on the way to the browser and back, and auth cookies without the prefix are ignored (V3.3.1, V3.3.3).
2. Static build files are served before SvelteKit hooks run and missed the security headers. The image now starts `build/server.js`, which adds `nosniff`, HSTS, the referrer policy and a restrictive Content Security Policy to every response and refuses `TRACE`, `TRACK` and `CONNECT` (V3.4.1, V3.4.3, V3.4.4, V3.4.6, V13.4.4).
3. The page policy used `base-uri 'self'`; it is now `base-uri 'none'` (V3.4.3).
4. Text and XML responses declare `charset=utf-8` (V4.1.1).
5. Media responses carry `Content-Disposition` with a generated file name (V5.4.1, V5.4.2).
6. Pages with a one-time token in their address send `Referrer-Policy: same-origin`, so the address never reaches other sites (V14.2.1). The first fix used `no-referrer`, but with that policy browsers send `Origin: null` for forms submitted before the page's scripts have loaded, and the cross-site form check rejected them; `same-origin` keeps the token private without breaking those forms, which an end-to-end test now covers with JavaScript turned off.
7. Signing out sends `Clear-Site-Data: "cache", "storage"` (V14.3.1).

Authentication and sessions:

1. The common-password list contained only 10 entries long enough for the 12-character rule. The 43,940 passwords of 12 to 128 characters from SecLists' list of the million most common passwords are now checked as well (V6.2.4, V6.2.12).
2. Passwords may not lean on context-specific words (V6.1.2, V6.2.11).
3. Password hashing moved from Better Auth's default scrypt cost to OWASP's current guidance, in a self-describing format with transparent upgrades (V11.4.2, V11.2.2).
4. Backup codes have 120 bits instead of about 60 (V6.5.2).
5. A TOTP code can be used only once (V6.5.1).
6. Sessions end 30 days after the sign-in at the latest (V7.3.2).
7. Ending one's own sessions requires the password and, with two-factor authentication, a code (V7.5.2).
8. The `sign-out` command ends the sessions of one user or of everybody (V7.4.5).

Secrets, communication and operations:

1. `BETTER_AUTH_SECRET` can be rotated without losing two-factor or webhook secrets: `BETTER_AUTH_PREVIOUS_SECRETS` keeps old keys readable, stored secrets carry a key version, and the app encrypts them again with the current key on start (V11.2.2).
2. Secrets can be read from files (`*_FILE`), for example Docker secrets (V13.3.1).
3. SMTP requires TLS unless the relay runs on the same machine (V12.3.1).
4. Restores refuse archives with too many entries or more data than fits on the volume before unpacking (V5.2.3).
5. Uploads are rate limited per user (V2.4.1).
6. Refused permissions, rate limits, rejected API credentials, refused CORS preflights, reused TOTP codes, failed re-authentication and blocked webhook targets are logged as security events, and audit entries are also written to standard output (V16.3.2, V16.3.3, V16.4.3).
7. `npm audit` findings in `cookie` and a development-only `esbuild` were fixed with overrides; a CycloneDX SBOM ships in the image; remediation time frames are documented in SECURITY.md; `eqeqeq` is enforced (V15.1.1, V15.1.2, V15.2.1, V15.3.5).
8. The documentation that ASVS asks for is in the sections below (V2.1, V5.1, V6.1, V7.1, V8.1, V11.1, V13.1, V14.1, V15.1, V16.1).

Two documentation defects found along the way were corrected as well: the webhook verification example in the README had lost the `\d` of its regular expression, and the README described the email transport as opportunistic TLS.

## Authentication

| Pathway                           | Users                       | Factors                                                                          | Controls                                                                                                                                                                                                                                                                 |
| --------------------------------- | --------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Panel sign-in at `/panel/login`   | Founder, admins, authors    | Password, then a TOTP code or a backup code when two-factor authentication is on | 3 attempts per 10 seconds and client address; after 10 failures within 15 minutes the account is paused for 15 minutes; Better Auth allows 5 attempts per challenge and locks the second factor for 15 minutes after 10 failures; identical answers for unknown accounts |
| Confirmation of sensitive actions | Signed-in users             | Password, plus a current TOTP code when two-factor authentication is on          | 3 attempts per 10 seconds per user and per address; failures are logged; codes are single-use                                                                                                                                                                            |
| Read-only API at `/api/v1`        | Other applications          | API key of 32 random bytes in the `Authorization` header                         | Only public content; per-key rate limit, language and category scopes, optional expiry, immediate revocation                                                                                                                                                             |
| Command line inside the container | Operators with shell access | Access to the server                                                             | Not reachable over the network; `reset-founder` and `sign-out` write audit entries                                                                                                                                                                                       |

Accounts come only from the founder seed and from invitations. Account recovery uses one-time links: invitations are valid for 72 hours, password resets for 30 minutes and email changes for 24 hours. Links contain 32 random bytes, are stored as SHA-256 hashes, are consumed atomically and are invalidated when a newer link of the same kind is issued. A password reset never signs the user in and never turns off two-factor authentication. A user who has lost the authenticator and the backup codes cannot recover alone: the founder is recovered by an operator with `reset-founder`, other users are onboarded again by staff.

The account lockout is temporary on purpose. A permanent lock would let anybody who knows an email address lock that user out; the rate limit per client address and the pause per account together keep online guessing far below any useful rate.

Password policy:

- 12 to 128 characters, no composition rules, no expiry. Paste and password managers work.
- Rejected when found in the bundled lists: the 10,000 most common passwords and the 43,940 passwords of 12 to 128 characters from SecLists' list of the million most common, breach-derived passwords. The comparison ignores letter case.
- Context-specific words do not count toward the minimum length. After removing them, at least 12 characters must remain. The words are:
  - product and role names: `servitor`, `founder`, `admin`, `administrator`, `author`, `password`;
  - the site name from the system settings;
  - the host name of `ORIGIN`;
  - the user's display name and email address.

  Names, addresses and host names are used as a whole, joined without separators, and split into their parts; parts shorter than four characters are ignored. The comparison ignores letter case, applies Unicode NFKC normalization and treats the look-alike characters `0 1 3 4 5 7 @ $` as `o i e a s t a s`.

- Passwords are normalized with NFKC and hashed with scrypt (N = 2^15, r = 8, p = 3, 16-byte salt, 64-byte key).

Two-factor authentication uses RFC 6238 TOTP (HMAC-SHA1, six digits, 30-second steps, one step of tolerance for clock drift). An accepted code is remembered for two minutes per user and refused when it is presented again. Every user also gets 10 backup codes of 24 base32 characters, stored as SHA-256 hashes and deleted when used.

Multi-factor authentication (V6.3.3). The specification keeps two-factor authentication optional for all users and lets the founder require it for the founder and admins. ASVS level 2 expects multi-factor authentication for access, so this relaxation needs a rationale and compensating controls:

- Authors can only change their own content and, unless the founder or an admin allows it, cannot publish without review. Every account that can manage users, keys, webhooks or settings can be forced into two-factor enrollment with one setting, which is recommended for every installation.
- The password policy rejects short, common, breached and context-based passwords.
- Online guessing is limited by the rate limits and the account pause described above.
- A sign-in from a new device triggers an email to the account owner.
- Every sensitive change asks for the password again, and for a code when two-factor authentication is on.
- Sessions are short-lived enough to limit a stolen session (see [Sessions](#sessions)), users can see and end their sessions, and every sign-in and failure is in the audit log.

## Sessions

- Sessions are Better Auth reference tokens of 32 random characters (about 190 bits), looked up in the database on every request. The cookie cache is off.
- Over `https`, the cookie is `__Host-servitor.session_token`: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no `Domain`.
- Inactivity timeout: 7 days. Activity extends the session at most once a day.
- Absolute lifetime: 30 days after the sign-in, regardless of activity.
- Concurrent sessions are not limited, because editors often work from several devices. Users see every session with device, address and last activity, can end one or all others after confirming the password, and get an email when a new device signs in.
- Sessions end on sign-out, when the password is changed or reset (other sessions), when two-factor authentication is turned off (other sessions), on a role change, on deactivation, after the absolute lifetime, with the `sign-out` command and when `BETTER_AUTH_SECRET` is rotated.

Deviation from NIST SP 800-63B (V7.1.1): for AAL2, NIST asks for re-authentication after a short period of inactivity and at least every 12 to 24 hours, depending on the revision. Servitor keeps editors signed in for up to 7 idle days and 30 days overall, the AAL1 limit, because working on long articles across days is the main use case. Every change that could take over or weaken an account, or change who can do what, asks for fresh authentication instead, and the controls in [Authentication](#authentication) apply.

## Authorization

All permission logic lives in `src/lib/server/permissions`, and every load function, form action and endpoint that touches protected data calls it. A table-driven test covers every cell of this matrix, including the refused cases. "Own" means the resource belongs to the acting user.

| Action                                                    | Founder | Admin | Author                      |
| --------------------------------------------------------- | ------- | ----- | --------------------------- |
| Create admins; deactivate or reactivate admins            | Yes     | No    | No                          |
| Create authors; deactivate or reactivate authors          | Yes     | Yes   | No                          |
| Change a user's role between author and admin             | Yes     | No    | No                          |
| Grant or revoke direct publishing for authors             | Yes     | Yes   | No                          |
| Create a password reset link for an author                | Yes     | Yes   | No                          |
| Create a password reset link for an admin                 | Yes     | No    | No                          |
| View the user list                                        | Yes     | Yes   | No                          |
| Create, edit and delete own posts                         | Yes     | Yes   | Yes                         |
| Edit or delete another user's post content                | No      | No    | No                          |
| Publish own posts without review                          | Yes     | Yes   | Only with direct publishing |
| Approve or reject author submissions                      | Yes     | Yes   | No                          |
| Hide or unhide an author's post                           | Yes     | Yes   | No                          |
| Hide or unhide an admin's post                            | Yes     | No    | No                          |
| Manage languages, categories, API keys, webhooks and CORS | Yes     | Yes   | No                          |
| View the audit log                                        | Yes     | Yes   | No                          |
| Change system settings                                    | Yes     | No    | No                          |
| Upload media; edit and delete own unused media            | Yes     | Yes   | Yes                         |
| Manage own profile, password, two-factor, theme, language | Yes     | Yes   | Yes                         |

Data and field-level rules (V8.1.2):

- Ownership is always checked against the database. Staff can view, review and moderate posts of the roles they manage, but never change their content.
- Nobody acts on their own account through staff actions (no self-deactivation or self-promotion). The founder role cannot be assigned, removed or deactivated; database triggers enforce this as well.
- Role, direct publishing, ownership, moderation state, reviewer and timestamps are set only by the actions meant for them, never from content forms.
- Media can only be inserted, edited and deleted by its owner, and only unused media can be deleted.
- The API and the public pages expose only published translations of visible posts in enabled languages, public profile fields and categories and tags; API keys can be restricted further by language and category.

## Input validation and business limits

Every input is parsed on the server with a Zod schema: form fields, JSON bodies, route and query parameters and environment variables. Schemas use allowlists for enumerations, patterns for identifiers, ranges for numbers and explicit maximum lengths for every string. Invalid input stops the action with a generic error.

| Data                 | Rule                                                                                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identifiers          | UUID v4 for users, posts, media, sessions, API keys and webhooks                                                                                                                                                                                 |
| Email addresses      | Trimmed, lowercased, at most 254 characters, valid address syntax                                                                                                                                                                                |
| Passwords            | See [Authentication](#authentication); request fields accept at most 1,024 characters so that the policy can answer                                                                                                                              |
| Language codes       | BCP 47 tags in canonical form                                                                                                                                                                                                                    |
| Slugs                | Lowercase letters, digits and hyphens, unique per language                                                                                                                                                                                       |
| Post content         | Editor JSON with allowlisted nodes, marks and attributes; at most 1,000,000 characters, depth 32, 20,000 nodes, 5,000 children per node, 100,000 characters per text, 16 marks per node, 2,000 characters of LaTeX and 2,048 characters per link |
| Post fields          | Title 200, excerpt 1,000, meta title 200, meta description 500 characters; at most 20 tags of 50 characters                                                                                                                                      |
| Profiles             | Display name 100 and bio 1,000 characters                                                                                                                                                                                                        |
| Media                | See [File handling](#file-handling); alternative texts of 500 characters per enabled language                                                                                                                                                    |
| URLs                 | Links: `http`, `https`, `mailto` or relative. Webhooks: `https` (plain `http` only to allowed private targets), no credentials or fragments, at most 2,048 characters                                                                            |
| API query parameters | Unknown parameters and API keys in the query string are rejected; `per_page` up to 100, `page` up to 100,000, search up to 200 characters and 10 terms, at most 20 languages                                                                     |
| CORS origins         | Exact `scheme://host[:port]` without a path, at most 300 characters                                                                                                                                                                              |

Rules for combined values (V2.1.2): a slug is unique per language; a post has at most one translation per language; a scoped API key needs at least one language or category; only a first publication can be scheduled, and a time in the past publishes right away; a password must match its confirmation; revisions can only be restored within their own translation; workflow transitions follow the server-side state machine of the translation states (draft, pending review, scheduled, published, unpublished) and review states (pending, approved, rejected); the default content language can be neither disabled nor deleted.

Limits (V2.1.3):

| Limit                              | Scope             | Value                                                 |
| ---------------------------------- | ----------------- | ----------------------------------------------------- |
| Sign-in attempts                   | Client address    | 3 per 10 seconds                                      |
| Failed sign-ins before a pause     | Account           | 10 within 15 minutes, then 15 minutes paused          |
| Second-factor attempts             | Client address    | 3 per 10 seconds; Better Auth locks after 10 failures |
| Confirmations of sensitive actions | User and address  | 3 per 10 seconds                                      |
| Password reset requests            | Address and email | 10 per 15 minutes per address, 3 per hour per email   |
| Uploads                            | User              | 30 per minute                                         |
| API requests                       | API key           | 120 per minute by default, 1 to 100,000 configurable  |
| Webhooks                           | Installation      | 50 webhooks, 5 retries per delivery, 30 days of logs  |
| CORS origins                       | Installation      | 100                                                   |
| Revisions kept per translation     | Installation      | 50 by default, 1 to 1,000 configurable                |
| Request body                       | Request           | `BODY_SIZE_LIMIT`, 12 MB in the container             |

## File handling

Uploads (media library and avatars):

- Accepted: JPEG, PNG, WebP, GIF (also animated) and AVIF, recognised by their magic bytes. File names, extensions and the browser-supplied type are ignored. SVG and every other format are refused.
- At most 10 MB and 40 megapixels per file, 30 uploads per minute and user.
- Every image is decoded and re-encoded with `sharp` into WebP variants of 480, 960 and 1600 pixels and the full size; metadata such as EXIF and GPS data is removed. The original file is never stored or served, which removes embedded payloads more reliably than virus signatures would.
- Files are stored under `/data/uploads/<uuid>/` and served by `/media/<uuid>/<variant>.webp` with `Content-Type: image/webp`, `nosniff`, `Content-Disposition: inline; filename="<uuid>-<variant>.webp"` and a `default-src 'none'` policy.
- A file that cannot be decoded, is too large or has too many pixels is refused with an error and nothing is stored.

Backup archives (command line, and since 0.2.0 the founder's panel page, see [Changes after the review](#changes-after-the-review)):

- `.tar.gz` files with `backup.json`, `servitor.db` and the `uploads/` tree. Every entry is checked before extraction: only these names, only files and directories, no absolute paths, `..` or backslashes, at most 500,000 entries, and a declared size that fits into the free space of the data volume.
- The restored database must pass SQLite's integrity check and the manifest must have a known format; the replaced data is moved aside, never deleted.
- The migration history of the database must be a prefix of the migrations the running version knows, and its tables, indexes, triggers and views must equal those its migrations create, so an archive cannot bring extra triggers or views into the app.
- Uploads through the panel arrive in chunks of at most 8 MiB, are limited to five starts per minute and to the free space, and pass the same checks before they are listed.

## Cryptography

| Purpose                           | Algorithm and parameters                                                                                                                                     | Key or secret                                               | Stored as                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------- |
| Password hashing                  | scrypt, N = 2^15, r = 8, p = 3, 16-byte salt, 64-byte key                                                                                                    | None                                                        | `$scrypt$ln=15,r=8,p=3$<salt>$<hash>`                |
| Legacy password hashes            | Better Auth scrypt, N = 2^14, r = 16, p = 1                                                                                                                  | None                                                        | Verified and replaced at the next successful sign-in |
| Session and second-factor cookies | HMAC-SHA256 (Better Auth)                                                                                                                                    | Current `BETTER_AUTH_SECRET`                                | Signature in the cookie                              |
| TOTP secrets at rest              | XChaCha20-Poly1305 (Better Auth), key SHA-256 of the secret                                                                                                  | `BETTER_AUTH_SECRET`, versioned                             | `$ba$<key version>$<nonce and ciphertext>`           |
| Webhook secrets at rest           | AES-256-GCM, 96-bit random IV, key from HKDF-SHA256                                                                                                          | `BETTER_AUTH_SECRET`, versioned                             | `v2.<key version>.<iv>.<tag>.<ciphertext>`           |
| Key version                       | First 31 bits of SHA-256 over a label and the secret                                                                                                         | Each configured secret                                      | Inside the two formats above                         |
| Webhook signatures                | HMAC-SHA256 over `<timestamp>.<body>`                                                                                                                        | Per-webhook secret of 32 random bytes                       | Encrypted, see above                                 |
| API keys                          | 32 random bytes, SHA-256, constant-time comparison                                                                                                           | None                                                        | Hash and a short prefix                              |
| One-time tokens                   | 32 random bytes, SHA-256                                                                                                                                     | None                                                        | Hash                                                 |
| Backup codes                      | 24 base32 characters (120 bits), SHA-256                                                                                                                     | None                                                        | Hashes                                               |
| Encrypted backup downloads        | AES-256-GCM in 64 KiB chunks with counter and last-chunk flag in the nonce, header as associated data; key from scrypt, N = 2^16, r = 8, p = 1, 16-byte salt | Passphrase of 12 to 1024 characters chosen at download      | Not stored                                           |
| TOTP codes                        | RFC 6238, HMAC-SHA1, 6 digits, 30 seconds                                                                                                                    | Per-user TOTP secret of 32 random characters                | Encrypted, see above                                 |
| Random values                     | Node.js `crypto.randomBytes` and Web Crypto `getRandomValues`                                                                                                |                                                             |                                                      |
| Transport                         | TLS 1.2 or 1.3 at the reverse proxy; outgoing SMTP and webhooks at least TLS 1.2                                                                             | Proxy certificate; system CA store for outgoing connections |                                                      |

`BETTER_AUTH_SECRET` is the only long-term key. Its lifecycle, following NIST SP 800-57:

- Generation: by the operator, at least 32 random characters, for example `openssl rand -hex 32`. The app refuses shorter values.
- Storage and distribution: in the environment or in a file named by `BETTER_AUTH_SECRET_FILE` (for example a Docker secret). It is never logged, never written to the database or to backups, and only the application process reads it. It is not shared with any other system.
- Use: session cookie signatures, TOTP secret encryption and, through HKDF with a distinct label, webhook secret encryption. It is never used directly as an encryption key.
- Rotation: at least yearly and immediately on suspected exposure, as described in [Rotating the secret](operations.md#rotating-the-secret). Retired values stay in `BETTER_AUTH_PREVIOUS_SECRETS` only until the next start has encrypted every stored secret again.
- Destruction: remove retired values from the environment, the secret store and copies of `.env`. Backups contain only encrypted secrets; restoring an old backup needs the key that was current when it was made, which can be supplied as a previous secret.

Per-webhook secrets and API keys are generated on the server, shown once, and can be rotated or revoked in the panel; revoked or rotated values stop working immediately. Password hashes and stored secrets name their algorithm, cost or key version, so algorithms, parameters and keys can change without breaking existing data.

## Communication

| Connection                          | Protocol                                                                                             | Initiated by                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------ |
| Browsers and API clients to the app | HTTPS to the reverse proxy, then HTTP to port 3000 of the container on the host or a private network | Users and other applications   |
| App to the SMTP server (optional)   | SMTPS or SMTP with required STARTTLS; plain SMTP only to a relay on the same machine                 | The app, for account emails    |
| App to webhook targets              | HTTPS; plain HTTP only to private networks with `WEBHOOK_ALLOW_PRIVATE`                              | The app, for configured events |
| App to its data                     | SQLite database and upload files on the `/data` volume                                               | The app                        |
| Health check                        | HTTP to `127.0.0.1` inside the container                                                             | The container runtime          |

Webhook URLs are the only external locations that users choose. They are limited to staff, pass the SSRF checks before every delivery and never follow redirects. The application makes no other outgoing connections: no telemetry (Better Auth's is disabled), no fonts, scripts or images from other hosts and no update checks.

## Data protection

| Class               | Data                                                                                                                                             | Protection                                                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secrets             | Passwords, session tokens, TOTP secrets and codes, backup codes, API keys, one-time tokens, webhook secrets, `BETTER_AUTH_SECRET`, SMTP password | Hashed or encrypted at rest; shown at most once; sent only in bodies, headers or cookies; never logged (redacted by key and pattern); panel responses `no-store`                                                                       |
| Personal data       | Names, email addresses, IP addresses and user agents in sessions and the audit log, avatars and bios                                             | Email addresses, addresses and user agents are visible only to the user and to staff; the audit log only to the founder and admins; logs contain user IDs and client addresses but no content; sessions are deleted when they end      |
| Unpublished content | Drafts, revisions, submissions, rejection reasons, hidden posts                                                                                  | Only the owner and staff who may review or moderate it; previews need a signed-in user; never in the API, feeds or public pages. Media addresses are public but unguessable, which [Media](media.md#privacy-of-image-addresses) states |
| Public content      | Published translations, categories, tags, public author profiles                                                                                 | Public by design; served with integrity from the database                                                                                                                                                                              |

Requirements that apply to all classes:

- Integrity: every change runs in a database transaction; the audit log is append-only by database triggers.
- Encryption at rest: the SQLite database and uploads are not encrypted by the application. Keep `/data` on an encrypted volume where that matters; secrets are hashed or encrypted in any case.
- Retention: sessions end after inactivity or at the absolute lifetime, webhook delivery logs after 30 days, used one-time tokens are unusable; the audit log is kept for the life of the installation.
- Backups contain the complete database and uploads, including personal data and encrypted secrets. Store them outside the server with the same protection as the live data.
- Privacy: no trackers or third-party resources; users are told about sign-ins from new devices and about email changes.

## Resource-intensive functions

| Function                         | Cost                                      | Defenses                                                                                                              |
| -------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Password hashing                 | About 150 ms of CPU and 32 MiB per hash   | Sign-in limits per address and account, confirmation limits, runs on the bounded libuv thread pool                    |
| Image processing                 | Decoding and encoding up to 40 megapixels | 10 MB and 40 megapixel limits, 30 uploads per minute and user, signed-in users only                                   |
| Full-text search                 | SQLite FTS5 query                         | At most 200 characters and 10 terms, per-key rate limit, pagination                                                   |
| API lists                        | Database queries per page                 | At most 100 items per page, per-key rate limit, `ETag` and `Last-Modified` with `304`                                 |
| Public pages, feeds and sitemaps | Server rendering                          | Pagination (10 posts per page, 20 feed items), cacheable responses                                                    |
| Webhook deliveries               | Outgoing HTTP requests                    | Background worker, 10 deliveries every 5 seconds, 10-second timeout, 5 retries with backoff                           |
| Scheduled publishing             | Database updates                          | Background timer inside the app                                                                                       |
| Email                            | SMTP connections                          | Sent in the background with 10 and 20 second timeouts; failures never block a request                                 |
| Backups and restores             | Disk and CPU                              | One backup job at a time with a free-space check; restores only at start; founder with two-factor authentication only |

Every request finishes within bounded work, so no response needs longer than a client's usual timeout; the slowest synchronous action is processing a large upload.

## Logging

| Log                  | Written by         | Content                                                                                                                                                                                     | Destination and access                                                                                                        | Retention                                      |
| -------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Application log      | The app (pino)     | JSON lines with ISO timestamp in UTC, level and message: start-up, migrations, errors with correlation ID, route and method, warnings, security events, audit entries, Better Auth warnings | Standard output of the container; read by operators through the container runtime and shipped to a log system of their choice | Set by the operator's log driver or log system |
| Audit log            | The app            | Time, actor type and ID, action, target type and ID, client address, user agent and details without secrets or content                                                                      | `audit_log` table; append-only; visible to the founder and admins with filters; included in backups                           | Life of the installation                       |
| Webhook delivery log | The webhook worker | Event, status, attempts, response code, duration and error per delivery                                                                                                                     | Database; visible to staff on the webhook page                                                                                | 30 days                                        |
| Proxy access log     | The reverse proxy  | Requests as configured by the operator; one-time account links appear there                                                                                                                 | Operator                                                                                                                      | Keep it short                                  |

Security events are written at level `warn` with the message `Security event`, the event and the request ID, method, route and client address: refused permission checks, rate limits (sign-in, second factor, confirmation, two-factor enrollment, password reset, uploads), rejected API requests (401, 403, 429 and keys in query strings), refused CORS preflights, failed confirmations, reused TOTP codes and blocked webhook targets. Before a line is written, values under keys containing password, secret, token, cookie, authorization, API key, credential, TOTP or backup code are replaced with `[REDACTED]`, and API keys and bearer credentials are masked inside any string. CSRF refusals happen inside SvelteKit before the application runs and appear in the proxy log as `403` responses.

## Project security requirements

| Requirement                                                                                                    | Result | Notes                                                                       |
| -------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------- |
| Better Auth with email and password; public sign-up disabled; accounts only from the seed or invitations       | Pass   |                                                                             |
| Password hashing with scrypt                                                                                   | Pass   | Still scrypt, with a higher cost than Better Auth's default (see above)     |
| Password length 12 to 128, bundled list of at least 10,000 common passwords, no composition rules              | Pass   | Extended with long breach-derived passwords and context-specific words      |
| Session cookies `HttpOnly`, `Secure` in production, `SameSite=Lax`, host-only                                  | Pass   | Now also `__Host-` prefixed                                                 |
| Sliding session expiry of 7 days                                                                               | Pass   | Plus an absolute lifetime of 30 days                                        |
| All sessions revoked on password change or reset, role change, deactivation and 2FA disable                    | Pass   |                                                                             |
| Users see and revoke their own sessions (device, IP, last active)                                              | Pass   | Revoking now requires confirmation                                          |
| Fresh re-authentication for password, email, 2FA, backup codes, API keys, webhook secrets, roles, settings     | Pass   |                                                                             |
| Sign-in rate limited per IP; 10 failures in 15 minutes lock the account for 15 minutes; audit-logged           | Pass   | The per-IP limit is enforced by the app's limiter in front of Better Auth   |
| No user enumeration in sign-in, password reset and invite acceptance                                           | Pass   |                                                                             |
| Tokens of 32 random bytes, hashed, single-use, with the specified expiry, invalidated by newer tokens          | Pass   |                                                                             |
| TOTP two-factor authentication, 10 hashed backup codes, optional, can be required for founder and admins       | Pass   | Backup codes now have 120 bits; TOTP codes are single-use                   |
| Enabling and disabling 2FA audit-logged                                                                        | Pass   |                                                                             |
| One server-side permission module used by every handler, ownership checked in the database, table-driven tests | Pass   |                                                                             |
| Database access only in server modules                                                                         | Pass   |                                                                             |
| Zod validation with length limits for every input; parameterized queries only                                  | Pass   |                                                                             |
| SvelteKit origin check enabled, `ORIGIN` required, no state changes over GET                                   | Pass   |                                                                             |
| Content Security Policy in nonce mode with the specified directives                                            | Pass   | `base-uri` is `'none'`, stricter than the specified `'self'`                |
| HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`                         | Pass   | Now on every response, static files included; token pages use `same-origin` |
| Generic production errors with a correlation ID                                                                | Pass   |                                                                             |
| Environment validated at start; refuses a missing or short `BETTER_AUTH_SECRET`                                | Pass   |                                                                             |
| Structured JSON logs; `Authorization`, cookies, passwords, tokens, API keys, TOTP and webhook secrets redacted | Pass   |                                                                             |
| Reverse proxy, `ADDRESS_HEADER` and `XFF_DEPTH` documented                                                     | Pass   |                                                                             |
| Multi-stage image, non-root user, read-only root, tmpfs `/tmp`, `no-new-privileges`, no unnecessary packages   | Pass   | Also `cap_drop: ALL`                                                        |
| Append-only audit log with the specified fields and filters, visible to founder and admins, without secrets    | Pass   | Enforced by database triggers; entries are mirrored to the application log  |

## Changes after the review

Version 0.2.0 added backups and restores to the panel. They were designed against the requirements above:

- Access (V8): the new `backup.manage` permission belongs to the founder alone and is part of the permission matrix test; every page, action and endpoint also requires the founder's two-factor authentication.
- Sensitive operations (V7.5, V8.1): downloading, restoring and deleting archives and changing the schedule need the password and a current code; every backup action is written to the audit log, and a download sends the founder an email notice.
- Data protection (V14): archives leave out sessions and verification tokens and are vacuumed so that no trace of them remains; downloads can be encrypted with a passphrase, see [Cryptography](#cryptography).
- File handling (V5): uploads and restores go through the archive checks in [File handling](#file-handling), including the schema comparison against the migration history.
- Request forgery (V3.5): form actions keep SvelteKit's origin check, and the JSON and chunk endpoints of uploads compare the `Origin` header with `ORIGIN` as well.
- Availability (V2.4): backups run as one background job at a time; a restore is applied only at start, before the database is opened, while the stopping app answers every request with `503`.

## Requirement results

### V1 Encoding and Sanitization

#### V1.1 Encoding and Sanitization Architecture

| ID     | Level | Result | Notes                                                                                                                                                                                                                                        |
| ------ | ----- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1.1.1 | 2     | Pass   | Requests are decoded once by SvelteKit and the Fetch API before validation. Nothing is decoded again after Zod validation or sanitization.                                                                                                   |
| V1.1.2 | 2     | Pass   | Svelte escapes every interpolation when the page is rendered. Post HTML is sanitized once when it is saved and printed only through the single `content-html` component. XML, JSON-LD and email output are escaped where they are assembled. |

#### V1.2 Injection Prevention

| ID     | Level | Result         | Notes                                                                                                                                                                                                              |
| ------ | ----- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| V1.2.1 | 1     | Pass           | Svelte templates encode for HTML text and attributes, feeds and sitemaps go through one XML escaping helper, response header values are built from validated identifiers only, and email HTML escapes every value. |
| V1.2.2 | 1     | Pass           | URLs are built with `URL` and `encodeURIComponent`. Links in content, webhook targets and CORS origins are checked against an allowlist of protocols; `javascript:` and `data:` are rejected.                      |
| V1.2.3 | 1     | Pass           | JSON is produced with `JSON.stringify` or SvelteKit serialization. JSON-LD escapes `<`, `>`, `&`, U+2028 and U+2029 so it cannot leave its script element.                                                         |
| V1.2.4 | 1     | Pass           | All queries go through Drizzle with bound parameters, including the raw `sql` fragments. Full-text search terms are quoted before they reach the FTS5 `MATCH` expression.                                          |
| V1.2.5 | 1     | Pass           | The application never starts processes or shells. Archives are written and read with the `tar` library and images with `sharp`, both without a shell.                                                              |
| V1.2.6 | 2     | Not applicable | No LDAP.                                                                                                                                                                                                           |
| V1.2.7 | 2     | Not applicable | No XPath or XML queries.                                                                                                                                                                                           |
| V1.2.8 | 2     | Pass           | Math is rendered with KaTeX, which never runs a TeX engine; `trust` is off, `strict` is `error` and `maxSize` and `maxExpand` are limited.                                                                         |
| V1.2.9 | 2     | Pass           | Regular expressions are built only from constants; user input is never compiled into a pattern.                                                                                                                    |

#### V1.3 Sanitization

| ID      | Level | Result         | Notes                                                                                                                                                                                                                                                                                                                                                                                               |
| ------- | ----- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1.3.1  | 1     | Pass           | Editor JSON is validated against an allowlist, rendered on the server and passed through `sanitize-html` with an allowlist of elements, attributes, classes and URL schemes before it is stored.                                                                                                                                                                                                    |
| V1.3.2  | 1     | Pass           | No `eval`, `new Function` or other dynamic code execution.                                                                                                                                                                                                                                                                                                                                          |
| V1.3.3  | 2     | Pass           | Every input has a Zod schema with length limits; values that reach HTML, URLs, headers, file paths or SQL are restricted to the characters that context allows (for example UUID and slug patterns).                                                                                                                                                                                                |
| V1.3.4  | 2     | Pass           | SVG uploads are rejected; only raster images detected by their content are accepted and re-encoded.                                                                                                                                                                                                                                                                                                 |
| V1.3.5  | 2     | Pass           | There is no user-supplied Markdown, CSS, XSL or template language. Text colors are limited to validated color values and embeds to two allowlisted players with a fixed sandbox.                                                                                                                                                                                                                    |
| V1.3.6  | 2     | Pass           | Webhooks are the only outbound requests to user-chosen addresses. Only `https` is allowed (`http` only to private targets with `WEBHOOK_ALLOW_PRIVATE`), credentials in URLs are rejected, the host is resolved and loopback, private, link-local, CGNAT, multicast and reserved IPv4 and IPv6 ranges are refused, the checked address is pinned for the connection and redirects are not followed. |
| V1.3.7  | 2     | Pass           | Templates are compiled Svelte components and fixed email builders; untrusted input is only ever data.                                                                                                                                                                                                                                                                                               |
| V1.3.8  | 2     | Not applicable | No JNDI.                                                                                                                                                                                                                                                                                                                                                                                            |
| V1.3.9  | 2     | Not applicable | No memcache.                                                                                                                                                                                                                                                                                                                                                                                        |
| V1.3.10 | 2     | Pass           | Log messages are constant strings with data passed as structured fields, so format specifiers in input are never interpreted.                                                                                                                                                                                                                                                                       |
| V1.3.11 | 2     | Pass           | Recipients are validated email addresses, subjects come from translated templates and nodemailer encodes every header, so input cannot add SMTP commands or headers.                                                                                                                                                                                                                                |

#### V1.4 Memory, String, and Unmanaged Code

| ID     | Level | Result         | Notes                                                                                                                |
| ------ | ----- | -------------- | -------------------------------------------------------------------------------------------------------------------- |
| V1.4.1 | 2     | Not applicable | The application is written in JavaScript on Node.js, which is memory safe; it contains no unmanaged code.            |
| V1.4.2 | 2     | Pass           | Numeric input is parsed with Zod as bounded integers (for example page numbers, limits and ports) before it is used. |
| V1.4.3 | 2     | Not applicable | No manual memory management; the runtime is garbage collected.                                                       |

#### V1.5 Safe Deserialization

| ID     | Level | Result         | Notes                                                                                                                                                   |
| ------ | ----- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1.5.1 | 1     | Not applicable | The application never parses XML; it only generates feeds and sitemaps.                                                                                 |
| V1.5.2 | 2     | Pass           | Untrusted data is only deserialized with `JSON.parse` and then validated with Zod. Backup archives are checked entry by entry before they are unpacked. |

### V2 Validation and Business Logic

#### V2.1 Validation and Business Logic Documentation

| ID     | Level | Result | Notes                                                                                                                                         |
| ------ | ----- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| V2.1.1 | 1     | Fixed  | The validation rules for every kind of input are documented in [Input validation and business limits](#input-validation-and-business-limits). |
| V2.1.2 | 2     | Fixed  | Rules for combined values, such as translations per language, scopes of API keys and workflow states, are documented in the same section.     |
| V2.1.3 | 2     | Fixed  | Per-user and global limits are documented in the same section.                                                                                |

#### V2.2 Input Validation

| ID     | Level | Result | Notes                                                                                                                                                                                                                                                                                                                 |
| ------ | ----- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2.2.1 | 1     | Pass   | Every form action, endpoint, route parameter, query parameter and environment variable is parsed with a Zod schema using allowlists, patterns, ranges and length limits. Unknown API query parameters are rejected.                                                                                                   |
| V2.2.2 | 1     | Pass   | All validation runs on the server; client-side checks only improve the forms.                                                                                                                                                                                                                                         |
| V2.2.3 | 2     | Pass   | Related values are checked together on the server, for example that a slug is unique per language, that an API key has at least one language or category when it is scoped, that a password and its confirmation match, and that only a first publication can be scheduled (a time in the past publishes right away). |

#### V2.3 Business Logic Security

| ID     | Level | Result         | Notes                                                                                                                                                                                                                                                                                                                  |
| ------ | ----- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2.3.1 | 1     | Pass           | Multi-step flows keep their state on the server: the second sign-in factor is bound to a signed, short-lived challenge cookie, forced password changes and forced two-factor enrollment block every other page, and the content workflow is a server-side state machine that rejects transitions that are not allowed. |
| V2.3.2 | 2     | Pass           | The documented limits are enforced by the rate limiter, the lockout, size limits and database constraints; see [Input validation and business limits](#input-validation-and-business-limits).                                                                                                                          |
| V2.3.3 | 2     | Pass           | Every multi-step write, such as publishing, accepting an invitation, changing roles or rotating secrets, runs in one SQLite transaction together with its audit entry.                                                                                                                                                 |
| V2.3.4 | 2     | Not applicable | There are no limited-quantity resources. One-time tokens and backup codes are consumed atomically.                                                                                                                                                                                                                     |

#### V2.4 Anti-automation

| ID     | Level | Result | Notes                                                                                                                                                                                                                                                                            |
| ------ | ----- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2.4.1 | 2     | Fixed  | Sign-in, second factor, password reset requests, re-authentication and the API were rate limited before; uploads, the most expensive action of signed-in users, are now limited to 30 per minute and user. Content writes are bounded by size limits and the revision retention. |

### V3 Web Frontend Security

#### V3.2 Unintended Content Interpretation

| ID     | Level | Result | Notes                                                                                                                                                                                                                                             |
| ------ | ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V3.2.1 | 1     | Pass   | Uploaded images are re-encoded to WebP and served with `Content-Type: image/webp`, `nosniff`, `Content-Disposition: inline` with a generated file name and a `default-src 'none'` Content Security Policy. API responses are JSON with `nosniff`. |
| V3.2.2 | 1     | Pass   | Svelte renders text through text nodes; `{@html}` is allowed only for sanitized post HTML in one component, enforced by ESLint.                                                                                                                   |

#### V3.3 Cookie Setup

| ID     | Level | Result | Notes                                                                                                                                                                                                                                                                                                |
| ------ | ----- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V3.3.1 | 1     | Fixed  | Over `https`, session cookies are stored as `__Host-servitor.*` and preference cookies as `__Host-servitor_*`, all `Secure`. Better Auth still names them `__Secure-`; a small translation layer renames them for the browser and ignores any auth cookie that arrives without the `__Host-` prefix. |
| V3.3.2 | 2     | Pass   | Session, second-factor and preference cookies use `SameSite=Lax`, which blocks cross-site form posts while keeping links into the panel working.                                                                                                                                                     |
| V3.3.3 | 2     | Fixed  | All cookies use the `__Host-` prefix over `https`; none is meant for other hosts.                                                                                                                                                                                                                    |
| V3.3.4 | 2     | Pass   | Session and challenge cookies are `HttpOnly` and are only ever sent in `Set-Cookie`; preference cookies are `HttpOnly` as well.                                                                                                                                                                      |

#### V3.4 Browser Security Mechanism Headers

| ID     | Level | Result | Notes                                                                                                                                                                                                                                                         |
| ------ | ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V3.4.1 | 1     | Fixed  | Production responses carry `Strict-Transport-Security: max-age=63072000; includeSubDomains`. Static build files did not pass through SvelteKit hooks and missed it; the server entry now adds the header to every response.                                   |
| V3.4.2 | 1     | Pass   | CORS is only answered on `/api/v1` for origins on the exact-match allowlist; the request origin is echoed only after it matched, and credentials are never allowed.                                                                                           |
| V3.4.3 | 2     | Fixed  | Pages send a nonce-based policy with `object-src 'none'`; `base-uri` was `'self'` and is now `'none'`. Every other response, including static files and endpoints, now gets `default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'`. |
| V3.4.4 | 2     | Fixed  | `X-Content-Type-Options: nosniff` was set on SvelteKit responses only; the server entry now adds it to static files as well.                                                                                                                                  |
| V3.4.5 | 2     | Pass   | `Referrer-Policy: strict-origin-when-cross-origin` on every response, and `same-origin` on pages whose address carries a one-time token.                                                                                                                      |
| V3.4.6 | 2     | Fixed  | Pages already sent `frame-ancestors 'none'`; the other responses, including static files, now send it too.                                                                                                                                                    |

#### V3.5 Browser Origin Separation

| ID     | Level | Result         | Notes                                                                                                                                 |
| ------ | ----- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| V3.5.1 | 1     | Pass           | SvelteKit rejects form posts from other origins, cookies are `SameSite=Lax`, the panel has no CORS, and state changes use POST only.  |
| V3.5.2 | 1     | Pass           | The panel does not rely on CORS preflights; the API is read-only and answers every method other than GET, HEAD and OPTIONS with 405.  |
| V3.5.3 | 1     | Pass           | State changes are form actions or POST endpoints; GET requests never change state.                                                    |
| V3.5.4 | 2     | Pass           | Servitor CMS is one application. The public pages ship without JavaScript, so sharing the origin with the panel adds no script to it. |
| V3.5.5 | 2     | Not applicable | The application does not use `postMessage`.                                                                                           |

#### V3.7 Other Browser Security Considerations

| ID     | Level | Result | Notes                                                                                                                      |
| ------ | ----- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| V3.7.1 | 2     | Pass   | Only current HTML, CSS and JavaScript; no plugins.                                                                         |
| V3.7.2 | 2     | Pass   | Redirect targets are checked to be same-origin paths before they are used; the application never redirects to other hosts. |

### V4 API and Web Service

#### V4.1 Generic Web Service Security

| ID     | Level | Result | Notes                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ----- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V4.1.1 | 1     | Fixed  | SvelteKit sends pages as `text/html` without a charset; every `text/*` and XML response now declares `charset=utf-8`. Static JavaScript modules and CSS from the build are served by the file server as `text/javascript` and `text/css`; module scripts are always decoded as UTF-8 and the style sheets inherit UTF-8 from the pages, and these immutable build files contain no user data. |
| V4.1.2 | 2     | Pass   | The application never redirects between HTTP and HTTPS itself. [Deployment](deployment.md#tls-and-plain-http) asks operators to redirect only pages at the reverse proxy and to answer `/api/` over plain HTTP with an error.                                                                                                                                                                 |
| V4.1.3 | 2     | Pass   | The client address comes from `ADDRESS_HEADER` with `XFF_DEPTH`, which reads the entry added by the trusted proxy. The internal client-address header used for Better Auth is removed from incoming requests and set by the server.                                                                                                                                                           |

#### V4.2 HTTP Message Structure Validation

| ID     | Level | Result | Notes                                                                                                                                                |
| ------ | ----- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| V4.2.1 | 2     | Pass   | Node.js parses HTTP/1.1 strictly and rejects requests with both `Transfer-Encoding` and `Content-Length`; HTTP/2 is terminated at the reverse proxy. |

#### V4.3 GraphQL

| ID     | Level | Result         | Notes       |
| ------ | ----- | -------------- | ----------- |
| V4.3.1 | 2     | Not applicable | No GraphQL. |
| V4.3.2 | 2     | Not applicable | No GraphQL. |

#### V4.4 WebSocket

| ID     | Level | Result         | Notes                                                            |
| ------ | ----- | -------------- | ---------------------------------------------------------------- |
| V4.4.1 | 1     | Not applicable | No WebSockets in production (Vite uses one only in development). |
| V4.4.2 | 2     | Not applicable | No WebSockets.                                                   |
| V4.4.3 | 2     | Not applicable | No WebSockets.                                                   |
| V4.4.4 | 2     | Not applicable | No WebSockets.                                                   |

### V5 File Handling

#### V5.1 File Handling Documentation

| ID     | Level | Result | Notes                                                                                                                                                                                                                  |
| ------ | ----- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V5.1.1 | 2     | Fixed  | Upload types, size and pixel limits and the re-encoding are documented in [Media](media.md#uploading) and in [File handling](#file-handling); the limits for backup archives, including the unpacked size, were added. |

#### V5.2 File Upload and Content

| ID     | Level | Result | Notes                                                                                                                                                                                                         |
| ------ | ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V5.2.1 | 1     | Pass   | Uploads are limited to 10 MB and 40 megapixels, request bodies by `BODY_SIZE_LIMIT`, and every upload is processed within these bounds.                                                                       |
| V5.2.2 | 1     | Pass   | The type is detected from the magic bytes, never from the name or MIME type, and every image is decoded and re-encoded with `sharp`.                                                                          |
| V5.2.3 | 2     | Fixed  | Restores now count the entries and add up the declared sizes of a backup archive before unpacking it, and refuse archives with more than 500,000 entries or more data than the free space of the data volume. |

#### V5.3 File Storage

| ID     | Level | Result | Notes                                                                                                                                                                                                      |
| ------ | ----- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V5.3.1 | 1     | Pass   | Uploads are stored outside the web root under generated names and served only as WebP images by a route that reads them as data.                                                                           |
| V5.3.2 | 1     | Pass   | File paths are built from generated UUIDs and a fixed list of variants; user-supplied file names are ignored. Backup entries are checked against an allowlist without absolute paths, `..` or backslashes. |

#### V5.4 File Download

| ID     | Level | Result | Notes                                                                                                                                                                                                                           |
| ------ | ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V5.4.1 | 2     | Fixed  | User-supplied file names are ignored. Media responses now carry `Content-Disposition: inline; filename="<id>-<variant>.webp"`.                                                                                                  |
| V5.4.2 | 2     | Fixed  | The file name in `Content-Disposition` is built only from the validated UUID and variant, so it needs no further encoding.                                                                                                      |
| V5.4.3 | 2     | Pass   | Original uploads are never served. Every image is decoded and rewritten to WebP, which removes embedded payloads more reliably than signature scanning; SVG and other formats are refused. See [File handling](#file-handling). |

### V6 Authentication

#### V6.1 Authentication Documentation

| ID     | Level | Result | Notes                                                                                                                                                                                                  |
| ------ | ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| V6.1.1 | 1     | Pass   | Rate limits and the temporary, account-scoped lockout are documented in [Security](security.md#accounts-and-sign-in) and in [Authentication](#authentication), including why the lockout is temporary. |
| V6.1.2 | 2     | Fixed  | The context-specific words are documented in [Authentication](#authentication).                                                                                                                        |
| V6.1.3 | 2     | Pass   | The authentication pathways and their strength are documented in [Authentication](#authentication).                                                                                                    |

#### V6.2 Password Security

| ID      | Level | Result | Notes                                                                                                                                                                                                                                                          |
| ------- | ----- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V6.2.1  | 1     | Pass   | Passwords must have at least 12 characters.                                                                                                                                                                                                                    |
| V6.2.2  | 1     | Pass   | Every user can change the password under **Account → Password**.                                                                                                                                                                                               |
| V6.2.3  | 1     | Pass   | Changing the password requires the current password (and a current code with two-factor authentication) and the new one.                                                                                                                                       |
| V6.2.4  | 1     | Fixed  | The bundled 10,000-entry list contained only 10 passwords of 12 characters or more, so it barely applied under the length rule. The 43,940 passwords of 12 to 128 characters from SecLists' list of the million most common passwords are now bundled as well. |
| V6.2.5  | 1     | Pass   | No composition rules.                                                                                                                                                                                                                                          |
| V6.2.6  | 1     | Pass   | Password fields use `type="password"`.                                                                                                                                                                                                                         |
| V6.2.7  | 1     | Pass   | Paste is not blocked and the fields carry `autocomplete` hints for password managers.                                                                                                                                                                          |
| V6.2.8  | 1     | Pass   | Passwords are verified as entered, without truncation or case changes; only Unicode NFKC normalization is applied, as NIST SP 800-63B recommends, both when hashing and when verifying.                                                                        |
| V6.2.9  | 2     | Pass   | Passwords of up to 128 characters are accepted.                                                                                                                                                                                                                |
| V6.2.10 | 2     | Pass   | Passwords never expire. Only seeded and temporary passwords must be changed at the next sign-in.                                                                                                                                                               |
| V6.2.11 | 2     | Fixed  | New passwords are checked against the documented context-specific words: product and role names, the site name, the host name and the user's name and email address, including look-alike spellings. These words do not count toward the minimum length.       |
| V6.2.12 | 2     | Fixed  | New passwords are checked offline against 43,940 breach-derived passwords from SecLists that meet the length rules, in addition to the 10,000 most common passwords.                                                                                           |

#### V6.3 General Authentication Security

| ID     | Level | Result | Notes                                                                                                                                                                                                                                                            |
| ------ | ----- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V6.3.1 | 1     | Pass   | 3 sign-in attempts per 10 seconds and client, 3 second-factor attempts per 10 seconds, a 15-minute lock after 10 failures within 15 minutes per account, and Better Auth's own second-factor lock.                                                               |
| V6.3.2 | 1     | Pass   | There are no default accounts. The founder is created from `FOUNDER_*` variables, the password must pass the policy and has to be changed at the first sign-in.                                                                                                  |
| V6.3.3 | 2     | Pass   | Two-factor authentication is available to every user and can be required for the founder and admins; it is not forced on authors because the specification keeps it optional. The documented rationale and mitigations are in [Authentication](#authentication). |
| V6.3.4 | 2     | Pass   | There are three pathways: panel sign-in, API keys for the read-only public API, and the command line inside the container. All are documented, and the panel enforces the same factors on every sign-in route.                                                   |

#### V6.4 Authentication Factor Lifecycle and Recovery

| ID     | Level | Result | Notes                                                                                                                                                                                                                                                         |
| ------ | ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V6.4.1 | 1     | Pass   | The only system-generated password is the temporary founder password from `reset-founder`: 24 random characters, printed once and replaced at the next sign-in. Invitations are one-time links that expire after 72 hours.                                    |
| V6.4.2 | 1     | Pass   | No password hints or security questions.                                                                                                                                                                                                                      |
| V6.4.3 | 2     | Pass   | Password reset links are single-use, expire after 30 minutes and never sign the user in; two-factor authentication is still required at the next sign-in.                                                                                                     |
| V6.4.4 | 2     | Pass   | Backup codes created at enrollment are the only self-service recovery. Without them, the founder is recovered by an operator with shell access, which is stronger than the enrollment, and other users are onboarded again by staff through a new invitation. |

#### V6.5 General Multi-factor authentication requirements

| ID     | Level | Result | Notes                                                                                                                                                                                                                                                                               |
| ------ | ----- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V6.5.1 | 2     | Fixed  | Backup codes were already single-use, but Better Auth accepts the same TOTP code again within its validity window. Every accepted code is now remembered per user for two minutes and rejected when it is presented again, at sign-in, for re-authentication and during enrollment. |
| V6.5.2 | 2     | Fixed  | Backup codes had about 60 bits of entropy and were stored as keyed HMACs. They now have 120 bits (24 base32 characters), which allows a plain SHA-256 hash.                                                                                                                         |
| V6.5.3 | 2     | Pass   | TOTP secrets come from Better Auth's CSPRNG and backup codes from `crypto.randomBytes`.                                                                                                                                                                                             |
| V6.5.4 | 2     | Pass   | Backup codes have 120 bits and TOTP codes six digits.                                                                                                                                                                                                                               |
| V6.5.5 | 2     | Pass   | TOTP codes use 30-second steps. The verifier accepts one step of clock drift on each side as RFC 6238 recommends, and replay protection makes each code usable only once.                                                                                                           |

#### V6.6 Out-of-Band authentication mechanisms

| ID     | Level | Result         | Notes                                                                                                                  |
| ------ | ----- | -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| V6.6.1 | 2     | Not applicable | No SMS or phone-based factors.                                                                                         |
| V6.6.2 | 2     | Not applicable | No out-of-band authenticators. Email links are used only for account recovery and invitations and are covered by V6.4. |
| V6.6.3 | 2     | Not applicable | No out-of-band authenticators.                                                                                         |

#### V6.8 Authentication with an Identity Provider

| ID     | Level | Result         | Notes                  |
| ------ | ----- | -------------- | ---------------------- |
| V6.8.1 | 2     | Not applicable | No identity providers. |
| V6.8.2 | 2     | Not applicable | No identity providers. |
| V6.8.3 | 2     | Not applicable | No SAML.               |
| V6.8.4 | 2     | Not applicable | No identity providers. |

### V7 Session Management

#### V7.1 Session Management Documentation

| ID     | Level | Result         | Notes                                                                                                                                            |
| ------ | ----- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| V7.1.1 | 2     | Fixed          | Inactivity timeout (7 days), the new absolute lifetime (30 days) and the deviation from NIST SP 800-63B are documented in [Sessions](#sessions). |
| V7.1.2 | 2     | Fixed          | Concurrent sessions are unlimited by design; this and the controls around it are documented in [Sessions](#sessions).                            |
| V7.1.3 | 2     | Not applicable | No federated identity or single sign-on.                                                                                                         |

#### V7.2 Fundamental Session Management Security

| ID     | Level | Result | Notes                                                                                                                                                                                                                                                            |
| ------ | ----- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V7.2.1 | 1     | Pass   | Every request looks the session up in the database through Better Auth on the server; the cookie cache is disabled.                                                                                                                                              |
| V7.2.2 | 1     | Pass   | Sessions use random reference tokens created at sign-in.                                                                                                                                                                                                         |
| V7.2.3 | 1     | Pass   | Session tokens are 32 random characters from a 62-character alphabet (about 190 bits) generated with a CSPRNG.                                                                                                                                                   |
| V7.2.4 | 1     | Pass   | Every sign-in, turning on two-factor authentication and changing or resetting the password create a new session and delete the previous one. Step-up confirmation for sensitive actions does not raise the privileges of a session, so it has nothing to rotate. |

#### V7.3 Session Timeout

| ID     | Level | Result | Notes                                                                                                                                                 |
| ------ | ----- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| V7.3.1 | 2     | Pass   | Sessions expire after 7 days without activity (sliding expiry required by the specification); sensitive actions ask for the password again.           |
| V7.3.2 | 2     | Fixed  | The sliding expiry had no upper bound. Sessions now end 30 days after the sign-in, whatever the activity, and the ending is written to the audit log. |

#### V7.4 Session Termination

| ID     | Level | Result | Notes                                                                                                                                                                    |
| ------ | ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| V7.4.1 | 1     | Pass   | Signing out deletes the session in the database; the cookie becomes useless even if it was kept.                                                                         |
| V7.4.2 | 1     | Pass   | Deactivating a user deletes all of the user's sessions, and deactivated users can never get a new one.                                                                   |
| V7.4.3 | 2     | Pass   | Changing or resetting the password and turning off two-factor authentication end the other sessions automatically, and the sessions page offers to end them at any time. |
| V7.4.4 | 2     | Pass   | The sign-out button is in the navigation of every panel page.                                                                                                            |
| V7.4.5 | 2     | Fixed  | Staff could end a user's sessions only by deactivating the account. The new `sign-out` command ends the sessions of one user or of all users and writes an audit entry.  |

#### V7.5 Defenses Against Session Abuse

| ID     | Level | Result | Notes                                                                                                                                                                               |
| ------ | ----- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V7.5.1 | 2     | Pass   | Changing the password or email address, disabling two-factor authentication and regenerating backup codes require the password and, with two-factor authentication, a current code. |
| V7.5.2 | 2     | Fixed  | Users could see and end their sessions without confirming; ending one or all other sessions now requires the password and, with two-factor authentication, a current code.          |

#### V7.6 Federated Re-authentication

| ID     | Level | Result         | Notes                                                            |
| ------ | ----- | -------------- | ---------------------------------------------------------------- |
| V7.6.1 | 2     | Not applicable | No federation.                                                   |
| V7.6.2 | 2     | Not applicable | No federation; sessions are only created by an explicit sign-in. |

### V8 Authorization

#### V8.1 Authorization Documentation

| ID     | Level | Result | Notes                                                                                                                        |
| ------ | ----- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| V8.1.1 | 1     | Fixed  | The permission matrix and the ownership rules are documented in [Authorization](#authorization).                             |
| V8.1.2 | 2     | Fixed  | Field-level rules, such as who may change roles, publishing rights and moderation state, are documented in the same section. |

#### V8.2 General Authorization Design

| ID     | Level | Result | Notes                                                                                                                                                                           |
| ------ | ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V8.2.1 | 1     | Pass   | Every load function, form action and endpoint calls `requirePermission` or `can` from one server module; a table-driven test covers every cell of the matrix.                   |
| V8.2.2 | 1     | Pass   | Ownership is checked against the database for posts, media, sessions and users; foreign IDs return 403 or 404.                                                                  |
| V8.2.3 | 2     | Pass   | Actions accept only their own fields through Zod schemas; role, publishing rights, ownership and moderation state are never taken from forms that are not meant to change them. |

#### V8.3 Operation Level Authorization

| ID     | Level | Result | Notes                                                                               |
| ------ | ----- | ------ | ----------------------------------------------------------------------------------- |
| V8.3.1 | 1     | Pass   | All authorization happens on the server; hidden buttons are never the only control. |

#### V8.4 Other Authorization Considerations

| ID     | Level | Result         | Notes                      |
| ------ | ----- | -------------- | -------------------------- |
| V8.4.1 | 2     | Not applicable | Single-tenant application. |

### V9 Self-contained Tokens

#### V9.1 Token source and integrity

| ID     | Level | Result         | Notes                                                                                                                                                           |
| ------ | ----- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V9.1.1 | 1     | Not applicable | No self-contained tokens: sessions, one-time tokens and API keys are reference tokens checked against the database, and Better Auth's cookie cache is disabled. |
| V9.1.2 | 1     | Not applicable | No self-contained tokens.                                                                                                                                       |
| V9.1.3 | 1     | Not applicable | No self-contained tokens.                                                                                                                                       |

#### V9.2 Token content

| ID     | Level | Result         | Notes                     |
| ------ | ----- | -------------- | ------------------------- |
| V9.2.1 | 1     | Not applicable | No self-contained tokens. |
| V9.2.2 | 2     | Not applicable | No self-contained tokens. |
| V9.2.3 | 2     | Not applicable | No self-contained tokens. |
| V9.2.4 | 2     | Not applicable | No self-contained tokens. |

### V10 OAuth and OIDC

#### V10.1 Generic OAuth and OIDC Security

| ID      | Level | Result         | Notes                       |
| ------- | ----- | -------------- | --------------------------- |
| V10.1.1 | 2     | Not applicable | No OAuth or OpenID Connect. |
| V10.1.2 | 2     | Not applicable | No OAuth or OpenID Connect. |

#### V10.2 OAuth Client

| ID      | Level | Result         | Notes            |
| ------- | ----- | -------------- | ---------------- |
| V10.2.1 | 2     | Not applicable | No OAuth client. |
| V10.2.2 | 2     | Not applicable | No OAuth client. |

#### V10.3 OAuth Resource Server

| ID      | Level | Result         | Notes                                                                           |
| ------- | ----- | -------------- | ------------------------------------------------------------------------------- |
| V10.3.1 | 2     | Not applicable | No OAuth resource server; API keys are opaque and checked against the database. |
| V10.3.2 | 2     | Not applicable | No OAuth resource server.                                                       |
| V10.3.3 | 2     | Not applicable | No OAuth resource server.                                                       |
| V10.3.4 | 2     | Not applicable | No OAuth resource server.                                                       |

#### V10.4 OAuth Authorization Server

| ID       | Level | Result         | Notes                    |
| -------- | ----- | -------------- | ------------------------ |
| V10.4.1  | 1     | Not applicable | No authorization server. |
| V10.4.2  | 1     | Not applicable | No authorization server. |
| V10.4.3  | 1     | Not applicable | No authorization server. |
| V10.4.4  | 1     | Not applicable | No authorization server. |
| V10.4.5  | 1     | Not applicable | No authorization server. |
| V10.4.6  | 2     | Not applicable | No authorization server. |
| V10.4.7  | 2     | Not applicable | No authorization server. |
| V10.4.8  | 2     | Not applicable | No authorization server. |
| V10.4.9  | 2     | Not applicable | No authorization server. |
| V10.4.10 | 2     | Not applicable | No authorization server. |
| V10.4.11 | 2     | Not applicable | No authorization server. |

#### V10.5 OIDC Client

| ID      | Level | Result         | Notes              |
| ------- | ----- | -------------- | ------------------ |
| V10.5.1 | 2     | Not applicable | No OpenID Connect. |
| V10.5.2 | 2     | Not applicable | No OpenID Connect. |
| V10.5.3 | 2     | Not applicable | No OpenID Connect. |
| V10.5.4 | 2     | Not applicable | No OpenID Connect. |
| V10.5.5 | 2     | Not applicable | No OpenID Connect. |

#### V10.6 OpenID Provider

| ID      | Level | Result         | Notes               |
| ------- | ----- | -------------- | ------------------- |
| V10.6.1 | 2     | Not applicable | No OpenID Provider. |
| V10.6.2 | 2     | Not applicable | No OpenID Provider. |

#### V10.7 Consent Management

| ID      | Level | Result         | Notes                    |
| ------- | ----- | -------------- | ------------------------ |
| V10.7.1 | 2     | Not applicable | No authorization server. |
| V10.7.2 | 2     | Not applicable | No authorization server. |
| V10.7.3 | 2     | Not applicable | No authorization server. |

### V11 Cryptography

#### V11.1 Cryptographic Inventory and Documentation

| ID      | Level | Result | Notes                                                                                                      |
| ------- | ----- | ------ | ---------------------------------------------------------------------------------------------------------- |
| V11.1.1 | 2     | Fixed  | Key management and the key lifecycle, including rotation, are documented in [Cryptography](#cryptography). |
| V11.1.2 | 2     | Fixed  | The cryptographic inventory is in [Cryptography](#cryptography).                                           |

#### V11.2 Secure Cryptography Implementation

| ID      | Level | Result | Notes                                                                                                                                                                                                                                                                                       |
| ------- | ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V11.2.1 | 2     | Pass   | Only Node.js `crypto` (OpenSSL) and the audited `@noble` libraries used by Better Auth.                                                                                                                                                                                                     |
| V11.2.2 | 2     | Fixed  | Password hashes now name their algorithm and cost and are upgraded at the next sign-in; stored secrets carry a key version and are encrypted again with the current key on start, so `BETTER_AUTH_SECRET` can be rotated without losing data. Backup code hashes no longer depend on a key. |
| V11.2.3 | 2     | Pass   | AES-256-GCM, XChaCha20-Poly1305, HMAC-SHA256, SHA-256 and scrypt; every random secret has at least 120 bits.                                                                                                                                                                                |

#### V11.3 Encryption Algorithms

| ID      | Level | Result | Notes                                                                                       |
| ------- | ----- | ------ | ------------------------------------------------------------------------------------------- |
| V11.3.1 | 1     | Pass   | No ECB or PKCS#1 v1.5.                                                                      |
| V11.3.2 | 1     | Pass   | AES-256-GCM for webhook secrets and XChaCha20-Poly1305 (Better Auth) for TOTP secrets.      |
| V11.3.3 | 2     | Pass   | Both ciphers are authenticated; tampered values fail to decrypt and are treated as missing. |

#### V11.4 Hashing and Hash-based Functions

| ID      | Level | Result         | Notes                                                                                                                                                                                                                 |
| ------- | ----- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V11.4.1 | 1     | Pass           | SHA-256 and HMAC-SHA256 everywhere; no MD5. TOTP uses HMAC-SHA1 as RFC 6238 and the authenticator apps require, which is still approved for HMAC.                                                                     |
| V11.4.2 | 2     | Fixed          | Better Auth's default scrypt cost (N = 2^14, r = 16, p = 1) was below OWASP's current guidance; passwords are now hashed with scrypt N = 2^15, r = 8, p = 3 and older hashes are upgraded after a successful sign-in. |
| V11.4.3 | 2     | Pass           | SHA-256 for API keys, one-time tokens, backup codes and ETags, and HMAC-SHA256 for webhook signatures.                                                                                                                |
| V11.4.4 | 2     | Not applicable | No keys are derived from passwords. Keys derived from `BETTER_AUTH_SECRET`, a high-entropy secret of at least 32 characters, use HKDF-SHA256.                                                                         |

#### V11.5 Random Values

| ID      | Level | Result | Notes                                                                                                                                                                                         |
| ------- | ----- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V11.5.1 | 2     | Pass   | Session tokens, one-time tokens (32 bytes), API keys (32 bytes), webhook secrets (32 bytes), backup codes (120 bits) and TOTP secrets come from a CSPRNG. UUIDs are used only as identifiers. |

#### V11.6 Public Key Cryptography

| ID      | Level | Result         | Notes                                                                                                              |
| ------- | ----- | -------------- | ------------------------------------------------------------------------------------------------------------------ |
| V11.6.1 | 2     | Not applicable | The application does not generate keys for or use public-key cryptography; TLS is terminated by the reverse proxy. |

### V12 Secure Communication

#### V12.1 General TLS Security Guidance

| ID      | Level | Result         | Notes                                                                                                                                                                                                                                     |
| ------- | ----- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V12.1.1 | 1     | Pass           | TLS is terminated by the reverse proxy; [Deployment](deployment.md#tls-and-plain-http) requires TLS 1.2 and 1.3 only, as Caddy, Traefik and Coolify configure by default. Outgoing webhook and SMTP connections require at least TLS 1.2. |
| V12.1.2 | 2     | Pass           | Cipher suites are those of the recommended proxies' modern defaults and of Node.js, which prefer forward-secret AEAD suites.                                                                                                              |
| V12.1.3 | 2     | Not applicable | No mutual TLS.                                                                                                                                                                                                                            |

#### V12.2 HTTPS Communication with External Facing Services

| ID      | Level | Result | Notes                                                                                                               |
| ------- | ----- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| V12.2.1 | 1     | Pass   | Browsers reach the app only through the TLS proxy, and HSTS with `includeSubDomains` prevents falling back to HTTP. |
| V12.2.2 | 1     | Pass   | The documented deployment uses publicly trusted certificates, obtained automatically by Caddy, Traefik or Coolify.  |

#### V12.3 General Service to Service Communication Security

| ID      | Level | Result         | Notes                                                                                                                                                                                                                                                |
| ------- | ----- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V12.3.1 | 2     | Fixed          | SMTP used STARTTLS only when the server offered it and could fall back to plain text. TLS is now required (`requireTLS`, minimum TLS 1.2) except for a relay on the same machine. Webhooks use `https` except to explicitly allowed private targets. |
| V12.3.2 | 2     | Pass           | Certificate validation is left on for webhooks and SMTP (`rejectUnauthorized: true`).                                                                                                                                                                |
| V12.3.3 | 2     | Not applicable | The application is a single process with an embedded SQLite database; there are no internal HTTP services.                                                                                                                                           |
| V12.3.4 | 2     | Not applicable | No internal services.                                                                                                                                                                                                                                |

### V13 Configuration

#### V13.1 Configuration Documentation

| ID      | Level | Result | Notes                                                                                                                        |
| ------- | ----- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| V13.1.1 | 2     | Fixed  | All communication needs, including the user-configurable webhook targets, are documented in [Communication](#communication). |

#### V13.2 Backend Communication Configuration

| ID      | Level | Result         | Notes                                                                                                                                                               |
| ------- | ----- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V13.2.1 | 2     | Not applicable | There are no backend components besides the embedded SQLite database; SMTP is an external service that is authenticated with its own credentials over TLS.          |
| V13.2.2 | 2     | Pass           | The container runs as the unprivileged `node` user with a read-only root filesystem, no capabilities and `no-new-privileges`; only `/data` and `/tmp` are writable. |
| V13.2.3 | 2     | Pass           | There are no default credentials; SMTP credentials and all secrets must be supplied by the operator.                                                                |
| V13.2.4 | 2     | Pass           | Outbound connections go only to the configured SMTP server and to webhook targets that staff added to the allowlist in the panel and that pass the SSRF checks.     |
| V13.2.5 | 2     | Pass           | The server fetches nothing else; images, fonts and scripts are all served from the application itself.                                                              |

#### V13.3 Secret Management

| ID      | Level | Result | Notes                                                                                                                                                                                      |
| ------- | ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| V13.3.1 | 2     | Fixed  | Secrets are only read from the environment and never stored in code or images. They can now also be read from files (`*_FILE`), so Docker secrets or another secret store can supply them. |
| V13.3.2 | 2     | Pass   | Only the application process reads the secrets; the container has no other users or services.                                                                                              |

#### V13.4 Unintended Information Leakage

| ID      | Level | Result | Notes                                                                                                                                                                                                                                                                                                  |
| ------- | ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| V13.4.1 | 1     | Pass   | `.git` and development files are excluded by `.dockerignore`; the image contains only the build output, production dependencies and migrations.                                                                                                                                                        |
| V13.4.2 | 2     | Pass   | The image runs the production build with `NODE_ENV=production`; error pages are generic and there are no debug routes.                                                                                                                                                                                 |
| V13.4.3 | 2     | Pass   | The static file server does not list directories; media is served only by ID.                                                                                                                                                                                                                          |
| V13.4.4 | 2     | Pass   | TRACE was already refused before it reached the app; the server entry now answers TRACE, TRACK and CONNECT with 405.                                                                                                                                                                                   |
| V13.4.5 | 2     | Pass   | Only the intended documentation is public: the OpenAPI description of the public API, the product documentation at `/docs`, which describes the product rather than the installation, is marked `noindex` and needs a signed-in user in headless mode, and `/healthz`, which reveals nothing but `ok`. |

### V14 Data Protection

#### V14.1 Data Protection Documentation

| ID      | Level | Result | Notes                                                                                           |
| ------- | ----- | ------ | ----------------------------------------------------------------------------------------------- |
| V14.1.1 | 2     | Fixed  | Sensitive data and its protection levels are documented in [Data protection](#data-protection). |
| V14.1.2 | 2     | Fixed  | The protection requirements per level are documented in the same section.                       |

#### V14.2 General Data Protection

| ID      | Level | Result | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------- | ----- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V14.2.1 | 1     | Fixed  | API keys in query strings are rejected and session tokens travel only in cookies. One-time account links must carry their token in the address because they are emailed or copied; following the OWASP Forgot Password Cheat Sheet they are single-use, short-lived and hashed at rest, the app never logs URLs, and their pages now send `Referrer-Policy: same-origin`, so the address never reaches other sites, and `Cache-Control: no-store`. |
| V14.2.2 | 2     | Pass   | Panel responses are `no-store`, API responses `private, no-cache`, and error responses `no-store`; only public content and media are cacheable.                                                                                                                                                                                                                                                                                                    |
| V14.2.3 | 2     | Pass   | No analytics, trackers or third-party resources; the Content Security Policy only allows the application itself and the two video players.                                                                                                                                                                                                                                                                                                         |
| V14.2.4 | 2     | Pass   | The controls in [Data protection](#data-protection) are implemented as described there.                                                                                                                                                                                                                                                                                                                                                            |

#### V14.3 Client-side Data Protection

| ID      | Level | Result | Notes                                                                                                                                             |
| ------- | ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| V14.3.1 | 1     | Fixed  | The panel keeps no data in browser storage, and panel pages are `no-store`. Signing out now also sends `Clear-Site-Data: "cache", "storage"`.     |
| V14.3.2 | 2     | Pass   | Panel responses are `Cache-Control: no-store`.                                                                                                    |
| V14.3.3 | 2     | Pass   | Browser storage is not used; cookies hold only the session token, the short-lived second-factor challenge and the language and theme preferences. |

### V15 Secure Coding and Architecture

#### V15.1 Secure Coding and Architecture Documentation

| ID      | Level | Result | Notes                                                                                                                                                                                   |
| ------- | ----- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V15.1.1 | 1     | Fixed  | Remediation time frames for vulnerable dependencies are now documented in SECURITY.md.                                                                                                  |
| V15.1.2 | 2     | Fixed  | A CycloneDX SBOM of the production dependencies is generated with `npm sbom` and included in every image; all packages come from the npm registry and are pinned with integrity hashes. |
| V15.1.3 | 2     | Fixed  | Resource-intensive functions and their limits are documented in [Resource-intensive functions](#resource-intensive-functions).                                                          |

#### V15.2 Security Architecture and Dependencies

| ID      | Level | Result | Notes                                                                                                                                                                                                                                        |
| ------- | ----- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V15.2.1 | 1     | Fixed  | `npm audit` reported a low-severity issue in `cookie` (bundled by SvelteKit) and a moderate one in an old `esbuild` used only by `drizzle-kit`; both were fixed with version overrides and `npm audit` now reports no known vulnerabilities. |
| V15.2.2 | 2     | Pass   | The documented defenses are implemented: rate limits, size and pixel limits, pagination caps, timeouts, background processing of webhooks and schedules, and a bounded thread pool for image processing and hashing.                         |
| V15.2.3 | 2     | Pass   | The image contains only the production build, production dependencies, migrations and the health check; test helpers are never imported by the application code.                                                                             |

#### V15.3 Defensive Coding

| ID      | Level | Result | Notes                                                                                                                                                                      |
| ------- | ----- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V15.3.1 | 1     | Pass   | Every response is built from explicit view objects; API keys, secrets and hashes never leave the server, and the API returns only public fields.                           |
| V15.3.2 | 2     | Pass   | Webhook requests never follow redirects; there are no other outgoing HTTP requests.                                                                                        |
| V15.3.3 | 2     | Pass   | Each action parses only its own fields with a Zod schema and passes explicit values to the database; request objects are never spread into database writes.                |
| V15.3.4 | 2     | Pass   | Client addresses come only from the header configured with `ADDRESS_HEADER` and `XFF_DEPTH`, which [Deployment](deployment.md#client-addresses) ties to the trusted proxy. |
| V15.3.5 | 2     | Fixed  | TypeScript runs in strict mode and Zod turns input into typed values; the ESLint rule `eqeqeq` now forbids loose equality.                                                 |
| V15.3.6 | 2     | Pass   | Form fields are collected in a `Map`, lookups keyed by input use `Map` or `Set`, and parsed JSON is validated before use; nothing merges untrusted objects into others.    |
| V15.3.7 | 2     | Pass   | Form fields take the first value of a name, API query parameters are parsed strictly, and every parameter is read from one defined source.                                 |

### V16 Security Logging and Error Handling

#### V16.1 Security Logging Documentation

| ID      | Level | Result | Notes                                                       |
| ------- | ----- | ------ | ----------------------------------------------------------- |
| V16.1.1 | 2     | Fixed  | The logging inventory is documented in [Logging](#logging). |

#### V16.2 General Logging

| ID      | Level | Result | Notes                                                                                                                                                                                       |
| ------- | ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V16.2.1 | 2     | Pass   | Log entries carry an ISO timestamp, level and message; audit entries record actor, IP, user agent, action and target; security events add the request ID, method, route and client address. |
| V16.2.2 | 2     | Pass   | Timestamps are UTC (ISO 8601 with `Z` in logs, epoch milliseconds in the database) and come from the host clock.                                                                            |
| V16.2.3 | 2     | Pass   | Logs go only to standard output and to the audit log table, as documented.                                                                                                                  |
| V16.2.4 | 2     | Pass   | JSON lines with a fixed set of fields, readable by common log processors.                                                                                                                   |
| V16.2.5 | 2     | Pass   | Passwords, tokens, cookies, authorization headers, secrets, TOTP values and backup codes are redacted by key and by pattern before a line is written; audit details never contain secrets.  |

#### V16.3 Security Events

| ID      | Level | Result | Notes                                                                                                                                                                                                             |
| ------- | ----- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V16.3.1 | 2     | Pass   | Successful sign-ins, failures, lockouts and sign-outs are audited with the stage and method (password, TOTP, backup code) and the client address.                                                                 |
| V16.3.2 | 2     | Fixed  | Refused permission checks are now logged as security events with actor, action and route.                                                                                                                         |
| V16.3.3 | 2     | Fixed  | Security events are now logged for rate limits, rejected API credentials and scopes, API keys in query strings, refused CORS preflights, reused TOTP codes, failed re-authentication and blocked webhook targets. |
| V16.3.4 | 2     | Pass   | Unexpected errors are logged with a correlation ID; failed webhook deliveries, including TLS errors, and failed emails are logged and shown to staff.                                                             |

#### V16.4 Log Protection

| ID      | Level | Result | Notes                                                                                                                                                                                                                       |
| ------- | ----- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V16.4.1 | 2     | Pass   | Logs are JSON-encoded by pino, and audit entries are stored as data and escaped when shown.                                                                                                                                 |
| V16.4.2 | 2     | Pass   | The audit log is append-only: database triggers reject updates and deletes, there is no code path or UI for removal, and only the founder and admins can read it.                                                           |
| V16.4.3 | 2     | Fixed  | Audit entries were only in the database; they are now also written to standard output together with the security events, and [Operations](operations.md#logs) recommends shipping standard output to a separate log system. |

#### V16.5 Error Handling

| ID      | Level | Result | Notes                                                                                                                                          |
| ------- | ----- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| V16.5.1 | 2     | Pass   | Unexpected errors show a generic message with a correlation ID; the API answers with a generic `internal_error`.                               |
| V16.5.2 | 2     | Pass   | Email is sent in the background and failures never block a flow; webhooks are queued and retried; the health check reports the database state. |
| V16.5.3 | 2     | Pass   | Permission checks deny by default, validation failures stop the action, and database writes run in transactions that roll back on errors.      |

### V17 WebRTC

#### V17.1 TURN Server

| ID      | Level | Result         | Notes      |
| ------- | ----- | -------------- | ---------- |
| V17.1.1 | 2     | Not applicable | No WebRTC. |

#### V17.2 Media

| ID      | Level | Result         | Notes      |
| ------- | ----- | -------------- | ---------- |
| V17.2.1 | 2     | Not applicable | No WebRTC. |
| V17.2.2 | 2     | Not applicable | No WebRTC. |
| V17.2.3 | 2     | Not applicable | No WebRTC. |
| V17.2.4 | 2     | Not applicable | No WebRTC. |

#### V17.3 Signaling

| ID      | Level | Result         | Notes      |
| ------- | ----- | -------------- | ---------- |
| V17.3.1 | 2     | Not applicable | No WebRTC. |
| V17.3.2 | 2     | Not applicable | No WebRTC. |
