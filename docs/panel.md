# The panel and your account

The panel at `/panel` is where everybody works with Servitor CMS. This page explains signing in, finding your way around and looking after your own account.

## Signing in

Open `/panel/login`, enter your email address and password and choose **Sign in**. The language of the sign-in page follows your browser; the **Language** selector below the form changes it.

- A wrong password and an unknown address get the same answer, so nobody can find out which addresses have accounts.
- After 10 failed attempts within 15 minutes, signing in to that account is paused for 15 minutes. The pause ends by itself; it only slows down guessing.
- Each device may try 3 times per 10 seconds.

When two-factor authentication is on, a second step asks for the 6-digit code from your authenticator app. If you do not have your phone, choose **Use a backup code instead** and enter one of your backup codes. Every code works only once.

**Forgot your password?** appears on the sign-in page when email is configured and sends a reset link to your address. Without email, ask the founder or an admin for a reset link.

### What may happen after signing in

- If you signed in with a first or temporary password, the panel asks you to choose a new one before anything else.
- If the founder requires two-factor authentication for your role and you have not set it up yet, the panel takes you to the setup and lets you continue only when it is done.

## Finding your way

The sidebar groups everything you may use. What you see depends on your role:

| Group          | Pages                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------- |
| Overview       | **Dashboard** and **My account**                                                              |
| Content        | **Posts** and **Media** for everyone; **Reviews**, **Languages** and **Categories** for staff |
| Integrations   | **API keys**, **Webhooks** and **CORS** for staff                                             |
| Administration | **Users** and **Audit log** for staff; **Settings** for the founder                           |
| Help           | **Documentation**                                                                             |

On small screens the sidebar opens with the menu button in the top bar. **Sign out** at the bottom of the sidebar ends the current session and asks the browser to clear cached data of the site.

## Your profile

**My account → Profile** holds the information about you and your preferences.

- **Display name** and **Bio** appear with your published posts and in the API. The name can have up to 100 characters, the bio up to 1,000.
- **Profile picture**: upload a JPEG, PNG, WebP, GIF or AVIF image of up to 10 MB. It is cropped to a square and converted to WebP. **Remove picture** takes it away.
- **Email address**: with email configured, a confirmation link goes to the new address and the change applies once it is opened; your previous address is notified. Without email, the change applies right away. Either way you confirm it with your password.
- **Panel language**: English, Türkçe, Français, Deutsch, 日本語 or 简体中文. **Automatic (browser language)** follows your browser. Emails to you use the same language.
- **Color palette** and **Appearance**: five palettes (Neutral, Red, Blue, Green, Pink) and Light, Dark or System mode for the panel and this documentation.

## Password

**My account → Password** changes your password. Enter the current password, the new one and its confirmation. The rules:

- 12 to 128 characters, with no rules about digits, capitals or symbols. Long passphrases work well.
- Not one of the bundled common or breached passwords.
- Not built mainly from the product name, the role names, the site name, the host name or your own name or email address. These words do not count toward the 12 characters.

Changing the password signs out your other sessions. Passwords never expire.

## Two-factor authentication

Two-factor authentication protects your account with a one-time code from an authenticator app, such as Google Authenticator, Microsoft Authenticator, 1Password, Bitwarden or Aegis. To turn it on under **My account → Two-factor authentication**:

1. Enter your password and choose **Set up**.
2. Scan the QR code with your authenticator app, or type the setup key into it.
3. Save the 10 backup codes somewhere safe, for example in your password manager. They are shown only once.
4. Enter the 6-digit code from the app and choose **Turn on**.

From then on, signing in asks for a code. Every code works only once, and each backup code can replace one code when you do not have your app.

- **Backup codes left** shows how many unused codes remain. **Create new codes** replaces all of them; the old ones stop working.
- **Turn off** removes two-factor authentication and signs out your other sessions.

Both actions ask for your password and a current code. If you lose the app and every backup code, the founder can reset the second factor of the founder account from the command line, see [Recovering the founder account](operations.md#recovering-the-founder-account); other users are onboarded again by staff.

## Sessions

**My account → Sessions** lists every device that is signed in to your account, with the browser, operating system, IP address, sign-in time and last activity. **This device** marks the one you are using.

To end one session or all others, enter your password (and a current code when two-factor authentication is on) and choose **Sign out** next to the session or **Sign out all other sessions**.

Sessions end by themselves after 7 days without activity and at the latest 30 days after the sign-in. A new sign-in from a device you have not used before triggers an email when email is configured.

## Confirming sensitive actions

Some actions ask for your password again, and for a current code when two-factor authentication is on, even though you are signed in:

- changing your password or email address;
- turning off two-factor authentication or creating new backup codes;
- ending sessions;
- creating or revoking API keys;
- adding a webhook or rotating its secret;
- changing a user's role;
- changing system settings.

This protects your account if someone gets hold of an unlocked device. Three confirmations per 10 seconds are allowed.
