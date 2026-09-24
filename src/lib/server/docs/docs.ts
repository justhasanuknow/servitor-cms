import type {
	DocsPage,
	DocsPageLink,
	DocsPageView,
	DocsSection
} from '../../modules/interfaces/docs.interfaces';
import { docsFileHref, docsSlug } from './docs-links';
import { DOCS_INDEX_FILE, DOCS_SECTIONS } from './docs-manifest';
import { renderDocs } from './render-docs';

const SOURCES = import.meta.glob<string>('/docs/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
});

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

let pages: Map<string, DocsPage> | undefined;

export function docsSourceFiles(): string[] {
	return Object.keys(SOURCES)
		.map((path) => path.slice(path.lastIndexOf('/') + 1))
		.sort();
}

export function docsSource(file: string): string | null {
	return SOURCES[`/docs/${file}`] ?? null;
}

export function canReadDocs(publicSiteEnabled: boolean, signedIn: boolean): boolean {
	return publicSiteEnabled || signedIn;
}

export function docsSections(): DocsSection[] {
	return DOCS_SECTIONS.map((section) => ({
		id: section.id,
		pages: section.files.map((file) => pageLink(requirePage(file)))
	}));
}

export function readDocsIndex(): DocsPageView {
	return pageView(requirePage(DOCS_INDEX_FILE));
}

export function readDocsPage(slug: string): DocsPageView | null {
	if (!SLUG_PATTERN.test(slug)) {
		return null;
	}

	const file = orderedFiles().find(
		(candidate) => candidate !== DOCS_INDEX_FILE && docsSlug(candidate) === slug
	);

	if (file === undefined) {
		return null;
	}

	return pageView(requirePage(file));
}

function orderedFiles(): string[] {
	return [DOCS_INDEX_FILE, ...DOCS_SECTIONS.flatMap((section) => section.files)];
}

function pageView(page: DocsPage): DocsPageView {
	const links = orderedFiles().map((file) => pageLink(requirePage(file)));
	const position = links.findIndex((link) => link.slug === page.slug);

	return {
		page,
		previous: links[position - 1] ?? null,
		next: links[position + 1] ?? null
	};
}

function pageLink(page: DocsPage): DocsPageLink {
	return { slug: page.slug, path: page.path, title: page.title };
}

function pageSlug(file: string): string | null {
	if (file === DOCS_INDEX_FILE) {
		return null;
	}

	return docsSlug(file);
}

function requirePage(file: string): DocsPage {
	const page = loadedPages().get(file);

	if (page === undefined) {
		throw new Error(`The documentation page ${file} is missing`);
	}

	return page;
}

function loadedPages(): Map<string, DocsPage> {
	if (pages === undefined) {
		pages = new Map(
			orderedFiles().map((file) => {
				const source = docsSource(file);

				if (source === null) {
					throw new Error(`The documentation page ${file} is missing`);
				}

				return [
					file,
					{ ...renderDocs(source), slug: pageSlug(file), path: docsFileHref(file) }
				];
			})
		);
	}

	return pages;
}
