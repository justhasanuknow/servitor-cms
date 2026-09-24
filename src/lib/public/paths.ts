import { PUBLIC_ROUTE_PREFIX, ROBOTS_PATH, SITEMAP_PATH } from '../constants/public';
import { PANEL_ROUTES } from '../constants/routes';

const PUBLIC_LANGUAGE_SEGMENT = new RegExp(`^${PUBLIC_ROUTE_PREFIX}/([^/]+)(?:/|$)`);

const PREVIEW_LANGUAGE_SEGMENT = new RegExp(`^${PANEL_ROUTES.preview}/[^/]+/([^/]+)(?:/|$)`);

function segment(value: string): string {
	return encodeURIComponent(value);
}

export function blogIndexPath(languageCode: string): string {
	return `${PUBLIC_ROUTE_PREFIX}/${segment(languageCode)}`;
}

export function blogPostPath(languageCode: string, slug: string): string {
	return `${blogIndexPath(languageCode)}/${segment(slug)}`;
}

export function blogCategoryPath(languageCode: string, slug: string): string {
	return `${blogIndexPath(languageCode)}/category/${segment(slug)}`;
}

export function blogTagPath(languageCode: string, slug: string): string {
	return `${blogIndexPath(languageCode)}/tag/${segment(slug)}`;
}

export function blogFeedPath(languageCode: string): string {
	return `${blogIndexPath(languageCode)}/rss.xml`;
}

export function blogSitemapPath(languageCode: string): string {
	return `${blogIndexPath(languageCode)}/sitemap.xml`;
}

export function withPage(path: string, page: number): string {
	if (page <= 1) {
		return path;
	}

	return `${path}?page=${page}`;
}

export function absoluteUrl(origin: string, path: string): string {
	return new URL(path, origin).href;
}

export function isPublicPath(pathname: string): boolean {
	return (
		pathname === '/' ||
		pathname === PUBLIC_ROUTE_PREFIX ||
		pathname.startsWith(`${PUBLIC_ROUTE_PREFIX}/`) ||
		pathname === SITEMAP_PATH ||
		pathname === ROBOTS_PATH
	);
}

export function contentLanguageOfPath(pathname: string): string | null {
	const match = PUBLIC_LANGUAGE_SEGMENT.exec(pathname) ?? PREVIEW_LANGUAGE_SEGMENT.exec(pathname);

	if (match === null) {
		return null;
	}

	try {
		return decodeURIComponent(match[1]);
	} catch {
		return null;
	}
}
