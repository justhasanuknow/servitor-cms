# Servitor CMS

Servitor CMS is an open-source, self-hostable CMS for blog posts and articles.

> Servitor CMS is under active development and not ready for production use.

## Features

- Write posts in multiple content languages from a single editing screen.
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

| Variable                                                                           | Required       | Default             | Notes                                                                                     |
| ---------------------------------------------------------------------------------- | -------------- | ------------------- | ----------------------------------------------------------------------------------------- |
| `ORIGIN`                                                                           | Yes            |                     | Public URL, for example `https://cms.example.com`. Also used as the Better Auth base URL. |
| `BETTER_AUTH_SECRET`                                                               | Yes            |                     | At least 32 random characters.                                                            |
| `DATABASE_PATH`                                                                    | No             | `/data/servitor.db` | SQLite database file.                                                                     |
| `UPLOADS_DIR`                                                                      | No             | `/data/uploads`     | Uploaded media.                                                                           |
| `FOUNDER_EMAIL`                                                                    | First start    |                     | Used only to create the founder account.                                                  |
| `FOUNDER_NAME`                                                                     | First start    |                     | Used only to create the founder account.                                                  |
| `FOUNDER_PASSWORD`                                                                 | First start    |                     | Used only to create the founder account. Must pass the password policy.                   |
| `DEFAULT_CONTENT_LANGUAGE`                                                         | No             | `en`                | Initial default content language, used only on the first start.                           |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_SECURE` | No             |                     | Enables email when all are set. A partial set keeps email off and logs a warning.         |
| `WEBHOOK_ALLOW_PRIVATE`                                                            | No             | `false`             | Allows webhooks to private network targets.                                               |
| `ADDRESS_HEADER`, `XFF_DEPTH`                                                      | Behind a proxy |                     | Client IP detection for rate limiting.                                                    |
| `LOG_LEVEL`                                                                        | No             | `info`              | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`.                           |

## API usage

The read-only REST API will be documented once it is implemented.

## Webhook signature verification

Webhook signature verification will be documented once webhooks are implemented.

## Backups and restore

Backups and restore will be documented once the command line tools are implemented.

## Security notes

Security notes will be completed as the security features are implemented.

## License

Servitor CMS is licensed under the [Apache License 2.0](LICENSE). Derivative works must preserve the [NOTICE](NOTICE) file.
