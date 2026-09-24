import { describe, expect, it } from 'vitest';
import {
	absoluteUrl,
	blogCategoryPath,
	blogFeedPath,
	blogIndexPath,
	blogPostPath,
	blogSitemapPath,
	blogTagPath,
	contentLanguageOfPath,
	isPublicPath,
	withPage
} from './paths';

describe('public paths', () => {
	it('builds every public route for a language', () => {
		expect(blogIndexPath('zh-Hans')).toBe('/blog/zh-Hans');
		expect(blogPostPath('en', 'hello-world')).toBe('/blog/en/hello-world');
		expect(blogCategoryPath('de', 'technik')).toBe('/blog/de/category/technik');
		expect(blogTagPath('tr', 'yazilim')).toBe('/blog/tr/tag/yazilim');
		expect(blogFeedPath('fr')).toBe('/blog/fr/rss.xml');
		expect(blogSitemapPath('ja')).toBe('/blog/ja/sitemap.xml');
	});

	it('encodes path segments', () => {
		expect(blogPostPath('en', 'a/b?c')).toBe('/blog/en/a%2Fb%3Fc');
	});

	it('adds the page number only after the first page', () => {
		expect(withPage('/blog/en', 1)).toBe('/blog/en');
		expect(withPage('/blog/en', 3)).toBe('/blog/en?page=3');
	});

	it('finds the content language of public pages and previews', () => {
		expect(contentLanguageOfPath('/blog/de')).toBe('de');
		expect(contentLanguageOfPath('/blog/zh-Hans/some-post')).toBe('zh-Hans');
		expect(contentLanguageOfPath('/panel/preview/abc/tr')).toBe('tr');
		expect(contentLanguageOfPath('/blog')).toBeNull();
		expect(contentLanguageOfPath('/panel/posts/abc/tr')).toBeNull();
		expect(contentLanguageOfPath('/blog/%E0%A4%A')).toBeNull();
	});

	it('recognises the public routes', () => {
		for (const path of ['/', '/blog', '/blog/en/post', '/sitemap.xml', '/robots.txt']) {
			expect(isPublicPath(path)).toBe(true);
		}

		for (const path of ['/panel', '/panel/preview/a/en', '/media/x/480.webp', '/blogger']) {
			expect(isPublicPath(path)).toBe(false);
		}
	});

	it('resolves absolute addresses against the origin', () => {
		expect(absoluteUrl('https://cms.example.com', '/blog/en/post')).toBe(
			'https://cms.example.com/blog/en/post'
		);
	});
});
