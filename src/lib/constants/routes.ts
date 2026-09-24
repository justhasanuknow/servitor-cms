export const PANEL_ROUTES = {
	root: '/panel',
	login: '/panel/login',
	loginTwoFactor: '/panel/login/two-factor',
	logout: '/panel/logout',
	invite: '/panel/invite',
	resetPassword: '/panel/reset-password',
	profile: '/panel/account/profile',
	changePassword: '/panel/account/password',
	twoFactor: '/panel/account/two-factor',
	sessions: '/panel/account/sessions',
	users: '/panel/users',
	audit: '/panel/audit',
	languages: '/panel/languages',
	categories: '/panel/categories',
	settings: '/panel/settings'
} as const;

export function isPanelPath(pathname: string): boolean {
	return pathname === PANEL_ROUTES.root || pathname.startsWith(`${PANEL_ROUTES.root}/`);
}
