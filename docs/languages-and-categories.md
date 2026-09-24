# Languages and categories

Staff shape the structure of the content: which languages posts are written in, and which categories they belong to. Tags are added by authors on each translation.

## Content languages

**Content → Languages** lists the languages posts can be written in. They are independent of the six panel languages; see [Concepts](getting-started.md#panel-languages-and-content-languages).

### Adding a language

Enter a **Language code** in BCP 47 form, such as `de`, `fr`, `pt-BR`, `sr-Latn` or `zh-Hans`, and choose **Add language**. The **English name** and **Native name** are suggested when you leave them empty; **Sort order** controls the order in the editor, on the public site and in the API.

A new language is enabled right away: authors can add translations in it, and its published posts appear on the public site under `/blog/<code>` and in the API.

### Editing, disabling and deleting

- **Edit** changes the names and the sort order.
- **Disable** hides the language: it is no longer offered for new translations, and its existing translations disappear from the public site and the API until you **Enable** it again. Nothing is deleted.
- **Delete** removes a language permanently, but only while no translation uses it. Category names and slugs in that language are removed as well.

The default language cannot be disabled or deleted. Choose a different default under **Administration → Settings** first.

### The default language

The default content language is the first language of the installation and is created from `DEFAULT_CONTENT_LANGUAGE` on the first start. It is used:

- as the target of the site's root address `/`, which opens `/blog/<default>`;
- for the `x-default` alternate of public pages;
- as the fallback when API clients ask for `fallback=default`;
- for the required name of every category.

## Categories

**Content → Categories** manages the categories. A post belongs to at most one category, chosen in its **Post settings**.

Every category has a **Name** and a **Slug** per content language. A name in the default language is required; names in other languages are optional. Leave a slug empty to create it from the name. Slugs use lowercase letters, digits and dashes, and each slug is unique per language.

Published posts of a category are listed on the public site at `/blog/<language>/category/<slug>`. A category can be deleted only while no post uses it.

## Tags

Tags are free keywords that authors add to a translation in **Translation details**, separated by commas: up to 20 tags of up to 50 characters. Tags belong to the language of the translation, so the English tag `travel` and the German tag `reisen` are different tags.

Each tag with published posts gets a page at `/blog/<language>/tag/<slug>`, and the API lists tags with their post counts through `GET /api/v1/tags?lang=<code>`.
