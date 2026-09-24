import { describe, expect, it } from 'vitest';
import type { PublicPostView } from '../../modules/interfaces/public.interfaces';
import { listingSeo, ogLocale, postSeo, seoDescription, serializeJsonLd } from './seo';

const ORIGIN = 'https://cms.example.com';

const IMAGE_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

function post(overrides: Partial<PublicPostView> = {}): PublicPostView {
	return {
		translationId: 't1',
		postId: 'p1',
		languageCode: 'de',
		slug: 'hallo-welt',
		title: 'Hallo Welt',
		excerpt: 'Ein kurzer Text',
		metaTitle: null,
		metaDescription: null,
		contentHtml: '<p>Hallo</p>',
		readingTimeMinutes: 1,
		publishedAt: new Date('2026-09-01T10:00:00.000Z'),
		modifiedAt: new Date('2026-09-02T10:00:00.000Z'),
		authorName: 'Ada',
		category: { name: 'Technik', slug: 'technik' },
		tags: [{ name: 'Svelte', slug: 'svelte' }],
		cover: { id: IMAGE_ID, width: 3200, height: 1600, alt: 'Ein Bild' },
		ogImage: null,
		alternates: [
			{ languageCode: 'en', nativeName: 'English', slug: 'hello-world' },
			{ languageCode: 'de', nativeName: 'Deutsch', slug: 'hallo-welt' }
		],
		...overrides
	};
}

function seoFor(view: PublicPostView) {
	return postSeo({
		origin: ORIGIN,
		siteName: 'Field Notes',
		defaultLanguage: 'en',
		post: view,
		feedTitle: 'Field Notes · Deutsch',
		robots: null
	});
}

describe('post SEO', () => {
	it('builds canonical, hreflang, Open Graph and image metadata', () => {
		const seo = seoFor(post());

		expect(seo.canonical).toBe(`${ORIGIN}/blog/de/hallo-welt`);
		expect(seo.documentTitle).toBe('Hallo Welt · Field Notes');
		expect(seo.description).toBe('Ein kurzer Text');
		expect(seo.locale).toBe('de');
		expect(seo.alternates).toEqual([
			{ hreflang: 'en', href: `${ORIGIN}/blog/en/hello-world` },
			{ hreflang: 'de', href: `${ORIGIN}/blog/de/hallo-welt` },
			{ hreflang: 'x-default', href: `${ORIGIN}/blog/en/hello-world` }
		]);
		expect(seo.image).toEqual({
			url: `${ORIGIN}/media/${IMAGE_ID}/1600.webp`,
			width: 1600,
			height: 800,
			alt: 'Ein Bild'
		});
		expect(seo.feed).toEqual({
			title: 'Field Notes · Deutsch',
			href: `${ORIGIN}/blog/de/rss.xml`
		});
		expect(seo.publishedTime).toBe('2026-09-01T10:00:00.000Z');
	});

	it('prefers the SEO fields and the social image when they are set', () => {
		const seo = seoFor(
			post({
				metaTitle: 'Custom title',
				metaDescription: 'Custom description',
				ogImage: { id: IMAGE_ID, width: 1200, height: 630, alt: '' }
			})
		);

		expect(seo.documentTitle).toBe('Custom title');
		expect(seo.title).toBe('Custom title');
		expect(seo.description).toBe('Custom description');
		expect(seo.image).toMatchObject({ width: 1200, height: 630 });
	});

	it('leaves out x-default when the default language has no public version', () => {
		const seo = seoFor(
			post({
				alternates: [{ languageCode: 'de', nativeName: 'Deutsch', slug: 'hallo-welt' }]
			})
		);

		expect(seo.alternates.map((alternate) => alternate.hreflang)).toEqual(['de']);
	});

	it('describes the article as JSON-LD', () => {
		const data = JSON.parse(seoFor(post()).jsonLd ?? '{}');

		expect(data).toMatchObject({
			'@context': 'https://schema.org',
			'@type': 'Article',
			headline: 'Hallo Welt',
			inLanguage: 'de',
			datePublished: '2026-09-01T10:00:00.000Z',
			dateModified: '2026-09-02T10:00:00.000Z',
			author: { '@type': 'Person', name: 'Ada' },
			publisher: { '@type': 'Organization', name: 'Field Notes' },
			image: [`${ORIGIN}/media/${IMAGE_ID}/1600.webp`],
			articleSection: 'Technik',
			keywords: 'Svelte'
		});
	});
});

describe('JSON-LD serialization', () => {
	it('cannot close the script element or inject markup', () => {
		const serialized = serializeJsonLd({
			headline: '</script><script>alert(1)</script> & \u2028'
		});

		expect(serialized).not.toContain('<');
		expect(serialized).not.toContain('>');
		expect(serialized).not.toContain('&');
		expect(JSON.parse(serialized).headline).toBe('</script><script>alert(1)</script> & \u2028');
	});
});

describe('descriptions and locales', () => {
	it('collapses whitespace and shortens long text on a word boundary', () => {
		expect(seoDescription(null, '  first \n line  ')).toBe('first line');

		const long = seoDescription(`${'word '.repeat(100)}end`);

		expect([...long].length).toBeLessThanOrEqual(300);
		expect(long.endsWith('…')).toBe(true);
		expect(long).not.toMatch(/\s…$/);
	});

	it('converts language tags to Open Graph locales', () => {
		expect(ogLocale('pt-BR')).toBe('pt_BR');
		expect(ogLocale('en')).toBe('en');
	});
});

describe('listing SEO', () => {
	const base = {
		origin: ORIGIN,
		siteName: 'Field Notes',
		defaultLanguage: 'en',
		languageCode: 'en',
		documentTitle: 'Field Notes',
		title: 'Field Notes',
		description: 'Latest posts',
		path: '/blog/en',
		feedTitle: 'Field Notes · English',
		translatedPaths: [
			{ languageCode: 'en', path: '/blog/en' },
			{ languageCode: 'tr', path: '/blog/tr' }
		]
	};

	it('links the first page to the other languages', () => {
		const seo = listingSeo({ ...base, page: 1, pageCount: 3 });

		expect(seo.canonical).toBe(`${ORIGIN}/blog/en`);
		expect(seo.previous).toBeNull();
		expect(seo.next).toBe(`${ORIGIN}/blog/en?page=2`);
		expect(seo.alternates.map((alternate) => alternate.hreflang)).toEqual([
			'en',
			'tr',
			'x-default'
		]);
	});

	it('points later pages at their neighbours without language alternates', () => {
		const seo = listingSeo({ ...base, page: 3, pageCount: 3 });

		expect(seo.canonical).toBe(`${ORIGIN}/blog/en?page=3`);
		expect(seo.previous).toBe(`${ORIGIN}/blog/en?page=2`);
		expect(seo.next).toBeNull();
		expect(seo.alternates).toEqual([]);
		expect(seo.jsonLd).toBeNull();
	});
});
