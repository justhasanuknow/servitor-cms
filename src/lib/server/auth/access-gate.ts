import { PANEL_ROUTES } from '../../constants/routes';
import type { PanelAccessState } from './access-gate.interfaces';

export function resolvePanelRedirect(state: PanelAccessState): string | null {
	if (!isPanelPath(state.pathname)) {
		return null;
	}

	const onLoginPage =
		state.pathname === PANEL_ROUTES.login || state.pathname === PANEL_ROUTES.loginTwoFactor;

	if (!state.signedIn) {
		if (onLoginPage) {
			return null;
		}

		return PANEL_ROUTES.login;
	}

	if (onLoginPage) {
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

function isPanelPath(pathname: string): boolean {
	return pathname === PANEL_ROUTES.root || pathname.startsWith(`${PANEL_ROUTES.root}/`);
}

function redirectUnless(pathname: string, allowed: string): string | null {
	if (pathname === allowed) {
		return null;
	}

	return allowed;
}
