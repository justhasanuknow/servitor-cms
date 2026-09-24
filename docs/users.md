# Users and roles

Accounts exist only through the founder seed and invitations; there is no public sign-up. This page explains the three roles, what each may do, and how staff manage accounts under **Administration → Users**.

## Roles

- **Founder**: the owner of the installation. There is exactly one founder; the role cannot be given to or taken from anybody, and the founder cannot be deactivated.
- **Admin**: runs the site with the founder. Admins manage authors, review and moderate their posts, and manage content languages, categories and integrations.
- **Author**: writes posts and manages their own images. By default, an author's changes need approval before they go live.

"Staff" in this documentation means the founder and admins.

## Permission matrix

"Own" means that the post or image belongs to the acting user.

| Action                                                    | Founder | Admin | Author                      |
| --------------------------------------------------------- | ------- | ----- | --------------------------- |
| Create admins; deactivate or reactivate admins            | Yes     | No    | No                          |
| Create authors; deactivate or reactivate authors          | Yes     | Yes   | No                          |
| Change a user's role between author and admin             | Yes     | No    | No                          |
| Allow or stop direct publishing for authors               | Yes     | Yes   | No                          |
| Create a password reset link for an author                | Yes     | Yes   | No                          |
| Create a password reset link for an admin                 | Yes     | No    | No                          |
| View the user list                                        | Yes     | Yes   | No                          |
| Create, edit and delete own posts                         | Yes     | Yes   | Yes                         |
| Edit or delete another user's post content                | No      | No    | No                          |
| Publish own posts without review                          | Yes     | Yes   | Only with direct publishing |
| Approve or reject authors' submissions                    | Yes     | Yes   | No                          |
| Hide or unhide an author's post                           | Yes     | Yes   | No                          |
| Hide or unhide an admin's post                            | Yes     | No    | No                          |
| Manage content languages and categories                   | Yes     | Yes   | No                          |
| Manage API keys, webhooks and the CORS allowlist          | Yes     | Yes   | No                          |
| View the audit log                                        | Yes     | Yes   | No                          |
| Change system settings                                    | Yes     | No    | No                          |
| Create, download, upload, restore and schedule backups    | Yes     | No    | No                          |
| Upload media; edit and delete own unused media            | Yes     | Yes   | Yes                         |
| Manage own profile, password, two-factor, theme, language | Yes     | Yes   | Yes                         |

Some rules follow from the matrix:

- Nobody manages their own account through the staff actions: you cannot deactivate yourself, change your own role or create a reset link for yourself.
- Staff can open, preview and review posts of the roles they manage, but the content always stays with its author.
- Every check runs on the server. Hidden buttons are a convenience, never the protection.

## The user list

**Administration → Users** lists every account with its role, status and publishing permission:

- **Active**: the user can sign in.
- **Invited**: the invitation has not been accepted yet.
- **Deactivated**: the user cannot sign in.

**Publishes directly** marks authors whose changes skip the review queue; **Needs approval** marks the others. Founders and admins always publish directly.

## Inviting a user

1. Fill in **Display name** and **Email** under **Invite a user** and choose the **Role**. Admins can only invite authors.
2. Choose **Create invitation**.
3. The panel shows a one-time link that is valid for 72 hours. With email configured, the link is also emailed to the new user.

The new user opens the link, chooses a password and signs in. Until then the account is **Invited**. If the link expires or gets lost, open the user and choose **Create invitation link**; the new link replaces all older ones.

## Managing a user

Select a user in the list to open their page. The available actions depend on your role and theirs.

### Direct publishing

For authors, **Allow direct publishing** lets them publish and schedule their own posts without review, and **Require approval** sends their changes through the review queue again. Changes that are already waiting for review stay in the queue.

### Password reset links

**Create reset link** creates a one-time link that lets the user choose a new password. It expires after 30 minutes, replaces older links and, with email configured, is also emailed. A reset signs the user out everywhere but does not turn off their two-factor authentication.

The founder creates reset links for admins; admins and the founder create them for authors.

### Changing the role

Only the founder can move a user between author and admin. The change requires the founder's password, and a current code when two-factor authentication is on, and signs the user out everywhere so that the new permissions apply immediately.

### Deactivating and reactivating

**Deactivate** stops the user from signing in and ends all of their sessions immediately. Their posts stay as they are, including published ones; hide them through moderation if they should disappear. **Reactivate** lets the user sign in again.

## Requiring two-factor authentication

The founder can turn on **Require two-factor authentication for the founder and admins** in the settings. Affected users without two-factor authentication are then taken to the setup right after signing in and cannot use anything else until it is done. Authors can always turn on two-factor authentication themselves.

## When someone leaves

1. Deactivate the account. All sessions end at once.
2. If the person had API keys created for their integrations, review and revoke them under **Integrations → API keys**.
3. Hide posts that should no longer be public, or keep them; they stay attributed to the author.
