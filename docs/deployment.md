# Deployment

In production, Servitor CMS runs as one container behind a reverse proxy that terminates TLS. This page explains how to connect the two, how client addresses reach the app, and how to update, monitor and size an installation.

## Overview

```text
Browser / API client --HTTPS--> Reverse proxy --HTTP--> Servitor container (127.0.0.1:3000) --> /data volume
```

- The proxy owns the certificate and the public ports 80 and 443.
- The container listens on port 3000, published only on `127.0.0.1` by `docker-compose.yml`.
- All state lives in the `servitor-data` volume mounted at `/data`.

The container runs as an unprivileged user with a read-only root filesystem, no Linux capabilities and `no-new-privileges`; only `/data` and a temporary `/tmp` are writable. Keep these settings when you adapt the Compose file.

## Before you go live

1. `ORIGIN` is the public `https` address.
2. `BETTER_AUTH_SECRET` is a fresh random value that exists only on this server and in your secret store.
3. The proxy serves only TLS 1.2 and 1.3 with a publicly trusted certificate.
4. `ADDRESS_HEADER` and `XFF_DEPTH` match your proxy, and port 3000 is not reachable from the internet.
5. The proxy accepts request bodies of at least 12 MB.
6. Backups run regularly and are copied off the server, see [Operations](operations.md#backups).
7. The founder has turned on two-factor authentication, and **Require two-factor authentication for the founder and admins** is on in the settings.

## Reverse proxy

### Caddy

Caddy obtains and renews certificates automatically. The first block serves the app; the second replaces Caddy's automatic redirect so that pages are redirected to `https` while plain `http` API calls fail instead of being redirected:

```text
cms.example.com {
    reverse_proxy 127.0.0.1:3000
}

http://cms.example.com {
    handle /api/* {
        respond "Use https." 403
    }
    handle {
        redir https://{host}{uri} permanent
    }
}
```

Caddy sends `X-Forwarded-For` by default, so `ADDRESS_HEADER=x-forwarded-for` and `XFF_DEPTH=1` fit. Caddy has no request body limit by default.

### Nginx

```text
server {
    listen 80;
    server_name cms.example.com;

    location /api/ {
        return 403;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    http2 on;
    server_name cms.example.com;

    ssl_certificate /etc/letsencrypt/live/cms.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cms.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 12m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Nginx accepts only 1 MB request bodies by default; `client_max_body_size 12m` is required for image uploads.

### Coolify

Coolify runs the published image behind its own proxy, which obtains the certificate for your domain. Create the service from a Compose file that you paste into Coolify, not from this repository: the repository's `docker-compose.yml` also contains `build: .`, so Coolify would build the image from the source on your server instead of pulling the signed image. The image is public, so Coolify needs no registry credentials.

1. Point your domain to the server with an `A` record, and an `AAAA` record for IPv6, so that Coolify can obtain the certificate.
2. In your project, choose **+ New → Docker Compose Empty** and paste this file:

   ```yaml
   services:
     servitor:
       image: ghcr.io/justhasanuknow/servitor-cms:0.2.1
       environment:
         ORIGIN: ${ORIGIN:?}
         BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET:?}
         FOUNDER_EMAIL: ${FOUNDER_EMAIL}
         FOUNDER_NAME: ${FOUNDER_NAME}
         FOUNDER_PASSWORD: ${FOUNDER_PASSWORD}
         DEFAULT_CONTENT_LANGUAGE: ${DEFAULT_CONTENT_LANGUAGE:-en}
         ADDRESS_HEADER: ${ADDRESS_HEADER:-x-forwarded-for}
         XFF_DEPTH: ${XFF_DEPTH:-1}
         SMTP_HOST: ${SMTP_HOST}
         SMTP_PORT: ${SMTP_PORT}
         SMTP_USER: ${SMTP_USER}
         SMTP_PASSWORD: ${SMTP_PASSWORD}
         SMTP_FROM: ${SMTP_FROM}
         SMTP_SECURE: ${SMTP_SECURE}
       volumes:
         - servitor-data:/data
       restart: unless-stopped
       read_only: true
       tmpfs:
         - /tmp
       security_opt:
         - no-new-privileges:true
       cap_drop:
         - ALL
       healthcheck:
         test: ['CMD', 'node', 'healthcheck.mjs']
         interval: 30s
         timeout: 5s
         retries: 3
         start_period: 20s

   volumes:
     servitor-data:
   ```

3. Enter `https://cms.example.com:3000` in the **Domains** field of the `servitor` service. The port tells Coolify's proxy where the container listens; visitors still open `https://cms.example.com`.
4. Fill in the variables that Coolify lists under **Environment Variables**. It does not deploy until the two required ones have values.
   - `ORIGIN` is the domain without the port: `https://cms.example.com`.
   - `BETTER_AUTH_SECRET` is a new value from `openssl rand -hex 32`. Keep a copy outside Coolify, because restoring a backup needs it.
   - The `FOUNDER_*` variables are read on the first start only. Clear `FOUNDER_PASSWORD` once you have signed in.
   - Leave the `SMTP_*` variables empty until you set up [email](email.md).
