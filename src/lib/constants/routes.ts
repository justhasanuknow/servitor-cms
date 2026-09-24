import { MEDIA_ROUTE_PREFIX } from './media';

export const PANEL_ROUTES = {
	root: '/panel',
	login: '/panel/login',
	loginTwoFactor: '/panel/login/two-factor',
	logout: '/panel/logout',
	invite: '/panel/invite',
	resetPassword: '/panel/reset-password',
	forgotPassword: '/panel/forgot-password',
	verifyEmail: '/panel/verify-email',
	profile: '/panel/account/profile',
	changePassword: '/panel/account/password',
	twoFactor: '/panel/account/two-factor',
	sessions: '/panel/account/sessions',
	posts: '/panel/posts',
	media: '/panel/media',
	users: '/panel/users',
	audit: '/panel/audit',
	languages: '/panel/languages',
	categories: '/panel/categories',
	settings: '/panel/settings',
	preview: '/panel/preview'
} as const;

export function isPanelPath(pathname: string): boolean {
	return pathname === PANEL_ROUTES.root || pathname.startsWith(`${PANEL_ROUTES.root}/`);
}

export function isMediaPath(pathname: string): boolean {
	return pathname.startsWith(`${MEDIA_ROUTE_PREFIX}/`);
}
