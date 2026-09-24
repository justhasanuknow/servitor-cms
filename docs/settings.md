# Settings and audit log

The founder controls the installation-wide settings; staff read the audit log. Both live under **Administration**.

## System settings

**Administration → Settings** is available to the founder only. Saving asks for the founder's password, and a current code when two-factor authentication is on.

| Setting                                                      | Default              | Effect                                                                                                     |
| ------------------------------------------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------------- |
| Site name                                                    | Servitor CMS         | Shown on the public site, in feeds and in emails. Up to 100 characters.                                    |
| Default content language                                     | from the first start | Must be an enabled language. See [the default language](languages-and-categories.md#the-default-language). |
| Public reading site                                          | on                   | When off, Servitor runs headless, see below.                                                               |
| Require two-factor authentication for the founder and admins | off                  | Affected users without two-factor authentication must set it up right after signing in.                    |
| Default API rate limit (requests per minute)                 | 120                  | Applies to every API key without its own limit. From 1 to 100,000.                                         |
| Revisions kept per translation                               | 50                   | Older history entries are removed; live and pending revisions are always kept. From 1 to 1,000.            |

Every change is written to the audit log with the changed settings.

### Headless mode

With **Public reading site** turned off, every public route under `/blog`, the feeds and the sitemaps answer with `404`, `robots.txt` disallows crawling, and the root address opens the panel. The REST API and webhooks keep working, so another application can present the content instead. This documentation then stays available to signed-in users only.

## Audit log

**Administration → Audit log** lists security-relevant events for the founder and admins. Entries cannot be changed or removed: there is no code path or button for it, and the database rejects any attempt.

Each entry records the time, the actor (a user, **Anonymous**, **Command line** or **System**), the client address, the user agent, the action, the target and details. Details never contain secrets or post content.

### Recorded actions

| Area             | Actions                                                                                                                                                                                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in          | `auth.login_succeeded`, `auth.login_failed`, `auth.account_locked`, `auth.logout`                                                                                                                                                                                           |
| Account security | `auth.password_changed`, `auth.password_reset`, `auth.founder_reset`, `auth.two_factor_enabled`, `auth.two_factor_disabled`, `auth.backup_codes_regenerated`, `auth.session_revoked`                                                                                        |
| Users            | `user.created`, `user.invited`, `user.invite_link_created`, `user.invite_accepted`, `user.password_reset_link_created`, `user.role_changed`, `user.deactivated`, `user.reactivated`, `user.publish_permission_changed`, `user.email_change_requested`, `user.email_changed` |
| Structure        | `language.added`, `language.updated`, `language.enabled`, `language.disabled`, `language.deleted`, `category.created`, `category.updated`, `category.deleted`                                                                                                               |
| Content          | `post.published`, `post.unpublished`, `post.submitted`, `post.approved`, `post.rejected`, `post.hidden`, `post.unhidden`, `post.deleted`                                                                                                                                    |
| Integrations     | `api_key.created`, `api_key.revoked`, `cors.origin_added`, `cors.origin_removed`, `webhook.created`, `webhook.updated`, `webhook.deleted`, `webhook.secret_rotated`                                                                                                         |
| Settings         | `settings.updated`                                                                                                                                                                                                                                                          |

Failed sign-ins record the stage (password or second factor), the method and the reason, such as invalid credentials, an invalid code or a locked account.

### Filtering

Narrow the list by **Actor**, **Action**, **Target type**, **Target ID** and a time range with **From** and **To**, then choose **Filter**. **Reset** clears the filters.

The audit log is also written to the application log on standard output, so it can be shipped to a separate system, see [Logs](operations.md#logs).
