# Security

Servitor CMS is built to be safe to run on the public internet with little configuration. This page summarizes the protections; the complete review against OWASP ASVS 5.0 levels 1 and 2 is in [Security review](SECURITY-REVIEW.md). To report a vulnerability, follow `SECURITY.md` in the repository instead of opening a public issue.

## Accounts and sign-in

- There is no public sign-up. Accounts come from the founder seed and from invitations.
- Passwords have 12 to 128 characters, no composition rules and no expiry. They must not appear in the bundled lists from [SecLists](https://github.com/danielmiessler/SecLists): the 10,000 most common passwords and the 43,940 passwords of 12 to 128 characters among the million most common, breach-derived passwords. The product and role names, the site name, the host name and the user's own name and email address do not count toward the minimum length, including look-alike spellings such as `S3rv1t0r`.
- Passwords are hashed with scrypt (N = 2^15, r = 8, p = 3) in a format that names its parameters; older hashes are upgraded after the next sign-in.
- Sign-in is limited to 3 attempts per client in 10 seconds, and an account is paused for 15 minutes after 10 failures. The pause is temporary on purpose, so that an attacker cannot lock a user out for good. Lockouts and failed sign-ins are written to the audit log, and the answers for unknown accounts and wrong passwords are identical.
- Two-factor authentication uses TOTP authenticator apps, and every code works only once. Every user gets 10 single-use backup codes with 120 bits of randomness, stored only as SHA-256 hashes. A setting requires two-factor authentication for the founder and admins.
- Sensitive actions ask for the password again, and for a code when two-factor authentication is on.

## Sessions

- Session cookies are `HttpOnly`, `SameSite=Lax` and host-only. With an `https` origin they are `Secure` and use the `__Host-` prefix, so no other host, not even a subdomain, can set them.
- Sessions end after 7 days of inactivity and at the latest 30 days after the sign-in. Users can see and end their sessions. Changing or resetting the password, turning off two-factor authentication, a role change, deactivation and the `sign-out` command end sessions as well.
- Signing out asks the browser to clear cached data of the site.

## Permissions

- All permission checks run on the server in one module, and every page, action and endpoint uses it. A test covers every cell of the permission matrix, including refusals.
- Ownership is checked against the database, never taken from the request.
- Refused permission checks are logged as security events.

## Content

- Post content is stored as editor JSON, validated against an allowlist of blocks, marks and attributes, rendered to HTML on the server and sanitized again before it is stored.
- Links may use only `http`, `https`, `mailto` or relative addresses; images must come from the media library; videos only from YouTube and Vimeo in a sandboxed frame. Math is rendered with KaTeX with trusted commands turned off.
- Uploaded images are recognised by their content and re-encoded to WebP; SVG is refused and metadata removed. The original upload is never served.
- Image addresses are unguessable but public, see [Privacy of image addresses](media.md#privacy-of-image-addresses).
- Structured data on the public pages is escaped so that it cannot break out of its script element.

## Browser protection

- Every response, static files included, carries a Content Security Policy that forbids framing, plugins and `<base>` elements. Pages load scripts only from the site itself, inline scripts need a per-request nonce, and the public pages and this documentation ship without any script.
- `X-Content-Type-Options: nosniff`, a referrer policy, `Permissions-Policy`, `Cross-Origin-Opener-Policy` and, in production, `Strict-Transport-Security` are sent with every response. Pages that carry a one-time link in their address never send it to other sites as a referrer.
- Form submissions from other sites are rejected, and state never changes on a `GET` request.

## Integrations

- API keys and one-time links are stored only as hashes. API keys in the query string are refused, because addresses end up in logs.
- The API is read-only and exposes only published content. Browsers can use it only from origins on the exact-match allowlist, without credentials.
- Webhooks are signed with HMAC-SHA256, sent only to addresses that pass the SSRF checks, never follow redirects and have a short timeout.
- Two-factor secrets and webhook secrets are encrypted at rest under keys derived from `BETTER_AUTH_SECRET`, which can be rotated without losing data.

## Operations

- The environment is validated on start; the app refuses to run with a missing or too short secret.
- Secrets can come from files, for example Docker secrets.
- The container runs as an unprivileged user with a read-only root filesystem, no capabilities and `no-new-privileges`.
- Outgoing email requires TLS.
- The audit log is append-only, enforced by the database, and also written to the application log. Passwords, tokens, keys and secrets are redacted from every log line.
- Rate limits, lockouts and the background jobs live in the application process, so exactly one instance runs per data directory.
- Backups are consistent snapshots without sessions or verification tokens. Restores check archives, including the database schema against its migration history, before touching any data.
- Only the founder with two-factor authentication can use backups in the panel. Downloads, restores, deletions and schedule changes need a fresh confirmation, every action is audited, and a download emails the founder. Downloads can be encrypted with a passphrase.
- Dependencies are monitored by Dependabot, checked in continuous integration and listed in a software bill of materials inside the image.

## Your part

- Keep `BETTER_AUTH_SECRET` secret and rotate it yearly.
- Run the app behind a TLS proxy and keep port 3000 private.
- Turn on two-factor authentication for every staff account and require it in the settings.
- Take backups, copy them off the server and protect them like the live data.
- Ship the [logs](operations.md#logs) to a separate system if the records must survive a compromise of the server.
- Update to new versions promptly.
- Give API keys the smallest scope that works and revoke keys that are no longer used.
