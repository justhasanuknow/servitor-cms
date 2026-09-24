# Writing posts

Posts are written under **Content → Posts**. Each post has one translation per content language, and each translation is edited on its own tab with its own title, content, fields, history and publishing state. This page covers writing; [Publishing](publishing.md) covers what happens when a translation goes live.

## The post list

The list shows your posts with the status of every translation:

| Status                 | Meaning                                               |
| ---------------------- | ----------------------------------------------------- |
| Draft                  | Never published.                                      |
| Pending review         | Submitted and waiting for a decision.                 |
| Scheduled              | Approved or published with a future publication date. |
| Published              | Live on the public site and in the API.               |
| Unpublished            | Was live and has been taken offline.                  |
| Changes pending review | Live, with newer changes waiting for review.          |

A post hidden by a moderator is marked **Hidden by a moderator** with the reason. Staff can switch **Show posts** between **My posts** and **All posts**; they can open other people's posts and their history, but not edit them.

## Creating a post

1. Choose **New post**.
2. Pick the **Language** of the first translation. Only enabled content languages are offered.
3. Write a **Title** and your content. The draft is saved automatically.

To add another language later, open the post and choose **Add translation**, then the **Translation language**. The new translation starts empty.

## The editor

Type to write paragraphs. Type `/` at the start of a line, or use the **Insert** menu of the toolbar, to add a block:

| Block                            | Notes                                                                                                 |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Heading 2, 3 and 4               | The post title is the only first-level heading.                                                       |
| Bulleted, numbered and task list | Lists can be nested.                                                                                  |
| Quote                            |                                                                                                       |
| Code block                       | Choose the **Code language** or leave **Auto-detect**; readers get syntax highlighting.               |
| Table                            | Add or delete rows and columns, merge and split cells, and toggle the header row from the table menu. |
| Image                            | Picks an image from your media library and asks for its alt text.                                     |
| Video                            | Embeds a YouTube or Vimeo link in a sandboxed frame. Other sites cannot be embedded.                  |
| Math block and inline math       | LaTeX expressions such as `E = mc^2`, rendered with KaTeX.                                            |

Select text to format it with the **Format** toolbar: bold, italic, underline, strikethrough, links, and text color and highlight from a fixed set of colors. **Undo** and **Redo** work as usual, as do the usual keyboard shortcuts such as `Ctrl+B` or `Cmd+B`.

Links may point to `http`, `https` and `mailto` addresses or to relative paths; **Open link in a new tab** is available for each link. Pasted content is cleaned up to the formatting the editor supports, and images must come from your own media library.

Very large documents cannot be saved: the limit is about a million characters of editor data, 20,000 elements or a nesting depth of 32.

## Saving and history

- The **working draft** is saved automatically three seconds after you stop typing. The status next to the save button shows **Saving…**, **Saved** or **Unsaved changes**.
- **Save** stores the working draft and adds an entry to the **Revision history**.
- If the translation was changed in another tab or window, the editor stops saving and asks you to **Reload**, so neither version is overwritten silently.
- If the connection drops, the editor says so and keeps your changes in the tab. Save again once the connection is back.

The **Revision history** lists every saved entry with its author, date and review state, and marks the **Live** and **Pending** entries. **Restore** copies an entry into the working draft; nothing is published until you publish again. Older entries are removed automatically once a translation has more than the number set in the settings (50 by default); live and pending revisions are always kept.

## Translation details

- **Slug**: the last part of the address, for example `/blog/en/my-first-post`. Leave it empty to create it from the title when you save. Slugs use lowercase letters, digits and dashes and must be unique per language; titles without Latin letters get a short random slug. Changing the slug of a live translation changes its address, and links to the old address stop working.
- **Excerpt**: a short summary of up to 1,000 characters for post lists, feeds and search results.
- **Tags**: up to 20 tags of up to 50 characters, separated by commas. Tags belong to the translation and get their own pages on the public site.

The reading time is calculated automatically from the content.

## Search and sharing

- **Meta title**: the title shown in search results. The post title is used when it is empty.
- **Meta description**: the description for search results and link previews. The excerpt is used when it is empty.
- **Social sharing image**: the image shown when the post is shared on social networks. The cover image is used when it is empty.

## Post settings

**Post settings** are shared by every translation of the post:

- **Category**: at most one category per post.
- **Cover image**: an image from your media library, shown at the top of the post and in lists.

While a translation is live and your changes need approval, the category and the cover are locked, because they would change the live post without review. **Save settings** stores them.

## Previewing

**Preview** opens the working draft exactly as the public page would show it, with a notice that it is not public. Previews need a signed-in user who may view the post, so you can send a preview link to staff but not to outside readers.

## Deleting a post

**Delete post** removes the post, all of its translations and their history permanently. Images stay in the media library. Only the owner can delete a post, and connected systems are notified through the `post.deleted` webhook.
