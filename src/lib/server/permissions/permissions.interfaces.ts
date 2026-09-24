import type { UserRole } from '../../constants/users';

export interface PermissionActor {
	id: string;
	role: UserRole;
	canPublishDirectly: boolean;
	deactivatedAt?: Date | null;
}

export interface UserSubject {
	id: string;
	role: UserRole;
}

export interface PostSubject {
	ownerId: string;
	ownerRole: UserRole;
}

export interface OwnedSubject {
	ownerId: string;
}

export interface NewUserSubject {
	role: UserRole;
}

export interface PermissionResources {
	'user.list': null;
	'user.create': NewUserSubject;
	'user.set_active': UserSubject;
	'user.change_role': UserSubject;
	'user.set_publish_directly': UserSubject;
	'user.create_password_reset_link': UserSubject;
	'post.create': null;
	'post.list': null;
	'post.list_all': null;
	'post.view': PostSubject;
	'post.edit': PostSubject;
	'post.delete': PostSubject;
	'post.publish': PostSubject;
	'post.review': PostSubject;
	'post.moderate': PostSubject;
	'revision.restore': PostSubject;
	'review.list': null;
	'language.manage': null;
	'category.manage': null;
	'api_key.manage': null;
	'webhook.manage': null;
	'cors.manage': null;
	'audit.view': null;
	'settings.manage': null;
	'media.upload': null;
	'media.use': OwnedSubject;
	'media.edit': OwnedSubject;
	'media.delete': OwnedSubject;
	'account.manage': null;
}

export type PermissionAction = keyof PermissionResources;

export type PermissionRules = {
	[Action in PermissionAction]: (
		actor: PermissionActor,
		resource: PermissionResources[Action]
	) => boolean;
};
