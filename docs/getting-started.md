# Concepts

This page introduces the ideas that the rest of the documentation builds on. Read it once before you install Servitor CMS or invite your team.

## What Servitor CMS does

Servitor CMS is a place to write, review and publish articles, with a focus on multilingual content. It has three faces:

- **The panel** at `/panel`, where your team writes posts, manages images and, depending on the role, users, languages, integrations and settings.
- **The public reading site** at `/blog`, a fast, server-rendered blog that ships without JavaScript. You can turn it off and run Servitor headless.
- **Integrations**: a read-only REST API under `/api/v1` for other applications, such as a static site generator or a mobile app, and webhooks that notify them when published content changes.

Everything runs in one Node.js process with an embedded SQLite database. Uploaded images and the database live in one data directory, `/data` in the container, which makes backups and moves simple.

## Roles

Every account has exactly one role:

| Role    | Typical person                       | What the role adds                                                                                                                          |
| ------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Founder | The owner of the installation        | Everything an admin can do, plus system settings, managing admins and changing roles. There is exactly one founder.                         |
| Admin   | An editor-in-chief or a site manager | Managing authors, reviewing their submissions, moderating posts, content languages, categories, API keys, webhooks, CORS and the audit log. |
| Author  | A writer                             | Writing their own posts and managing their own images. Publishing needs approval unless the author is allowed to publish directly.          |

Nobody can edit another person's post content, not even the founder. Staff can review, hide and unhide posts, but the text always belongs to its author. [Users and roles](users.md) has the complete permission matrix.

## Panel languages and content languages

Servitor separates the language of the interface from the languages of your content.

- **Panel languages** are the languages of the user interface: English, Turkish, French, German, Japanese and Simplified Chinese. Every user picks one under **My account → Profile**; emails use the same language.
- **Content languages** are the languages your posts are written in. They are fully dynamic: the founder and admins add any language with a BCP 47 code, such as `de`, `pt-BR` or `zh-Hans`. The first one is created from `DEFAULT_CONTENT_LANGUAGE` on the first start.

A German editor can therefore work in a German panel while writing a Portuguese article.

## Posts, translations and revisions

A **post** is one article. It has an owner, an optional category and an optional cover image, and one **translation** per content language. Each translation has its own title, slug, excerpt, content, tags, search and sharing fields, and its own publishing state. A post can be published in English while its Japanese translation is still a draft.

Every translation keeps a history of **revisions**:

- The **working draft** is what you see in the editor. It is saved automatically a few seconds after you stop typing.
- **Save** copies the working draft into the revision history. You can restore any entry of the history into the working draft later.
- The **live revision** is the version that readers see. Publishing turns a saved snapshot of the draft into the live revision; editing the draft afterwards never changes what readers see until you publish again.

## Publishing in short

Founders, admins and authors who may publish directly can publish a translation right away or schedule its first publication. Other authors submit their changes for review; an admin or the founder approves or rejects them, and a rejection comes with a note. Live translations can be unpublished and published again, and staff can hide a whole post with a reason that the owner sees. [Publishing](publishing.md) describes every step and state.

## One instance per data directory

Rate limits, the scheduler that publishes scheduled posts and the worker that sends webhooks run inside the application process. Always run exactly one container per data directory; more instances on the same data are not supported.

## Where to go next

1. [Install Servitor CMS](installation.md) with Docker Compose.
2. [Put it behind a reverse proxy](deployment.md) with TLS.
3. [Sign in as the founder](panel.md), invite your team and add your content languages.