5. Deploy. The service turns healthy once `/healthz` answers, and you can sign in at `https://cms.example.com/panel/login`.

The file keeps the protections of the shipped Compose file and leaves out `ports:`, because Coolify's proxy reaches the container over Coolify's own network. `DATABASE_PATH`, `UPLOADS_DIR` and `BODY_SIZE_LIMIT` come from the image. Do not copy a development `.env` into Coolify: a relative path such as `DATABASE_PATH=./data/servitor.db` points into the read-only image instead of the volume, and the app stops at every start, see [Troubleshooting](troubleshooting.md#the-app-refuses-to-start).

Coolify's proxy is a single hop, so `ADDRESS_HEADER=x-forwarded-for` and `XFF_DEPTH=1` fit; with Cloudflare's proxy in front of it, set `XFF_DEPTH=2`. Coolify redirects plain `http` requests to `https` on every path, `/api/` included, so give API clients `https` addresses.

To update, take a backup, change the image tag to the new version and deploy again. Coolify keeps the `servitor-data` volume across deployments; if you delete the resource, keep its volumes unless you want to delete all data. Backups are written to the same volume, so copy them off the server as described in [Operations](operations.md#backups).

## TLS and plain HTTP

Serve only TLS 1.2 and 1.3 with a publicly trusted certificate; Caddy, Traefik and Coolify do this by default. Servitor sends `Strict-Transport-Security` with a two-year lifetime including subdomains, so browsers never fall back to plain HTTP once they have seen the site.

Redirect plain `http` requests for pages to `https`, but do not redirect `/api/`. An API client configured with an `http` address would otherwise send its key in clear text before being redirected; answering with an error makes the mistake visible.

## Client addresses

Rate limits, account lockouts, the session list and the audit log rely on the real client address. Behind a proxy every request comes from the proxy, so the proxy passes the original address in `X-Forwarded-For` and Servitor reads it:

- `ADDRESS_HEADER=x-forwarded-for` tells Servitor which header to read.
- `XFF_DEPTH` is the number of proxies you run in front of the app. Servitor takes the address that many positions from the end of the header, which is the one your outermost proxy added. Entries further left come from the client and are ignored.

If two proxies are chained, for example a CDN in front of Nginx, set `XFF_DEPTH=2`. The app must be reachable only through the proxy; otherwise a client could send its own `X-Forwarded-For` header. The Compose file binds the port to `127.0.0.1` for this reason.

## Security headers

Servitor sets its own security headers on every response, including static files: a strict Content Security Policy, `X-Content-Type-Options`, a referrer policy, `Permissions-Policy`, `Cross-Origin-Opener-Policy` and `Strict-Transport-Security`. The proxy does not need to add them and should not remove or replace them.

## Updating

New versions are published as releases on GitHub, and `CHANGELOG.md` lists what each one changes. Read the notes of every version between yours and the new one before you update; before 1.0.0, a minor version may need changes to your configuration.

Servitor applies database migrations automatically on start. Migrations only move forward, so take a backup first:

```bash
docker compose exec servitor node build/cli.js backup
```

Then check out the tag of the new version, so that `docker-compose.yml` and `.env.example` match it, for example for 0.2.1:

```bash
git fetch --tags
```

```bash
git checkout v0.2.1
```

Compare `.env.example` with your `.env`, set `SERVITOR_VERSION` to the new version, and pull and start the image:

```bash
docker compose pull
```

```bash
docker compose up -d
```

If you pinned a minor line such as `0.2`, `docker compose pull` alone picks up its newest patch release. Check `/healthz` and sign in afterwards. To go back to the previous version, set `SERVITOR_VERSION` back, start the app and restore the backup you took, as described in [Restoring a backup](operations.md#restoring-a-backup).

## Health and monitoring

- `GET /healthz` answers `{"status":"ok"}` when the database is reachable and `503` otherwise. The Compose health check calls it every 30 seconds.
- Point an external uptime monitor at `https://cms.example.com/healthz`.
- The JSON log on standard output contains errors, security events and audit entries, see [Logs](operations.md#logs).

Limit the size of Docker's log files, for example:

```yaml
services:
  servitor:
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: '5'
```

## Scaling and resources

Servitor runs as a single instance per data directory, because rate limits, lockouts, the publishing scheduler and the webhook worker live inside the process. Scale up with more CPU and memory rather than more containers. A small installation runs comfortably with 1 CPU and 1 GB of memory; image uploads and password checks are the most demanding operations and are limited per user and per client.
