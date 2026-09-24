# Installation

This guide installs Servitor CMS with Docker Compose, the recommended way to run it. At the end you have a running installation and a founder account. [Deployment](deployment.md) then explains how to publish it on your domain with TLS.

## Requirements

- A server or computer with Docker Engine and the Docker Compose plugin. Any system that runs Linux containers works, including Docker Desktop on Windows and macOS.
- At least 1 CPU core and 1 GB of memory. Image processing and password hashing are the most demanding tasks; more memory helps when several people upload large images at the same time.
- Disk space for the database and your images. The database stays small; each uploaded image is stored in four WebP sizes.
- For production: a domain name and a reverse proxy that terminates TLS, such as Caddy, Traefik, Nginx or Coolify.

## 1. Get the code

Clone the repository and change into it:

```bash
git clone https://github.com/justhasanuknow/servitor-cms.git
cd servitor-cms
```

## 2. Create the configuration

Copy the commented template:

```bash
cp .env.example .env
```

Open `.env` and set at least these values:

| Variable             | What to enter                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `ORIGIN`             | The public address, for example `https://cms.example.com`, without a path or a trailing slash. |
| `BETTER_AUTH_SECRET` | At least 32 random characters. Generate them with the command below.                           |
| `FOUNDER_EMAIL`      | The email address of the founder account.                                                      |
| `FOUNDER_NAME`       | The display name of the founder.                                                               |
| `FOUNDER_PASSWORD`   | A first password for the founder. You have to replace it at the first sign-in.                 |

Generate a secret:

```bash
openssl rand -hex 32
```

Keep `DATABASE_PATH=/data/servitor.db` and `UPLOADS_DIR=/data/uploads`: `/data` is the volume that holds all data. The founder password must follow the same rules as every password: 12 to 128 characters, not a common password, and not built mainly from the product name, the site name or the founder's own name or email address.

To try Servitor on your own computer without a reverse proxy, use these values instead:

```ini
ORIGIN=http://localhost:3000
ADDRESS_HEADER=
XFF_DEPTH=
```

A minimal `.env` for a production server looks like this:

```ini
ORIGIN=https://cms.example.com
BETTER_AUTH_SECRET=replace-with-the-output-of-openssl-rand-hex-32
DATABASE_PATH=/data/servitor.db
UPLOADS_DIR=/data/uploads
BODY_SIZE_LIMIT=12M
FOUNDER_EMAIL=owner@example.com
FOUNDER_NAME=Ada Lovelace
FOUNDER_PASSWORD=choose-a-long-first-passphrase
DEFAULT_CONTENT_LANGUAGE=en
ADDRESS_HEADER=x-forwarded-for
XFF_DEPTH=1
LOG_LEVEL=info
```

Every variable is described in [Configuration](configuration.md). Email is optional and can be added later, see [Email](email.md).

## 3. Build and start

```bash
docker compose up -d --build
```

The first start builds the image, creates the database, applies all migrations, creates the default content language and the founder account, and starts listening on port 3000. Later starts apply pending migrations automatically before the app accepts requests.

The Compose file publishes the port only on `127.0.0.1`, so the app is reachable from the server itself and from the reverse proxy, but not directly from the internet.

## 4. Check that it runs

The container reports its health through `GET /healthz`:

```bash
docker compose ps
```

```bash
curl http://127.0.0.1:3000/healthz
```

A healthy installation answers `{"status":"ok"}`. If the container keeps restarting, read the log:

```bash
docker compose logs servitor
```

The most common reason is an invalid environment: the app lists every problem and refuses to start until you fix them. [Troubleshooting](troubleshooting.md#the-app-refuses-to-start) explains the messages.

## 5. Sign in

Open `/panel/login` on your `ORIGIN` and sign in with `FOUNDER_EMAIL` and `FOUNDER_PASSWORD`. Before anything else the panel asks for a new password. Once the founder exists, the `FOUNDER_*` variables are ignored; you can remove the password from `.env`.

Good first steps:

1. Turn on two-factor authentication under **My account → Two-factor authentication**.
2. Check the site name and the other options under **Administration → Settings**.
3. Add the languages you write in under **Content → Languages**.
4. Invite your team under **Administration → Users**.

## Managing the container

Stop and start the app without losing data:

```bash
docker compose stop
```

```bash
docker compose start
```

`docker compose down` removes the container but keeps the `servitor-data` volume. Never add `--volumes` unless you really want to delete all data. Take a [backup](operations.md#backups) before any change you are unsure about.

## Running without Docker

Servitor also runs directly on Node.js 24:

```bash
npm ci
```

```bash
npm run build
```

```bash
node --env-file=.env build/server.js
```

Point `DATABASE_PATH` and `UPLOADS_DIR` to directories the process may write, set `BODY_SIZE_LIMIT=12M`, and keep the process running with a service manager. A systemd unit could look like this:

```ini
[Unit]
Description=Servitor CMS
After=network.target

[Service]
WorkingDirectory=/opt/servitor-cms
EnvironmentFile=/opt/servitor-cms/.env
ExecStart=/usr/bin/node build/server.js
User=servitor
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

`build/server.js` listens on `HOST` and `PORT` (default `0.0.0.0:3000`). Bind it to `127.0.0.1` when the reverse proxy runs on the same machine. For development with hot reloading, see [Development](development.md).
