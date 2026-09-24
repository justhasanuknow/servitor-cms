import type { LucideIcon } from '@lucide/svelte';
import type { ResolvedPathname } from '$app/types';

export interface NavigationLink {
	href: ResolvedPathname;
	label: string;
	activePrefix: string;
}

export interface NavigationItem extends NavigationLink {
	icon: LucideIcon;
	exact: boolean;
}

export interface NavigationGroup {
	id: string;
	label: string;
	items: NavigationItem[];
}

export interface PanelNavigationAccess {
	reviews: boolean;
	users: boolean;
	audit: boolean;
	languages: boolean;
	categories: boolean;
	settings: boolean;
	apiKeys: boolean;
	cors: boolean;
	webhooks: boolean;
}
