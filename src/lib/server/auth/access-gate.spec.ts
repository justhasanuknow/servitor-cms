import { describe, expect, it } from 'vitest';
import { PANEL_ROUTES } from '../../constants/routes';
import { resolvePanelRedirect } from './access-gate';
import type { PanelAccessState } from './access-gate.interfaces';

function stateWith(overrides: Partial<PanelAccessState>): PanelAccessState {
	return {
		pathname: PANEL_ROUTES.root,
		signedIn: true,
		mustChangePassword: false,
		twoFactorEnrollmentRequired: false,
		...overrides
	};
}

describe('resolvePanelRedirect', () => {
	it('ignores routes outside the panel', () => {
		expect(resolvePanelRedirect(stateWith({ pathname: '/', signedIn: false }))).toBeNull();
		expect(
			resolvePanelRedirect(stateWith({ pathname: '/panelists', signedIn: false }))
		).toBeNull();
	});

	it('sends anonymous visitors to the login page', () => {
		expect(resolvePanelRedirect(stateWith({ signedIn: false }))).toBe(PANEL_ROUTES.login);
		expect(
			resolvePanelRedirect(stateWith({ pathname: PANEL_ROUTES.sessions, signedIn: false }))
		).toBe(PANEL_ROUTES.login);
		expect(
			resolvePanelRedirect(stateWith({ pathname: PANEL_ROUTES.login, signedIn: false }))
		).toBeNull();
		expect(
			resolvePanelRedirect(
				stateWith({ pathname: PANEL_ROUTES.loginTwoFactor, signedIn: false })
			)
		).toBeNull();
	});

	it('lets anonymous visitors open invitation and password reset links', () => {
		const token = 'a'.repeat(43);

		expect(
			resolvePanelRedirect(
				stateWith({ pathname: `${PANEL_ROUTES.invite}/${token}`, signedIn: false })
			)
		).toBeNull();
		expect(
			resolvePanelRedirect(
				stateWith({ pathname: `${PANEL_ROUTES.resetPassword}/${token}`, signedIn: false })
			)
		).toBeNull();
		expect(
			resolvePanelRedirect(stateWith({ pathname: PANEL_ROUTES.invite, signedIn: false }))
		).toBe(PANEL_ROUTES.login);
	});

	it('sends signed-in users away from the guest pages', () => {
		expect(resolvePanelRedirect(stateWith({ pathname: PANEL_ROUTES.login }))).toBe(
			PANEL_ROUTES.root
		);
		expect(
			resolvePanelRedirect(
				stateWith({ pathname: `${PANEL_ROUTES.invite}/${'a'.repeat(43)}` })
			)
		).toBe(PANEL_ROUTES.root);
	});

	it('allows only the password change page until the password is changed', () => {
		const pending = { mustChangePassword: true, twoFactorEnrollmentRequired: true };

		expect(resolvePanelRedirect(stateWith(pending))).toBe(PANEL_ROUTES.changePassword);
		expect(
			resolvePanelRedirect(stateWith({ ...pending, pathname: PANEL_ROUTES.twoFactor }))
		).toBe(PANEL_ROUTES.changePassword);
		expect(
			resolvePanelRedirect(stateWith({ ...pending, pathname: PANEL_ROUTES.changePassword }))
		).toBeNull();
		expect(
			resolvePanelRedirect(stateWith({ ...pending, pathname: PANEL_ROUTES.logout }))
		).toBeNull();
	});

	it('allows only two-factor enrollment while it is required', () => {
		const pending = { twoFactorEnrollmentRequired: true };

		expect(resolvePanelRedirect(stateWith(pending))).toBe(PANEL_ROUTES.twoFactor);
		expect(
			resolvePanelRedirect(stateWith({ ...pending, pathname: PANEL_ROUTES.twoFactor }))
		).toBeNull();
		expect(
			resolvePanelRedirect(stateWith({ ...pending, pathname: PANEL_ROUTES.logout }))
		).toBeNull();
	});

	it('lets fully set up users through', () => {
		expect(resolvePanelRedirect(stateWith({ pathname: PANEL_ROUTES.sessions }))).toBeNull();
	});
});
