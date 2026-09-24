import { isPanelPath, PANEL_ROUTES } from '../../constants/routes';
import type { PanelAccessState } from './access-gate.interfaces';

const GUEST_PAGES = new Set<string>([
	PANEL_ROUTES.login,
	PANEL_ROUTES.loginTwoFactor,
	PANEL_ROUTES.forgotPassword
]);

const OPEN_PREFIXES = [`${PANEL_ROUTES.verifyEmail}/`];

const GUEST_PREFIXES = [`${PANEL_ROUTES.invite}/`, `${PANEL_ROUTES.resetPassword}/`];

export function resolvePanelRedirect(state: PanelAccessState): string | null {
	if (!isPanelPath(state.pathname)) {
		return null;
	}

	if (OPEN_PREFIXES.some((prefix) => state.pathname.startsWith(prefix))) {
		return null;
	}

	const onGuestPage = isGuestPage(state.pathname);

	if (!state.signedIn) {
		if (onGuestPage) {
			return null;
		}

		return PANEL_ROUTES.login;
	}

	if (onGuestPage) {
		return PANEL_ROUTES.root;
	}

	if (state.pathname === PANEL_ROUTES.logout) {
		return null;
	}

	if (state.mustChangePassword) {
		return redirectUnless(state.pathname, PANEL_ROUTES.changePassword);
	}

	if (state.twoFactorEnrollmentRequired) {
		return redirectUnless(state.pathname, PANEL_ROUTES.twoFactor);
	}

	return null;
}

function isGuestPage(pathname: string): boolean {
	return (
		GUEST_PAGES.has(pathname) || GUEST_PREFIXES.some((prefix) => pathname.startsWith(prefix))
	);
}

function redirectUnless(pathname: string, allowed: string): string | null {
	if (pathname === allowed) {
		return null;
	}

	return allowed;
}
