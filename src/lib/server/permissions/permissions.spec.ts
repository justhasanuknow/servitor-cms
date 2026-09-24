import { describe, expect, it } from 'vitest';
import type { UserRole } from '../../constants/users';
import { can, requirePermission } from './permissions';
import type {
	PermissionAction,
	PermissionActor,
	PermissionResources,
	PostSubject,
	UserSubject
} from './permissions.interfaces';

function actor(id: string, role: UserRole, canPublishDirectly = false): PermissionActor {
	return { id, role, canPublishDirectly, deactivatedAt: null };
}

const founder = actor('founder', 'founder');
const admin = actor('admin', 'admin');
const otherAdmin = actor('admin-2', 'admin');
const author = actor('author', 'author');
const trustedAuthor = actor('trusted-author', 'author', true);
const otherAuthor = actor('author-2', 'author');

const ACTOR_KEYS = ['founder', 'admin', 'author', 'trustedAuthor'] as const;

type ActorKey = (typeof ACTOR_KEYS)[number];

const everyone: Record<ActorKey, PermissionActor> = { founder, admin, author, trustedAuthor };

function subject(target: PermissionActor): UserSubject {
	return { id: target.id, role: target.role };
}

function postOf(owner: PermissionActor): PostSubject {
	return { ownerId: owner.id, ownerRole: owner.role };
}

interface PermissionCase {
	name: string;
	actor: PermissionActor;
	check: (candidate: PermissionActor) => boolean;
	expected: boolean;
}

function row<Action extends PermissionAction>(
	title: string,
	action: Action,
	resource: PermissionResources[Action],
	expectations: Record<ActorKey, boolean>
): PermissionCase[] {
	return ACTOR_KEYS.map((key) => ({
		name: `${title}: ${key} -> ${String(expectations[key])}`,
		actor: everyone[key],
		check: (current: PermissionActor) => can(current, action, resource),
		expected: expectations[key]
	}));
}

function single<Action extends PermissionAction>(
	title: string,
	candidate: PermissionActor,
	action: Action,
	resource: PermissionResources[Action],
	expected: boolean
): PermissionCase {
	return {
		name: `${title} -> ${String(expected)}`,
		actor: candidate,
		check: (current) => can(current, action, resource),
		expected
	};
}

