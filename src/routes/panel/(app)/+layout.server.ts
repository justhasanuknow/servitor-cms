import { requireActor } from '$lib/server/auth/actor';
import { requiresTwoFactorEnrollment } from '$lib/server/auth/two-factor-policy';
import { can } from '$lib/server/permissions/permissions';
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
		restricted,
		navigation: {
			reviews: can(user, 'review.list', null),
			users: can(user, 'user.list', null),
			audit: can(user, 'audit.view', null),
			languages: can(user, 'language.manage', null),
			categories: can(user, 'category.manage', null),
			settings: can(user, 'settings.manage', null),
			backups: can(user, 'backup.manage', null),
			apiKeys: can(user, 'api_key.manage', null),
			cors: can(user, 'cors.manage', null),
			webhooks: can(user, 'webhook.manage', null)
		}
	};
};
