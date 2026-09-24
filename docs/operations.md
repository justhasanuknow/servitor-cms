# Operations

This page covers the tasks of running an installation: the command line, backups and restores, recovering the founder account, ending sessions, rotating the secret, logs and dependency updates.

## Command line

Operational tasks that must never be reachable over the network run through a command line tool inside the container:

```bash
docker compose exec servitor node build/cli.js <command>
```

| Command                    | Purpose                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `backup`                   | Writes a timestamped archive with a database snapshot and the uploads.                                                |
| `restore <file> [--force]` | Replaces the database and the uploads with a backup.                                                                  |
| `reset-founder`            | Sets a temporary founder password, turns off the founder's two-factor authentication and ends the founder's sessions. |
| `sign-out [email]`         | Ends every session of one user, or of all users when no address is given.                                             |

Every command reads the same environment as the app, including `_FILE` variables, and writes an audit entry where it changes accounts.

## Backups

```bash
docker compose exec servitor node build/cli.js backup
```

The command writes `/data/backups/servitor-backup-<time>.tar.gz`. The archive contains:

- `servitor.db`, a consistent snapshot of the database taken with SQLite's online backup API, safe to make while the app is running;
- `uploads/`, all processed images;
- `backup.json`, a small manifest with the format version and the creation time.

A backup inside the same volume does not protect against losing the server. Copy every archive somewhere else:

```bash
docker compose cp servitor:/data/backups/servitor-backup-2026-09-24T03-00-00Z.tar.gz ./backups/
```

To make a backup every night at 03:00, add a line like this to the host's crontab (`crontab -e`):

```text
0 3 * * * cd /opt/servitor-cms && docker compose exec -T servitor node build/cli.js backup >> /var/log/servitor-backup.log 2>&1
```

Old archives are not deleted automatically. Remove them from `/data/backups` once they are stored safely elsewhere.

Backups contain everything, including personal data, password hashes and encrypted secrets. Store them with the same care as the live server. A restored backup needs a `BETTER_AUTH_SECRET` that can decrypt its stored secrets: the one that was current when the backup was made, either as the current secret or in `BETTER_AUTH_PREVIOUS_SECRETS`.

## Restoring a backup

1. Put the archive into the volume:

   ```bash
   docker compose cp ./servitor-backup-2026-09-24T03-00-00Z.tar.gz servitor:/data/backups/
   ```

2. Stop the app:

   ```bash
   docker compose stop servitor
   ```

3. Run the restore in a one-off container:

   ```bash
   docker compose run --rm servitor node build/cli.js restore /data/backups/servitor-backup-2026-09-24T03-00-00Z.tar.gz
   ```

4. Start the app again:

   ```bash
   docker compose up -d
   ```

Before anything is replaced, the archive is checked: it may contain only the expected files, no absolute paths or `..` segments, at most 500,000 entries and no more data than fits into the free space of the volume, and the database must pass SQLite's integrity check. The current database and uploads are then moved to `/data/.pre-restore-<time>` instead of being deleted, so a mistaken restore can be undone by moving them back. Migrations that are newer than the backup run on the next start.

The restore refuses to run while the app is running, which it detects through a heartbeat file in the data directory. If a crash left that file behind, wait a minute or add `--force`.

## Recovering the founder account

If the founder loses the password or the second factor:

```bash
docker compose exec servitor node build/cli.js reset-founder
```

The command prints a temporary password once, requires a new password at the next sign-in, turns off the founder's two-factor authentication, ends every founder session and writes an audit entry. There is deliberately no environment variable for this, so a restart can never reset the founder by accident. Turn two-factor authentication on again after signing in.

Other users who lose access get a new password reset link from the founder or an admin, see [Users and roles](users.md#password-reset-links).

## Ending sessions

To sign somebody out everywhere, for example after a lost laptop or a suspected compromise:

```bash
docker compose exec servitor node build/cli.js sign-out ada@example.com
```

Without an address, every user is signed out. Deactivating a user in the panel also ends all of that user's sessions, and users can end their own sessions under **My account → Sessions**.

## Rotating the secret

`BETTER_AUTH_SECRET` signs the session cookies and encrypts the stored two-factor secrets and webhook secrets. Replace it at least once a year, and right away when it may have leaked:

1. Stop the app and move the current value to `BETTER_AUTH_PREVIOUS_SECRETS`.
2. Set a new random `BETTER_AUTH_SECRET`, for example from `openssl rand -hex 32`, and start the app.
3. Check the log: on start, every stored secret is decrypted with the key it was sealed with and encrypted again with the new one. The log reports how many were updated, and warns about any that no configured key can open.
4. Remove the old value from `BETTER_AUTH_PREVIOUS_SECRETS` and restart once more.

Everybody is signed out, because session cookies are signed with the current secret. Two-factor authentication, backup codes and webhook secrets keep working.

## Logs

Servitor writes JSON lines to standard output. Read them with:

```bash
docker compose logs -f servitor
```

Every line has an ISO timestamp in UTC, a level and a message. The log contains:

- the start of the app, applied migrations and configuration warnings;
- unexpected errors, each with a correlation ID that the user sees on the error page;
- **security events** at level `warn` with the message `Security event`: refused permissions, rate limits, rejected API keys, refused CORS preflights, reused authenticator codes, failed confirmations of sensitive actions and blocked webhook targets, each with the request ID, method, route and client address;
- **audit events** at level `info`: a copy of every entry of the audit log.

Passwords, tokens, cookies, authorization headers, API keys, secrets, authenticator codes and backup codes are replaced with `[REDACTED]` before a line is written. Set `LOG_LEVEL=debug` temporarily when you investigate a problem.

The audit log inside the panel is append-only, but whoever controls the server controls the database. Ship standard output to a separate log system, for example through a Docker logging driver, if you need the records to survive a compromise of the server.

## Software bill of materials

Every image contains a CycloneDX software bill of materials of the production dependencies at `/app/sbom.cdx.json`:

```bash
docker compose exec servitor cat /app/sbom.cdx.json
```

For a checkout of the repository, `npm run --silent sbom` prints the same list.

## Dependency updates

Dependabot proposes updates for npm packages, GitHub Actions and the base image every week, and continuous integration fails on known vulnerabilities of high or critical severity. `SECURITY.md` in the repository lists how quickly vulnerable dependencies are updated. Rebuild the image regularly to pick up updates of the base image.
