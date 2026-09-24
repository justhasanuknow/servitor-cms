# Security Policy

## Supported versions

Security fixes are made for the latest release. Please update to it before reporting an issue.

## Reporting a vulnerability

Please do not open a public issue for security problems. Report them privately through GitHub's private vulnerability reporting: open the **Security** tab of the repository and choose **Report a vulnerability**.

Include what you found, the steps to reproduce it, the affected version and the impact you expect. You will get an answer within a week. We will work with you on a fix and credit you in the release notes if you wish.

## Scope

In scope are the application in this repository, its container image and the documented deployment with `docker-compose.yml`. Out of scope are issues that need a compromised server or administrator account, missing hardening of the reverse proxy in front of the app, denial of service by volume, and findings in outdated versions.

## Dependencies

Dependencies come only from the npm registry and are pinned by `package-lock.json` with integrity hashes. Dependabot proposes updates for npm packages, GitHub Actions and the base image every week, continuous integration fails on any known vulnerability of high or critical severity, and every image contains a CycloneDX software bill of materials at `/app/sbom.cdx.json` (`npm run --silent sbom` prints it for a checkout).

Known vulnerabilities in dependencies are fixed within these time frames after a fix or a workaround is available:

| Severity         | Time frame                        |
| ---------------- | --------------------------------- |
| Critical or high | 7 days, in a patch release        |
| Moderate         | 30 days                           |
| Low              | 90 days, or with the next release |

A vulnerability that cannot be reached in Servitor CMS, for example one in a development tool that never runs in production, is documented in the release notes and fixed with the next regular update. Dependencies without an update for two years are reviewed and replaced when a maintained alternative exists.

## Security model

- Accounts exist only through the founder seed and invitations. Passwords are hashed with scrypt, must be 12 to 128 characters long, must not be common or breached passwords and must not rely on the product, site or user names. Sign-in is rate limited per client and locked temporarily per account after repeated failures.
- Two-factor authentication with single-use TOTP codes and 120-bit backup codes is available to everyone and can be required for the founder and admins.
- Sessions live in `__Host-` cookies, end after 7 days of inactivity and at the latest 30 days after the sign-in, and can be ended by the user, by deactivating the account or with the `sign-out` command.
- Sensitive changes, such as a new password, email address, role, API key or webhook secret, require the current password and, when enabled, a current authenticator code.
- Every permission check runs on the server in one module. Post content is validated against an allowlist, rendered on the server and sanitized before it is stored; the public pages ship without JavaScript and a nonce-based Content Security Policy is sent everywhere.
- API keys and one-time tokens are stored only as hashes. Two-factor and webhook secrets are encrypted at rest under keys derived from `BETTER_AUTH_SECRET`, which can be rotated without losing data. Webhooks are sent only to addresses that pass the SSRF checks and are signed with HMAC-SHA256.
- The audit log is append-only and records sign-ins, account changes, content workflow, moderation and configuration changes. Audit entries and security events are also written to the JSON log on standard output.

The complete review against OWASP ASVS 5.0 levels 1 and 2 is in [docs/SECURITY-REVIEW.md](docs/SECURITY-REVIEW.md). See the security notes in the README for details, and keep the container behind a TLS-terminating reverse proxy as described there.
