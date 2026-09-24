import { PANEL_ROUTES } from '../../constants/routes';

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

export function applyPanelCachePolicy(headers: Headers, pathname: string): void {
	const panelPath =
		pathname === PANEL_ROUTES.root || pathname.startsWith(`${PANEL_ROUTES.root}/`);

	if (panelPath && !headers.has('Cache-Control')) {
		headers.set('Cache-Control', 'no-store');
	}
}

export function applySecurityHeaders(headers: Headers, production: boolean): void {
	headers.set('X-Content-Type-Options', 'nosniff');
	headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	headers.set('Permissions-Policy', PERMISSIONS_POLICY);
	headers.set('Cross-Origin-Opener-Policy', 'same-origin');

	if (production) {
		headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
	}
}
