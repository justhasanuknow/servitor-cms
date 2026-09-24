# Email

Email is optional. Without it, Servitor CMS shows one-time links in the panel and staff pass them on; with it, the same links and a few notifications are sent automatically.

## Turning email on

Set all six variables in `.env` and restart the app:

```ini
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=Example Blog <noreply@example.com>
SMTP_SECURE=false
```

- `SMTP_FROM` is the sender. It must contain an email address, optionally with a display name in front of it. Most providers only accept a sender address that belongs to the account in `SMTP_USER`.
- With `SMTP_SECURE=false`, usually on port 587, the connection must be upgraded with STARTTLS. If the server does not offer STARTTLS, sending fails instead of falling back to plain text.
- With `SMTP_SECURE=true`, usually on port 465, TLS is used from the start.
- Certificates are always verified and TLS 1.2 is the minimum. A plain connection without TLS is only allowed to a relay on the same machine, such as `localhost`.

If only some of the variables are set, email stays off and the log warns about the missing ones. `SMTP_PASSWORD` can also come from a file, see [Configuration](configuration.md#reading-secrets-from-files).

To make sure your messages arrive, publish SPF, DKIM and DMARC records for the sender's domain as your provider describes.

## What Servitor sends

| Email                     | Sent when                                                                                  | Recipient            |
| ------------------------- | ------------------------------------------------------------------------------------------ | -------------------- |
| Invitation                | Staff invite a user or create a new invitation link.                                       | The invited person   |
| Password reset            | A user asks for a link on the sign-in page, or staff create a reset link.                  | The account owner    |
| Email change confirmation | A user changes the email address in the profile.                                           | The new address      |
| Email changed notice      | The new address was confirmed.                                                             | The previous address |
| Sign-in from a new device | Someone signs in with a browser and operating system that the account has not used before. | The account owner    |

Messages are plain text with a simple HTML part, in the recipient's panel language. When the recipient has not chosen a language yet, for example with an invitation, the language of the person or page that triggered the message is used.

## With and without email

| Situation                  | With email                                                                                                          | Without email                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Inviting a user            | The invitation link is emailed and also shown once in the panel.                                                    | The panel shows a one-time invitation link to share.                        |
| Forgotten password         | Users request a link through **Forgot your password?** on the sign-in page; staff can also send one.                | The sign-in page has no reset link; staff create one-time reset links.      |
| Changing the email address | A confirmation link goes to the new address; the change applies once it is opened, and the old address is notified. | The change applies right away after the user confirms it with the password. |
| Sign-in from a new device  | The user is notified with the browser, operating system, IP address and time.                                       | No notification.                                                            |

Password reset requests always get the same answer, whether an account exists or not, so the form cannot be used to find out which addresses are registered. Requests are limited to 10 per 15 minutes per client and 3 per hour per address. Reset links expire after 30 minutes, invitation links after 72 hours and email confirmation links after 24 hours.

## When sending fails

Emails are sent in the background and a failure never blocks the action that triggered it. The error is written to the log, and where staff created a link, the panel tells them that the email could not be sent so they can share the link themselves.

## Trying email locally

For development, run a local mail catcher that accepts any user name and password on `localhost`, point the six variables at it and set `SMTP_SECURE=false`. The plain connection is accepted because the relay runs on the same machine.
