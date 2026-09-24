# Public site

Servitor CMS includes reading pages for your published posts under `/blog`. They are rendered on the server, ship without JavaScript and work well with search engines and feed readers. If you present your content elsewhere, turn them off and use Servitor headless.

## Addresses

| Address                            | Content                                                               |
| ---------------------------------- | --------------------------------------------------------------------- |
| `/`                                | Redirects to the default content language.                            |
| `/blog/<language>`                 | The published posts of a language, newest first, ten per page.        |
| `/blog/<language>/<slug>`          | One post.                                                             |
| `/blog/<language>/category/<slug>` | The posts of a category.                                              |
| `/blog/<language>/tag/<slug>`      | The posts with a tag.                                                 |
| `/blog/<language>/rss.xml`         | The RSS feed of a language with the 20 newest posts.                  |
| `/blog/<language>/sitemap.xml`     | The sitemap of a language.                                            |
| `/sitemap.xml`                     | The sitemap index with one sitemap per enabled language.              |
| `/robots.txt`                      | Keeps crawlers out of the panel and points them to the sitemap index. |

Longer lists are paginated with **Newer posts** and **Older posts**. The footer of every page links to the other enabled languages.

## Posts

A post page shows the title, the author, the publication date, the reading time, the cover image, the content, the category and the tags. When the post is published in other languages, **Also available in** links to those translations.

Images are delivered in several sizes and the browser picks the one that fits the screen. Code blocks are highlighted, math is rendered to HTML, and videos from YouTube and Vimeo are embedded through their privacy-friendly players in a sandbox.

## Search engines and sharing

Every page carries:

- a canonical address;
- `hreflang` alternates for the other translations, with an `x-default` entry for the default language;
- a description from the meta description or the excerpt;
- Open Graph and Twitter card tags with the social sharing image or the cover;
- JSON-LD `Article` data with the author, dates and image.

Sitemaps list every public post with its last change, and the RSS feeds contain the title, link, date and excerpt of each post.

## Language of the page

The text around the content, such as navigation and dates, uses the panel language that matches the content language when it is one of the six panel languages, and English otherwise. A German post is framed in German, a Portuguese post in English.

## Which posts appear

A translation appears when the post is not hidden, the translation is published with a live version and its language is enabled. Drafts, submissions, scheduled and unpublished translations never appear. Changes to a live translation become visible only when they are published.

## Previews

Authors and staff can open an unpublished version at `/panel/preview/<post>/<language>` through **Preview** in the editor or the review screen. Previews look like the public page with a notice at the top, need a signed-in user who may view the post, and are excluded from crawling.

## Headless mode

Turn off **Public reading site** under **Administration → Settings** to run Servitor headless:

- the reading pages, feeds and sitemaps answer with `404`;
- `robots.txt` disallows crawling;
- the root address opens the panel.

The [REST API](api.md) and [webhooks](webhooks.md) keep working, so a static site generator or another application can present the content. API responses then contain `null` instead of a public address for each translation.

## Appearance

The reading pages use a neutral design that follows the reader's light or dark system setting. They are meant as a clean default; for a custom design, build your own front end on top of the API.