const matrix: PermissionCase[] = [
	...row(
		'create admin',
		'user.create',
		{ role: 'admin' },
		{
			founder: true,
			admin: false,
			author: false,
			trustedAuthor: false
		}
	),
	...row(
		'create author',
		'user.create',
		{ role: 'author' },
		{
			founder: true,
			admin: true,
			author: false,
			trustedAuthor: false
		}
	),
	...row(
		'create founder',
		'user.create',
		{ role: 'founder' },
		{
			founder: false,
			admin: false,
			author: false,
			trustedAuthor: false
		}
	),
	...row('deactivate or reactivate an admin', 'user.set_active', subject(otherAdmin), {
		founder: true,
		admin: false,
		author: false,
		trustedAuthor: false
	}),
	...row('deactivate or reactivate an author', 'user.set_active', subject(otherAuthor), {
		founder: true,
		admin: true,
		author: false,
		trustedAuthor: false
	}),
	...row('deactivate or reactivate the founder', 'user.set_active', subject(founder), {
		founder: false,
		admin: false,
		author: false,
		trustedAuthor: false
	}),
	...row('change the role of an admin', 'user.change_role', subject(otherAdmin), {
		founder: true,
		admin: false,
		author: false,
		trustedAuthor: false
	}),
	...row('change the role of an author', 'user.change_role', subject(otherAuthor), {
		founder: true,
		admin: false,
		author: false,
		trustedAuthor: false
	}),
	...row('change the role of the founder', 'user.change_role', subject(founder), {
		founder: false,
		admin: false,
		author: false,
		trustedAuthor: false
	}),
	...row(
		'grant or revoke direct publishing for an author',
		'user.set_publish_directly',
		subject(otherAuthor),
		{
			founder: true,
			admin: true,
			author: false,
			trustedAuthor: false
		}
	),
	...row(
		'grant or revoke direct publishing for an admin',
		'user.set_publish_directly',
		subject(otherAdmin),
		{
			founder: false,
			admin: false,
			author: false,
			trustedAuthor: false
		}
	),
	...row(
		'create a password reset link for an author',
		'user.create_password_reset_link',
		subject(otherAuthor),
		{
			founder: true,
			admin: true,
			author: false,
			trustedAuthor: false
		}
	),
	...row(
		'create a password reset link for an admin',
		'user.create_password_reset_link',
		subject(otherAdmin),
		{
			founder: true,
			admin: false,
			author: false,
			trustedAuthor: false
		}
	),
	...row(
		'create a password reset link for the founder',
		'user.create_password_reset_link',
		subject(founder),
		{
			founder: false,
			admin: false,
			author: false,
			trustedAuthor: false
		}
	),
	...row('view the user list', 'user.list', null, {
		founder: true,
		admin: true,
		author: false,
		trustedAuthor: false
	}),
	...row('create posts', 'post.create', null, {
		founder: true,
		admin: true,
		author: true,
		trustedAuthor: true
	}),
	...row("edit another author's post", 'post.edit', postOf(otherAuthor), {
		founder: false,
		admin: false,
		author: false,
		trustedAuthor: false
	}),
	...row("delete another author's post", 'post.delete', postOf(otherAuthor), {
		founder: false,
		admin: false,
		author: false,
		trustedAuthor: false
	}),
	...row("publish another author's post", 'post.publish', postOf(otherAuthor), {
		founder: false,
		admin: false,
		author: false,
		trustedAuthor: false
	}),
	...row("approve or reject an author's submission", 'post.review', postOf(otherAuthor), {
		founder: true,
		admin: true,
		author: false,
		trustedAuthor: false
	}),
	...row("approve or reject an admin's post", 'post.review', postOf(otherAdmin), {
		founder: false,
		admin: false,
		author: false,
		trustedAuthor: false
	}),
	...row("hide or unhide an author's post", 'post.moderate', postOf(otherAuthor), {
		founder: true,
		admin: true,
		author: false,
		trustedAuthor: false
	}),
	...row("hide or unhide an admin's post", 'post.moderate', postOf(otherAdmin), {
		founder: true,
		admin: false,
		author: false,
		trustedAuthor: false
	}),
	...row("hide or unhide the founder's post", 'post.moderate', postOf(founder), {
		founder: false,
		admin: false,
		author: false,
		trustedAuthor: false
	}),
	...row("view another author's post and revisions", 'post.view', postOf(otherAuthor), {
		founder: true,
		admin: true,
		author: false,
		trustedAuthor: false
	}),
	...row('list own posts', 'post.list', null, {
		founder: true,
		admin: true,
		author: true,
		trustedAuthor: true
	}),
	...row("list everyone's posts", 'post.list_all', null, {
		founder: true,
		admin: true,
		author: false,
		trustedAuthor: false
	}),
	...row("restore another author's revision", 'revision.restore', postOf(otherAuthor), {
		founder: false,
		admin: false,
		author: false,
		trustedAuthor: false
	}),
	...row('manage content languages', 'language.manage', null, {
		founder: true,
		admin: true,
		author: false,
		trustedAuthor: false
	}),
	...row('manage categories', 'category.manage', null, {
		founder: true,
		admin: true,
		author: false,
		trustedAuthor: false
	}),
	...row('manage API keys', 'api_key.manage', null, {
		founder: true,
		admin: true,
		author: false,
		trustedAuthor: false
	}),
	...row('manage webhooks', 'webhook.manage', null, {
		founder: true,
		admin: true,
		author: false,
		trustedAuthor: false
	}),
	...row('manage the CORS allowlist', 'cors.manage', null, {
		founder: true,
		admin: true,
		author: false,
		trustedAuthor: false
	}),
	...row('view the audit log', 'audit.view', null, {
		founder: true,
		admin: true,
		author: false,
		trustedAuthor: false
	}),
	...row('change system settings', 'settings.manage', null, {
		founder: true,
		admin: false,
		author: false,
		trustedAuthor: false
	}),
	...row('upload media', 'media.upload', null, {
		founder: true,
		admin: true,
		author: true,
		trustedAuthor: true
	}),
	...row(
		"delete another user's media",
		'media.delete',
		{ ownerId: otherAuthor.id },
		{
			founder: false,
			admin: false,
			author: false,
			trustedAuthor: false
		}
	),
	...row(
		"insert another user's media into content",
		'media.use',
		{ ownerId: otherAuthor.id },
		{
			founder: false,
			admin: false,
			author: false,
			trustedAuthor: false
		}
	),
	...row(
		"edit the alt text of another user's media",
		'media.edit',
		{ ownerId: otherAuthor.id },
		{
			founder: false,
			admin: false,
			author: false,
			trustedAuthor: false
		}
	),
	...row('edit the own profile, password, 2FA, theme and UI language', 'account.manage', null, {
		founder: true,
		admin: true,
		author: true,
		trustedAuthor: true
	})
];

