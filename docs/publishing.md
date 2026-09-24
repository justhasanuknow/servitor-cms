# Publishing

Every translation of a post is published on its own. This page explains who can publish, how scheduling and reviews work, and how translations are taken offline or hidden.

## Who publishes directly

- The founder and admins always publish directly.
- Authors publish directly only when staff allowed it on their user page. All other authors submit their changes for review.

The **Publishing** card of the editor shows the actions that apply to you and the current state of the translation.

## Publishing directly

1. Write the translation and, if you like, choose **Save** to keep a history entry.
2. Choose **Publish**. The current working draft becomes the live version; readers, the API and webhooks see it right away.

To change a live translation, edit the draft and choose **Publish** again. Readers keep seeing the previous live version until then, so you can work on a large change over several days without anybody noticing.

### Scheduling the first publication

Before a translation is published for the first time, **Publish at (optional)** accepts a date and time in your browser's time zone. **Schedule** stores it, and the translation is published automatically within a minute after that moment. Leave the field empty to publish right away. Scheduling is only available for the first publication; later changes go live when you publish them.

To cancel a scheduled publication, choose **Unpublish**. The translation stays offline and can be scheduled or published again.

## Publishing with review

Authors whose changes need approval see **Submit for review** instead of **Publish**:

1. Choose **Submit for review**. For a translation that was never published, you can suggest a date in **Publish at (optional)**.
2. The translation shows **Pending review**, or **Changes pending review** when an earlier version is already live. Anything that is live stays unchanged until the submission is approved.
3. You can keep editing. Submitting again replaces your previous submission.

While a translation is live and your changes need approval, the category and the cover of the post are locked, because changing them would change the live post without review.

## Reviewing submissions

Staff find waiting submissions under **Content → Reviews**. The founder and admins review submissions from authors; nobody reviews their own posts. Each entry shows whether it is a **New translation** or an **Update to a live translation**, who submitted it and the requested publishing date.

Open an entry to see the submission. For updates, **Show the live version** shows what readers see now, and **Preview the submission** shows the submission as the public page would. Then decide:

- **Approve and publish** makes the submission live, or schedules it when the author requested a future date for a first publication.
- **Reject** sends it back. A **Note to the author** is required; the author sees it in the editor until a newer version goes live.

If the author submits a newer version while you are reviewing, the decision is refused and you are asked to review the latest version.

## Unpublishing and publishing again

The owner of a post can take any live translation offline with **Unpublish**. Its public page and API entry disappear right away, and connected systems receive the `post.unpublished` event.

An unpublished translation whose draft has not changed since it was live shows **Publish again**, which puts the same version back online without another review. A changed draft follows the normal rules: publish it directly or submit it for review.

## Hiding a post

Staff can hide a whole post, for example when it breaks the site's rules. The **Moderation** card on the post page offers **Hide post** with a required **Reason**:

- Hidden posts disappear from the public site and the API in every language.
- The owner sees **Hidden by a moderator** and the reason, and can keep editing.
- **Unhide post** makes the post visible again.

The founder can hide posts of admins and authors, admins can hide posts of authors, and nobody moderates their own posts. Hiding and unhiding are written to the audit log and send the `post.hidden` and `post.unhidden` events.

## What readers see

A translation is public when all of these are true:

- the post is not hidden;
- the translation is published and has a live version;
- its content language is enabled.

Drafts, submissions, scheduled translations and unpublished translations are never visible on the public site or in the API. Previews are only available to signed-in users who may view the post.

## Events at a glance

| Event              | Sent when                                                          |
| ------------------ | ------------------------------------------------------------------ |
| `post.published`   | A translation went live for the first time or was published again. |
| `post.updated`     | The live version of a published translation changed.               |
| `post.unpublished` | A translation was unpublished.                                     |
| `post.hidden`      | A moderator hid a post.                                            |
| `post.unhidden`    | A moderator made a post visible again.                             |
| `post.deleted`     | A post was deleted.                                                |

See [Webhooks](webhooks.md) for how these events are delivered.
