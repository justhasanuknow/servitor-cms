# Backups and restores

A backup contains the whole installation: the database with all posts, users, settings and the audit log, and every uploaded image. The founder creates, downloads, uploads and restores backups under **Administration → Backups** in the panel, and can let Servitor create them on a schedule. The same archives also work with the [command line](operations.md#backups).

## Who can use backups

Only the founder sees the **Backups** page, and only after turning on two-factor authentication under **My account → Two-factor authentication**. A backup holds every piece of data of the installation, so the page stays locked until the account is protected by a second factor. Admins and authors get `403` for every backup page and endpoint.

Downloading, restoring and deleting a backup, and changing the schedule, ask for the password and a current authenticator code again. Every action is written to the audit log, and a download sends the founder an email notice when email is set up.

## What a backup contains

Each backup is a `.tar.gz` archive in `/data/backups` with:

- `servitor.db`, a consistent snapshot of the database, safe to take while the app is running;
- `uploads/`, all processed images;
- `backup.json`, a manifest with the format, the creation time, the app version and the source of the backup: the panel, the schedule or the command line.

Sessions and short-lived verification tokens are removed from the snapshot, and the file is rewritten so that no trace of them remains. Restoring a backup therefore signs everybody out. Password hashes, two-factor secrets and webhook secrets stay in the backup; the secrets are encrypted with keys derived from `BETTER_AUTH_SECRET`, which is never part of a backup.

## Creating a backup

**Create backup** starts a backup in the background; the page shows its progress and lists the archive when it is done. Only one backup runs at a time. Before it starts, Servitor checks that the free disk space holds at least the size of the database and the images.

The list shows every archive in `/data/backups` with its date, its kind (**Manual**, **Scheduled** or **Uploaded**), its size and the version of Servitor that made it, together with the free disk space. **Manage** opens an archive to download, restore or delete it.

## Scheduled backups

Under **Scheduled backups**, choose:

| Setting                   | Meaning                                                                     |
| ------------------------- | --------------------------------------------------------------------------- |
| Frequency                 | **Off**, **Every day** or **Every Monday**.                                 |
| Hour (UTC)                | The hour at which the backup starts, from 0 to 23, in UTC.                  |
| Scheduled backups to keep | How many scheduled archives to keep, from 1 to 365. Older ones are deleted. |

The page shows when the next scheduled backup runs. If the app was not running at that time, the backup runs as soon as it starts again. A failed scheduled backup is written to the audit log, emails the founder and is tried again after an hour. Only scheduled archives are deleted automatically; manual and uploaded archives stay until you delete them.

## Downloading a backup

A backup on the same server does not survive the loss of the server. Download archives regularly and store them somewhere else.

On the page of an archive, enter the password and a code and choose **Download backup**. With a passphrase of at least 12 characters, entered twice, the download is encrypted with AES-256-GCM under a key derived from the passphrase with scrypt, and the file name ends in `.tar.gz.enc`. Keep the passphrase separate from the file: without it, the archive cannot be restored, and nobody can recover it.

Unencrypted downloads contain personal data, password hashes and encrypted secrets. Store them with the same care as the server itself.

## Uploading a backup

**Upload a backup** brings an archive into `/data/backups`, for example from an old server or from your download folder. Uploads work with any archive size: the browser sends the file in parts of 8 MiB, which fits through the request limits of the app and of the reverse proxy. For an encrypted archive, enter its passphrase; if it is missing or wrong, you can correct it without sending the file again.

The archive is checked before it appears in the list, and uploading changes no data. Restore it from its page afterwards. Unfinished uploads are removed after a day.

## Restoring a backup

On the page of an archive, type the confirmation word that the form shows, confirm with the password and a code, and choose **Restore this backup**:

1. Servitor checks the archive again and records the request in the audit log.
2. The app switches to maintenance, answers every request with `503` and stops a moment later.
3. The container restarts, and before the app opens the database, it moves the current database and images to `/data/.pre-restore-<time>` and puts the backup in their place.
4. Pending migrations run, the outcome is written to the audit log and the app accepts requests again.

The page waits for the app to come back and then opens the sign-in page. Sign in with an account of the backup: its users, passwords and two-factor settings apply now. If you do not know a password from the backup, use [`reset-founder`](operations.md#recovering-the-founder-account). The **Backups** page shows the outcome of the last restore.

The restart needs a supervisor that starts the app again. Docker Compose does this with the `restart: unless-stopped` policy of the shipped file, and Coolify does it on its own. Without Docker, run the app with a service manager set to always restart it, for example `Restart=always` in systemd. If nothing restarts the app, start it by hand: the restore is applied on the next start.

Before a restore, every archive has to pass these checks, and nothing is changed when one of them fails:

- it contains only the manifest, the database and the uploads, without absolute paths, `..` segments or links, at most 500,000 entries and no more data than fits into the free space;
- the manifest has a supported format;
- the database passes SQLite's integrity check;
- the migration history of the database matches the migrations this version knows, so archives from a newer version of Servitor are refused;
- the tables, indexes, triggers and views of the database are exactly those its migrations create.

A restored backup needs the `BETTER_AUTH_SECRET` that was current when it was made, as the current secret or in `BETTER_AUTH_PREVIOUS_SECRETS`; otherwise two-factor authentication and webhooks of the backup cannot be decrypted. Keep the data in `/data/.pre-restore-<time>` until you are sure the restore is right, then delete the folder.

## Moving to a new server

1. Download a backup of the old installation, preferably encrypted.
2. Install Servitor on the new server with the same `BETTER_AUTH_SECRET`, or add the old secret to `BETTER_AUTH_PREVIOUS_SECRETS`.
3. Sign in as the founder of the new installation, turn on two-factor authentication, upload the archive and restore it.
4. Sign in again with the founder account of the backup.

## Command line

The command line works without the panel, for example when nobody can sign in:

```bash
docker compose exec servitor node build/cli.js backup
```

```bash
docker compose run --rm servitor node build/cli.js restore /data/backups/servitor-backup-2026-09-24T03-00-00Z.tar.gz
```

An encrypted download is decrypted first. The command reads the passphrase from the terminal, or from `BACKUP_PASSPHRASE`, and writes the archive next to the file:

```bash
docker compose exec servitor node build/cli.js decrypt-backup /data/backups/servitor-backup-2026-09-24T03-00-00Z.tar.gz.enc
```

[Operations](operations.md#restoring-a-backup) describes restoring from the command line step by step.
