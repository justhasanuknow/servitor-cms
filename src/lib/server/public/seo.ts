import { mediaUrl, variantDimensions } from '../../content/media-urls';
import { SEO_DESCRIPTION_MAX_LENGTH } from '../../constants/public';
import type {
	PublicImage,
	PublicSeo,
	SeoAlternate,
	SeoImage
} from '../../modules/interfaces/public.interfaces';
import {
	absoluteUrl,
	blogFeedPath,
	blogIndexPath,
	blogPostPath,
	withPage
} from '../../public/paths';
import type { ListingSeoInput, PostSeoInput, TranslatedPath } from './seo.interfaces';

const X_DEFAULT = 'x-default';

const WHITESPACE = /\s+/g;

export function serializeJsonLd(value: unknown): string {
	return JSON.stringify(value)
		.replaceAll('<', '\\u003c')
		.replaceAll('>', '\\u003e')
		.replaceAll('&', '\\u0026')
		.replaceAll('\u2028', '\\u2028')
		.replaceAll('\u2029', '\\u2029');
}

export function seoDescription(...candidates: (string | null)[]): string {
	for (const candidate of candidates) {
		const text = (candidate ?? '').replace(WHITESPACE, ' ').trim();

		if (text !== '') {
			return truncate(text);
		}
	}

	return '';
}

export function ogLocale(languageCode: string): string {
	return languageCode.replaceAll('-', '_');
}

export function seoImage(origin: string, image: PublicImage | null): SeoImage | null {
	if (image === null) {
		return null;
	}

	return {
		url: absoluteUrl(origin, mediaUrl(image.id, '1600')),
		...variantDimensions(image.width, image.height, '1600'),
		alt: image.alt
	};
}

export function postSeo(input: PostSeoInput): PublicSeo {
	const { origin, post } = input;
	const canonical = absoluteUrl(origin, blogPostPath(post.languageCode, post.slug));
	const title = firstFilled(post.metaTitle, post.title);
	const description = seoDescription(post.metaDescription, post.excerpt);
	const image = seoImage(origin, post.ogImage ?? post.cover);
	const alternates = withDefault(
		post.alternates.map((alternate) => ({
			hreflang: alternate.languageCode,
			href: absoluteUrl(origin, blogPostPath(alternate.languageCode, alternate.slug))
		})),
		input.defaultLanguage
	);
	let documentTitle = `${post.title} · ${input.siteName}`;

	if ((post.metaTitle ?? '').trim() !== '') {
		documentTitle = title;
	}

	return {
		documentTitle,
		title,
		description,
		canonical,
		robots: input.robots,
		alternates,
		type: 'article',
		siteName: input.siteName,
		locale: ogLocale(post.languageCode),
		image,
		publishedTime: isoOrNull(post.publishedAt),
		modifiedTime: post.modifiedAt.toISOString(),
		feed: {
			title: input.feedTitle,
			href: absoluteUrl(origin, blogFeedPath(post.languageCode))
		},
		previous: null,
		next: null,
		jsonLd: serializeJsonLd(articleJsonLd(input, canonical, title, description, image))
	};
}

export function listingSeo(input: ListingSeoInput): PublicSeo {
	const { origin, page, pageCount } = input;
	let alternates: SeoAlternate[] = [];
	let previous: string | null = null;
	let next: string | null = null;

	if (input.translatedPaths !== null && page === 1) {
		alternates = withDefault(
			input.translatedPaths.map((entry) => ({
				hreflang: entry.languageCode,
				href: absoluteUrl(origin, entry.path)
			})),
			input.defaultLanguage
		);
	}

	if (page > 1) {
		previous = absoluteUrl(origin, withPage(input.path, page - 1));
	}

	if (page < pageCount) {
		next = absoluteUrl(origin, withPage(input.path, page + 1));
	}

	return {
		documentTitle: input.documentTitle,
		title: input.title,
		description: seoDescription(input.description),
		canonical: absoluteUrl(origin, withPage(input.path, page)),
		robots: null,
		alternates,
		type: 'website',
		siteName: input.siteName,
		locale: ogLocale(input.languageCode),
		image: null,
		publishedTime: null,
		modifiedTime: null,
		feed: {
			title: input.feedTitle,
			href: absoluteUrl(origin, blogFeedPath(input.languageCode))
		},
		previous,
		next,
		jsonLd: null
	};
}

export function languageIndexPaths(languageCodes: string[]): TranslatedPath[] {
	return languageCodes.map((languageCode) => ({
		languageCode,
		path: blogIndexPath(languageCode)
	}));
}

function articleJsonLd(
	input: PostSeoInput,
	canonical: string,
	headline: string,
	description: string,
	image: SeoImage | null
): Record<string, unknown> {
	const { post } = input;
	const article: Record<string, unknown> = {
		'@context': 'https://schema.org',
		'@type': 'Article',
		headline,
		inLanguage: post.languageCode,
		url: canonical,
		mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
		dateModified: post.modifiedAt.toISOString(),
		author: { '@type': 'Person', name: post.authorName },
		publisher: { '@type': 'Organization', name: input.siteName }
	};

	if (description !== '') {
		article.description = description;
	}

	if (post.publishedAt !== null) {
		article.datePublished = post.publishedAt.toISOString();
	}

	if (image !== null) {
		article.image = [image.url];
	}

	if (post.category !== null) {
		article.articleSection = post.category.name;
	}

	if (post.tags.length > 0) {
		article.keywords = post.tags.map((tag) => tag.name).join(', ');
	}

	return article;
}

function withDefault(alternates: SeoAlternate[], defaultLanguage: string | null): SeoAlternate[] {
	const fallback = alternates.find((alternate) => alternate.hreflang === defaultLanguage);

	if (fallback === undefined) {
		return alternates;
	}

	return [...alternates, { hreflang: X_DEFAULT, href: fallback.href }];
}

function firstFilled(...values: (string | null)[]): string {
	for (const value of values) {
		const trimmed = (value ?? '').trim();

		if (trimmed !== '') {
			return trimmed;
		}
	}

	return '';
}

function truncate(text: string): string {
	const characters = [...text];

	if (characters.length <= SEO_DESCRIPTION_MAX_LENGTH) {
		return text;
	}

	const cut = characters.slice(0, SEO_DESCRIPTION_MAX_LENGTH - 1).join('');
	const boundary = cut.lastIndexOf(' ');

	if (boundary > SEO_DESCRIPTION_MAX_LENGTH / 2) {
		return `${cut.slice(0, boundary)}…`;
	}

	return `${cut}…`;
}

function isoOrNull(date: Date | null): string | null {
	if (date === null) {
		return null;
	}

	return date.toISOString();
}
