import { isPanelPath, PANEL_ROUTES } from '../../constants/routes';

const PERMISSIONS_POLICY = [
	'accelerometer=()',
	'camera=()',
	'display-capture=()',
	'geolocation=()',
	'gyroscope=()',
	'magnetometer=()',
	'microphone=()',
	'midi=()',
	'payment=()',
	'usb=()'
].join(', ');

const DEFAULT_REFERRER_POLICY = 'strict-origin-when-cross-origin';

const ACCOUNT_LINK_REFERRER_POLICY = 'same-origin';

const STRICT_TRANSPORT_SECURITY = 'max-age=63072000; includeSubDomains';

export const RESOURCE_CONTENT_SECURITY_POLICY =
	"default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'";

const ACCOUNT_LINK_ROUTES = [
	PANEL_ROUTES.invite,
	PANEL_ROUTES.resetPassword,
	PANEL_ROUTES.verifyEmail
];

const CHARSET_PARAMETER = /;\s*charset=/i;

export const CLEAR_SITE_DATA = '"cache", "storage"';

export function baselineHeaders(production: boolean): [string, string][] {
	const headers: [string, string][] = [
		['X-Content-Type-Options', 'nosniff'],
		['Referrer-Policy', DEFAULT_REFERRER_POLICY],
		['Permissions-Policy', PERMISSIONS_POLICY],
		['Cross-Origin-Opener-Policy', 'same-origin'],
		['Content-Security-Policy', RESOURCE_CONTENT_SECURITY_POLICY]
	];

	if (production) {
		headers.push(['Strict-Transport-Security', STRICT_TRANSPORT_SECURITY]);
	}

	return headers;
}

export function applyPanelCachePolicy(headers: Headers, pathname: string): void {
	if (isPanelPath(pathname) && !headers.has('Cache-Control')) {
		headers.set('Cache-Control', 'no-store');
	}
}

export function applySecurityHeaders(
	headers: Headers,
	production: boolean,
	pathname: string
): void {
	for (const [name, value] of baselineHeaders(production)) {
		if (name !== 'Content-Security-Policy' || !headers.has(name)) {
			headers.set(name, value);
		}
	}

	headers.set('Referrer-Policy', referrerPolicy(pathname));
	applyTextCharset(headers);
}

export function isAccountLinkPath(pathname: string): boolean {
	return ACCOUNT_LINK_ROUTES.some((route) => pathname.startsWith(`${route}/`));
}

function referrerPolicy(pathname: string): string {
	if (isAccountLinkPath(pathname)) {
		return ACCOUNT_LINK_REFERRER_POLICY;
	}

	return DEFAULT_REFERRER_POLICY;
}

function applyTextCharset(headers: Headers): void {
	const contentType = headers.get('Content-Type');

	if (contentType === null || CHARSET_PARAMETER.test(contentType)) {
		return;
	}

	if (isTextMediaType(contentType)) {
		headers.set('Content-Type', `${contentType}; charset=utf-8`);
	}
}

function isTextMediaType(contentType: string): boolean {
	const mediaType = contentType.split(';', 1)[0].trim().toLowerCase();

	return (
		mediaType.startsWith('text/') || mediaType.endsWith('/xml') || mediaType.endsWith('+xml')
	);
}
