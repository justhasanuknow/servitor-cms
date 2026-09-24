import { error } from '@sveltejs/kit';
import type { UserRole } from '../../constants/users';
import { reportSecurityEvent } from '../security/security-events';
import type {
	PermissionAction,
	PermissionActor,
	PermissionResources,
	PermissionRules,
	PostSubject,
	UserSubject
} from './permissions.interfaces';

const RULES: PermissionRules = {
	'user.list': (actor) => isStaff(actor),
	'user.create': (actor, subject) => canManageRole(actor, subject.role),
	'user.set_active': (actor, target) =>
		isOther(actor, target) && canManageRole(actor, target.role),
	'user.change_role': (actor, target) =>
		actor.role === 'founder' && isOther(actor, target) && target.role !== 'founder',
	'user.set_publish_directly': (actor, target) => isStaff(actor) && target.role === 'author',
	'user.create_password_reset_link': (actor, target) =>
		isOther(actor, target) && canManageRole(actor, target.role),
	'post.create': () => true,
	'post.list': () => true,
	'post.list_all': (actor) => isStaff(actor),
	'post.view': (actor, post) => isOwner(actor, post) || isStaff(actor),
	'post.edit': (actor, post) => isOwner(actor, post),
	'post.delete': (actor, post) => isOwner(actor, post),
	'post.publish': (actor, post) => isOwner(actor, post) && publishesDirectly(actor),
	'post.review': (actor, post) =>
		isStaff(actor) && !isOwner(actor, post) && post.ownerRole === 'author',
	'post.moderate': (actor, post) => !isOwner(actor, post) && canModerate(actor, post),
	'revision.restore': (actor, post) => isOwner(actor, post),
	'review.list': (actor) => isStaff(actor),
	'language.manage': (actor) => isStaff(actor),
	'category.manage': (actor) => isStaff(actor),
	'api_key.manage': (actor) => isStaff(actor),
	'webhook.manage': (actor) => isStaff(actor),
	'cors.manage': (actor) => isStaff(actor),
	'audit.view': (actor) => isStaff(actor),
	'settings.manage': (actor) => actor.role === 'founder',
	'media.upload': () => true,
	'media.use': (actor, media) => media.ownerId === actor.id,
	'media.edit': (actor, media) => media.ownerId === actor.id,
	'media.delete': (actor, media) => media.ownerId === actor.id,
	'account.manage': () => true
};

export function can<Action extends PermissionAction>(
	actor: PermissionActor | null,
	action: Action,
	resource: PermissionResources[Action]
): boolean {
	if (actor === null || isDeactivated(actor)) {
		return false;
	}

	return RULES[action](actor, resource);
}

export function requirePermission<Action extends PermissionAction>(
	actor: PermissionActor | null,
	action: Action,
	resource: PermissionResources[Action]
): void {
	if (!can(actor, action, resource)) {
		reportSecurityEvent({ type: 'permission_denied', actorId: actor?.id ?? null, action });
		error(403, { message: 'Forbidden' });
	}
}

export function publishesDirectly(actor: PermissionActor): boolean {
	return isStaff(actor) || actor.canPublishDirectly;
}

function isStaff(actor: PermissionActor): boolean {
	return actor.role === 'founder' || actor.role === 'admin';
}

function isOther(actor: PermissionActor, target: UserSubject): boolean {
	return actor.id !== target.id;
}

function isOwner(actor: PermissionActor, post: PostSubject): boolean {
	return actor.id === post.ownerId;
}

function isDeactivated(actor: PermissionActor): boolean {
	return actor.deactivatedAt !== undefined && actor.deactivatedAt !== null;
}

function canManageRole(actor: PermissionActor, role: UserRole): boolean {
	if (actor.role === 'founder') {
		return role === 'admin' || role === 'author';
	}

	if (actor.role === 'admin') {
		return role === 'author';
	}

	return false;
}

function canModerate(actor: PermissionActor, post: PostSubject): boolean {
	if (actor.role === 'founder') {
		return post.ownerRole === 'admin' || post.ownerRole === 'author';
	}

	if (actor.role === 'admin') {
		return post.ownerRole === 'author';
	}

	return false;
}
