import { describe, expect, it } from 'vitest';
import type { DocsPageView } from '$lib/modules/interfaces/docs.interfaces';
import { canReadDocs, docsSections, docsSourceFiles, readDocsIndex, readDocsPage } from './docs';
import { docsFileHref, docsSlug } from './docs-links';
import { DOCS_INDEX_FILE, DOCS_SECTIONS } from './docs-manifest';

const EXTERNAL_LINK = /^(?:https?:|mailto:)/;

const manifestFiles = DOCS_SECTIONS.flatMap((section) => section.files);

const allFiles = [DOCS_INDEX_FILE, ...manifestFiles];

function viewOf(file: string): DocsPageView {
	if (file === DOCS_INDEX_FILE) {
		return readDocsIndex();
	}

	const view = readDocsPage(docsSlug(file));

	if (view === null) {
		throw new Error(`${file} cannot be read`);
	}

	return view;
}

function linksOf(html: string): string[] {
	return [...html.matchAll(/<a href="([^"]*)"/g)].map((match) => match[1]);
}

function headingIdsOf(html: string): Set<string> {
	return new Set([...html.matchAll(/<h[2-6] id="([^"]*)"/g)].map((match) => match[1]));
}

function brokenLinks(): string[] {
	const headingIds = new Map<string, Set<string>>(
		allFiles.map((file) => [docsFileHref(file), headingIdsOf(viewOf(file).page.html)])
	);
	const broken: string[] = [];

	for (const file of allFiles) {
		const ownPath = docsFileHref(file);

		for (const href of linksOf(viewOf(file).page.html)) {
			if (EXTERNAL_LINK.test(href)) {
				continue;
			}

			const hashIndex = href.indexOf('#');
			let path = href;
			let fragment = '';

			if (hashIndex >= 0) {
				path = href.slice(0, hashIndex);
				fragment = href.slice(hashIndex + 1);
			}

			if (path === '') {
				path = ownPath;
			}

			const targetIds = headingIds.get(path);

			if (targetIds === undefined || (fragment !== '' && !targetIds.has(fragment))) {
				broken.push(`${file}: ${href}`);
			}
		}
	}

	return broken;
}

describe('the documentation manifest', () => {
	it('lists every Markdown file in docs exactly once', () => {
		expect([...allFiles].sort()).toEqual(docsSourceFiles());
	});

	it('gives every page its own address', () => {
		const slugs = manifestFiles.map(docsSlug);

		expect(new Set(slugs).size).toBe(slugs.length);
		expect(slugs).not.toContain(docsSlug(DOCS_INDEX_FILE));
	});
});

describe('the documentation pages', () => {
	it('all have a title', () => {
		const untitled = allFiles.filter((file) => viewOf(file).page.title === '');

		expect(untitled).toEqual([]);
	});

	it('link only to pages and headings that exist', () => {
		expect(linksOf(readDocsIndex().page.html)).toContain('/docs/installation');
		expect(headingIdsOf(viewOf('webhooks.md').page.html)).toContain('verifying-the-signature');
		expect(brokenLinks()).toEqual([]);
	});

	it('lead from the overview through every page in the order of the manifest', () => {
		const visited: (string | null)[] = [];
		let view: DocsPageView | null = readDocsIndex();

		expect(view.previous).toBeNull();

		while (view !== null) {
			visited.push(view.page.slug);

			const next: string | null | undefined = view.next?.slug;

			if (next === undefined || next === null) {
				view = null;
			} else {
				view = readDocsPage(next);
			}
		}

		expect(visited).toEqual([null, ...manifestFiles.map(docsSlug)]);
	});

	it('link back to the previous page', () => {
		expect(readDocsPage('getting-started')?.previous).toEqual({
			slug: null,
			path: '/docs',
			title: readDocsIndex().page.title
		});
		expect(readDocsPage('installation')?.previous).toEqual({
			slug: 'getting-started',
			path: '/docs/getting-started',
			title: 'Concepts'
		});
	});

	it('are grouped into the sections of the manifest', () => {
		expect(
			docsSections().map((section) => [section.id, section.pages.map((page) => page.slug)])
		).toEqual(DOCS_SECTIONS.map((section) => [section.id, section.files.map(docsSlug)]));
	});

	it.each(['missing', 'readme', 'README', 'API', 'api.md', '../api', 'api/', '-api', ''])(
		'do not include %j',
		(slug) => {
			expect(readDocsPage(slug)).toBeNull();
		}
	);
});

describe('canReadDocs', () => {
	it.each([
		[true, false, true],
		[true, true, true],
		[false, true, true],
		[false, false, false]
	])(
		'with the public site %s and a signed-in user %s is %s',
		(publicSite, signedIn, expected) => {
			expect(canReadDocs(publicSite, signedIn)).toBe(expected);
		}
	);
});
