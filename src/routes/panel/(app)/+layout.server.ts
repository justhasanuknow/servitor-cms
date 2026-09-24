import { requireActor } from '$lib/server/auth/actor';
import { requiresTwoFactorEnrollment } from '$lib/server/auth/two-factor-policy';
import { getRuntime } from '$lib/server/runtime';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	const { user } = requireActor(locals);
	const restricted =
		user.mustChangePassword === true || requiresTwoFactorEnrollment(getRuntime().db, user);

	return {
		viewer: {
			name: user.name,
			email: user.email,
			role: user.role
		},
		restricted
	};
};
