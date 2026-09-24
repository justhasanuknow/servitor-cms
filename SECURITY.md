# Security Policy

## Supported versions

Security fixes are made for the latest release. Please update to it before reporting an issue.

## Reporting a vulnerability

Please do not open a public issue for security problems. Report them privately through GitHub's private vulnerability reporting: open the **Security** tab of the repository and choose **Report a vulnerability**.

Include what you found, the steps to reproduce it, the affected version and the impact you expect. You will get an answer within a week. We will work with you on a fix and credit you in the release notes if you wish.

## Scope

In scope are the application in this repository, its container image and the documented deployment with `docker-compose.yml`. Out of scope are issues that need a compromised server or administrator account, missing hardening of the reverse proxy in front of the app, denial of service by volume, and findings in outdated versions.

## Security model

- Accounts exist only through the founder seed and invitations. Passwords are hashed with scrypt, must be 12 to 128 characters long and must not be common passwords. Sign-in is rate limited per client and locked temporarily per account after repeated failures.
- Two-factor authentication with TOTP and single-use backup codes is available to everyone and can be required for the founder and admins.
- Sensitive changes, such as a new password, email address, role, API key or webhook secret, require the current password and, when enabled, a current authenticator code.
- Every permission check runs on the server in one module. Post content is validated against an allowlist, rendered on the server and sanitized before it is stored; the public pages ship without JavaScript and a nonce-based Content Security Policy is sent everywhere.
- API keys and one-time tokens are stored only as hashes. Webhook secrets are encrypted at rest. Webhooks are sent only to addresses that pass the SSRF checks and are signed with HMAC-SHA256.
- The audit log is append-only and records sign-ins, account changes, content workflow, moderation and configuration changes.

See the security notes in the README for details, and keep the container behind a TLS-terminating reverse proxy as described there.
