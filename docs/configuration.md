# Configuration

Servitor CMS is configured entirely through environment variables. With Docker Compose they come from the `.env` file next to `docker-compose.yml`; `.env.example` is a commented template. The same file also sets `SERVITOR_VERSION`, which only Compose reads to choose the version of the image, see [Installation](installation.md#3-start).

The environment is validated on every start. When a required variable is missing or a value is invalid, the app logs every problem at once and refuses to start. Secret values are never printed in these messages. An empty value counts as not set.

## Required variables

### ORIGIN

The public address of the installation, with scheme and host and an optional port, but without a path or a trailing slash:

```ini
ORIGIN=https://cms.example.com
```

Servitor uses it to reject form submissions from other sites, to build absolute links in emails, feeds, sitemaps and API responses, and to decide how cookies are protected. With an `https` origin, cookies are `Secure` and use the `__Host-` prefix. Open the panel exactly at this address: a different host name, such as `127.0.0.1` instead of `localhost`, makes sign-in fail.

### BETTER_AUTH_SECRET

A random value of at least 32 characters:

```bash
openssl rand -hex 32
```

It signs session cookies and encrypts the stored two-factor secrets and webhook secrets. Keep it private and never change it by simply replacing the value; follow [Rotating the secret](operations.md#rotating-the-secret) instead, or all users are signed out and stored secrets become unreadable.

## Data locations

| Variable        | Default             | Purpose                                                                |
| --------------- | ------------------- | ---------------------------------------------------------------------- |
| `DATABASE_PATH` | `/data/servitor.db` | The SQLite database file. Backups are written next to it in `backups`. |
| `UPLOADS_DIR`   | `/data/uploads`     | The processed images of the media library.                             |

Keep both inside the same volume so that one backup covers everything.

## First start

These variables are read only while no founder account exists.

| Variable                   | Purpose                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| `FOUNDER_EMAIL`            | Email address of the founder account.                                                                     |
| `FOUNDER_NAME`             | Display name of the founder.                                                                              |
| `FOUNDER_PASSWORD`         | First password. It must pass the password policy and has to be replaced at the first sign-in.             |
| `DEFAULT_CONTENT_LANGUAGE` | BCP 47 code of the first content language, `en` when empty. Later, the default is chosen in the settings. |

## Email

Email turns on only when all six variables are set; a partial set keeps email off and logs a warning.

| Variable        | Example                                                      |
| --------------- | ------------------------------------------------------------ |
| `SMTP_HOST`     | `smtp.example.com`                                           |
| `SMTP_PORT`     | `587`                                                        |
| `SMTP_USER`     | `noreply@example.com`                                        |
| `SMTP_PASSWORD` | the password of the SMTP account                             |
| `SMTP_FROM`     | `Example Blog <noreply@example.com>`                         |
| `SMTP_SECURE`   | `false` for STARTTLS on port 587, `true` for TLS on port 465 |

`SMTP_FROM` must contain an email address, optionally with a display name in front of it. See [Email](email.md) for details.

## Network and reverse proxy

| Variable                | Default   | Purpose                                                                                                                      |
| ----------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `ADDRESS_HEADER`        |           | Header that carries the client address, usually `x-forwarded-for`. Set it only when every request passes through your proxy. |
| `XFF_DEPTH`             |           | Number of trusted proxies in front of the app when `ADDRESS_HEADER` is `x-forwarded-for`, usually `1`.                       |
| `BODY_SIZE_LIMIT`       | `512K`    | Largest accepted request body. The container sets `12M` so that 10 MB images can be uploaded.                                |
| `HOST`                  | `0.0.0.0` | Address the server listens on.                                                                                               |
| `PORT`                  | `3000`    | Port the server listens on.                                                                                                  |
| `SHUTDOWN_TIMEOUT`      | `30`      | Seconds to wait for open requests before a stopping server closes the remaining connections.                                 |
| `WEBHOOK_ALLOW_PRIVATE` | `false`   | Allows webhooks to targets in private networks, including plain `http` to them. See [Webhooks](webhooks.md#allowed-targets). |

Without `ADDRESS_HEADER`, Servitor sees the address of the proxy as the client of every request, which makes rate limits and the audit log much less useful. With it, but with the app reachable directly, clients could send a forged header. [Deployment](deployment.md#client-addresses) explains the right setup.

## Logging

`LOG_LEVEL` sets the minimum level of the JSON log: `fatal`, `error`, `warn`, `info` (default), `debug`, `trace` or `silent`. See [Operations](operations.md#logs) for what is logged.

## Secret rotation

`BETTER_AUTH_PREVIOUS_SECRETS` holds retired values of `BETTER_AUTH_SECRET`, separated by commas, at most eight of them and each at least 32 characters long. Stored secrets that were encrypted with one of them stay readable and are encrypted again with the current secret on the next start. See [Rotating the secret](operations.md#rotating-the-secret).

## Reading secrets from files

`BETTER_AUTH_SECRET`, `BETTER_AUTH_PREVIOUS_SECRETS`, `SMTP_PASSWORD` and `FOUNDER_PASSWORD` can also be read from files, so that they come from Docker secrets or another secret store instead of the environment. Add `_FILE` to the name and point it to the file:

```ini
BETTER_AUTH_SECRET_FILE=/run/secrets/servitor_auth_secret
```

A trailing newline in the file is ignored. Setting both a variable and its `_FILE` variant is an error. With Docker Compose, a secret can be mounted like this:

```yaml
services:
  servitor:
    environment:
      BETTER_AUTH_SECRET_FILE: /run/secrets/servitor_auth_secret
    secrets:
      - servitor_auth_secret

secrets:
  servitor_auth_secret:
    file: ./secrets/auth_secret.txt
```

## Validation rules at a glance

- `ORIGIN` must be an `http` or `https` origin without a path.
- `BETTER_AUTH_SECRET` must have 32 to 1,024 characters.
- `SMTP_PORT` must be a whole number from 1 to 65535, `XFF_DEPTH` a whole number of at least 1.
- `SMTP_SECURE` and `WEBHOOK_ALLOW_PRIVATE` accept only `true` or `false`.
- `DEFAULT_CONTENT_LANGUAGE` must be a valid BCP 47 language tag.
- `ADDRESS_HEADER` must be a valid HTTP header name.
