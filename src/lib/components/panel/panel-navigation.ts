import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
import ScrollText from '@lucide/svelte/icons/scroll-text';
import UserRoundCog from '@lucide/svelte/icons/user-round-cog';
import Users from '@lucide/svelte/icons/users';
import { resolve } from '$app/paths';
import type {
	NavigationGroup,
	PanelNavigationAccess
} from '$lib/modules/interfaces/navigation.interfaces';
import { m } from '$lib/paraglide/messages';

export function panelNavigation(access: PanelNavigationAccess): NavigationGroup[] {
	const groups: NavigationGroup[] = [
		{
			id: 'overview',
			label: m.nav_overview(),
			items: [
				{
					href: resolve('/panel'),
					label: m.nav_dashboard(),
					icon: LayoutDashboard,
					activePrefix: resolve('/panel'),
					exact: true
				},
				{
					href: resolve('/panel/account/profile'),
					label: m.nav_my_account(),
					icon: UserRoundCog,
					activePrefix: `${resolve('/panel')}/account`,
					exact: false
				}
			]
		}
	];
	const administration: NavigationGroup = {
		id: 'administration',
		label: m.nav_administration(),
		items: []
	};

	if (access.users) {
		administration.items.push({
			href: resolve('/panel/users'),
			label: m.nav_users(),
			icon: Users,
			activePrefix: resolve('/panel/users'),
			exact: false
		});
	}

	if (access.audit) {
		administration.items.push({
			href: resolve('/panel/audit'),
			label: m.nav_audit_log(),
			icon: ScrollText,
			activePrefix: resolve('/panel/audit'),
			exact: false
		});
	}

	if (administration.items.length > 0) {
		groups.push(administration);
	}

	return groups;
}

export function isActiveLink(pathname: string, prefix: string, exact: boolean): boolean {
	if (exact) {
		return pathname === prefix;
	}

	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