const ownResources: PermissionCase[] = Object.entries(everyone).flatMap(([key, owner]) => [
	single(`${key} edits an own post`, owner, 'post.edit', postOf(owner), true),
	single(`${key} deletes an own post`, owner, 'post.delete', postOf(owner), true),
	single(`${key} views an own post`, owner, 'post.view', postOf(owner), true),
	single(`${key} restores an own revision`, owner, 'revision.restore', postOf(owner), true),
	single(`${key} deletes own media`, owner, 'media.delete', { ownerId: owner.id }, true),
	single(`${key} inserts own media`, owner, 'media.use', { ownerId: owner.id }, true),
	single(`${key} edits own media alt text`, owner, 'media.edit', { ownerId: owner.id }, true),
	single(`${key} hides an own post`, owner, 'post.moderate', postOf(owner), false),
	single(`${key} approves an own submission`, owner, 'post.review', postOf(owner), false)
]);

const directPublishing: PermissionCase[] = [
	single('founder publishes an own post', founder, 'post.publish', postOf(founder), true),
	single('admin publishes an own post', admin, 'post.publish', postOf(admin), true),
	single('author publishes an own post', author, 'post.publish', postOf(author), false),
	single(
		'trusted author publishes an own post',
		trustedAuthor,
		'post.publish',
		postOf(trustedAuthor),
		true
	)
];

const selfManagement: PermissionCase[] = [
	single('founder deactivates themselves', founder, 'user.set_active', subject(founder), false),
	single('admin deactivates themselves', admin, 'user.set_active', subject(admin), false),
	single('author deactivates themselves', author, 'user.set_active', subject(author), false),
	single('founder changes their own role', founder, 'user.change_role', subject(founder), false),
	single('admin changes their own role', admin, 'user.change_role', subject(admin), false),
	single('author changes their own role', author, 'user.change_role', subject(author), false),
	single(
		'admin creates a reset link for themselves',
		admin,
		'user.create_password_reset_link',
		subject(admin),
		false
	),
	single('admin deactivates the founder', admin, 'user.set_active', subject(founder), false),
	single(
		'admin creates a reset link for the founder',
		admin,
		'user.create_password_reset_link',
		subject(founder),
		false
	)
];

describe('permission matrix', () => {
	it.each([...matrix, ...ownResources, ...directPublishing, ...selfManagement])(
		'$name',
		({ actor: candidate, check, expected }) => {
			expect(check(candidate)).toBe(expected);
		}
	);
});

describe('inactive or missing actors', () => {
	it('denies every action to deactivated users', () => {
		const deactivated: PermissionActor = { ...admin, deactivatedAt: new Date() };

		expect(can(deactivated, 'user.list', null)).toBe(false);
		expect(can(deactivated, 'post.create', null)).toBe(false);
		expect(can(deactivated, 'account.manage', null)).toBe(false);
		expect(can(deactivated, 'post.edit', postOf(deactivated))).toBe(false);
	});

	it('denies every action without an actor', () => {
		expect(can(null, 'post.create', null)).toBe(false);
		expect(can(null, 'media.upload', null)).toBe(false);
	});

	it('throws a 403 error when a permission is missing', () => {
		expect(() => requirePermission(author, 'user.list', null)).toThrow(
			expect.objectContaining({ status: 403 })
		);
		expect(() => requirePermission(admin, 'user.list', null)).not.toThrow();
	});
});
