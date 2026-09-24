# Troubleshooting

This page collects common problems and how to solve them. The application log usually tells what went wrong:

```bash
docker compose logs --tail 100 servitor
```

## The app refuses to start

The log shows `Invalid environment configuration` followed by one line per problem, for example:

```text
Invalid environment configuration:
- SMTP_FROM: must be an email address, optionally with a display name such as Servitor <cms@example.com>
```

Fix every listed variable in `.env` and start again. Typical causes:

| Message                                                    | Fix                                                                                                                         |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `ORIGIN: is required` or `must be an http or https origin` | Set `ORIGIN` to an address such as `https://cms.example.com`, without a path or a trailing slash.                           |
| `BETTER_AUTH_SECRET: must be at least 32 characters long`  | Generate a value with `openssl rand -hex 32`.                                                                               |
| `SMTP_FROM: must be an email address`                      | Include the address, for example `Example Blog <noreply@example.com>`, not only a name.                                     |
| `FOUNDER_PASSWORD: ...`                                    | On the first start the founder password must follow the password policy, see [Configuration](configuration.md#first-start). |
| `..._FILE: set either ... or ..._FILE, not both`           | Remove one of the two variables.                                                                                            |

A partial SMTP configuration does not stop the app: it starts with email off and logs which variables are missing.

## Signing in does not work

- **The form is rejected or you are sent back to the sign-in page**: open the panel exactly at the address in `ORIGIN`. `http://127.0.0.1:3000` and `http://localhost:3000` are different origins, and so are `http` and `https`.
- **You stay signed out over plain `http` in production**: with an `https` origin, cookies are only stored over `https`. Always use the `https` address.
- **"Too many attempts"**: each client may try 3 times per 10 seconds. Wait a moment.
- **"Signing in to this account is paused for 15 minutes"**: 10 failed attempts within 15 minutes pause the account. Wait, or have staff create a password reset link.
- **Everybody seems to share one rate limit**: the app sees the proxy as the client of every request. Set `ADDRESS_HEADER` and `XFF_DEPTH`, see [Client addresses](deployment.md#client-addresses).
- **"This sign-in attempt has expired"**: the second step of a sign-in is valid only for a short time. Sign in again.

## Lost second factor

- Use one of your backup codes with **Use a backup code instead**.
- The founder without codes: run `reset-founder`, see [Recovering the founder account](operations.md#recovering-the-founder-account).
- Other users without codes: the founder or an admin deactivates the account and invites the person again.

## Uploads fail

- **413 or a network error for larger images**: the request body limit is too small. The container sets `BODY_SIZE_LIMIT=12M`; with Nginx, also set `client_max_body_size 12m;`.
- **"Only JPEG, PNG, WebP, GIF and AVIF images can be uploaded"**: the file content is not one of these formats, whatever its name says. Convert it first.
- **"The image is too large. The limit is 40 megapixels"**: scale the image down.
- **"Too many attempts"**: each user may upload 30 files per minute.

## Emails do not arrive

- Check the log for `An email could not be sent`.
- Port 587 requires STARTTLS: if the server does not support it, use `SMTP_SECURE=true` with port 465.
- Most providers accept only a sender that belongs to the account in `SMTP_USER`; set `SMTP_FROM` accordingly.
- Messages that are sent but not delivered usually need SPF, DKIM and DMARC records for the sender's domain.

## Webhooks fail

Open the webhook under **Integrations → Webhooks** and read the error of the latest delivery:

| Error                                                                                                 | Meaning                                                                                              |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `Only https addresses can receive webhooks.`                                                          | Change the endpoint to `https`.                                                                      |
| `The host resolves to a private address.`                                                             | The receiver is in a private network. Set `WEBHOOK_ALLOW_PRIVATE=true` if that is intended.          |
| `The host resolves to a loopback, link-local, multicast or reserved address, which is never allowed.` | Such targets are always blocked. Use a public or private address.                                    |
| `Plain http is only allowed for private addresses with WEBHOOK_ALLOW_PRIVATE=true.`                   | Use `https`, or a private address with `WEBHOOK_ALLOW_PRIVATE=true`.                                 |
| `The host name could not be resolved.`                                                                | Check the host name and the DNS of the server.                                                       |
| `The request timed out.`                                                                              | The receiver did not answer within 10 seconds. Answer first and do slow work afterwards.             |
| A response code such as `500` without an error                                                        | The receiver answered with an error; check its logs. Deliveries are retried five times.              |
| `The webhook is disabled.`                                                                            | **Send events to this endpoint** was turned off while the delivery was waiting.                      |
| `The webhook secret cannot be decrypted. Rotate the secret.`                                          | The secret was encrypted with a key that is no longer configured. Rotate it and update the receiver. |

## API requests fail

| Answer                      | Cause                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| `401 unauthorized`          | The key is missing, mistyped, expired or revoked. Send it as `Authorization: Bearer svt_...`. |
| `400 key_in_query`          | The key was sent in the address. Move it to the `Authorization` header.                       |
| `400 invalid_query`         | A parameter is unknown or has an invalid value; the message names it.                         |
| `404 not_found`             | The post does not exist, is not public, or is outside the key's languages or categories.      |
| `429 rate_limited`          | The key used up its requests for this minute; wait for `Retry-After` seconds.                 |
| A CORS error in the browser | Add the page's origin under **Integrations → CORS**, exactly as `scheme://host[:port]`.       |

## The public site shows 404

- The public site may be turned off: check **Public reading site** in the settings.
- The language may be disabled, or the translation not published, or the post hidden.
- The slug may have changed: the address of a translation follows its current slug.

## Backups in the panel

- **"Turn on two-factor authentication for your account to use backups"**: the page is locked until the founder turns on two-factor authentication under **My account → Two-factor authentication**.
- **A backup could not be created**: the message names the reason, most often too little free disk space. Delete old archives or enlarge the volume.
- **"It was created by a newer version of Servitor"**: update this installation to at least the version that made the backup, then restore it.
- **"The passphrase is wrong"** when uploading: enter the passphrase again and upload once more; the file is not sent a second time.
- **The app does not come back after a restore**: nothing restarted it. Start it again, for example with `docker compose up -d`; the restore is applied on start. Without Docker, set the service manager to always restart the app.
- **After a restore, your password no longer works**: the accounts of the backup apply now. Use the password you had when the backup was made, or run [`reset-founder`](operations.md#recovering-the-founder-account).

## Restore refuses to run

- **"The app seems to be running"**: stop it with `docker compose stop servitor` and run the restore with `docker compose run --rm`. If the app crashed, wait a minute or add `--force`.
- **"The backup cannot be restored: ..."**: the archive is damaged, from an unknown format, too large for the free space, or contains unexpected files. Nothing was changed.
