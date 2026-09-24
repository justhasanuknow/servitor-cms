import ArchiveRestore from '@lucide/svelte/icons/archive-restore';
import BookOpen from '@lucide/svelte/icons/book-open';
import ClipboardCheck from '@lucide/svelte/icons/clipboard-check';
import FileText from '@lucide/svelte/icons/file-text';
import FolderTree from '@lucide/svelte/icons/folder-tree';
import Globe from '@lucide/svelte/icons/globe';
import Images from '@lucide/svelte/icons/images';
import KeyRound from '@lucide/svelte/icons/key-round';
import Languages from '@lucide/svelte/icons/languages';
import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
import ScrollText from '@lucide/svelte/icons/scroll-text';
import Settings from '@lucide/svelte/icons/settings';
import UserRoundCog from '@lucide/svelte/icons/user-round-cog';
import Users from '@lucide/svelte/icons/users';
import Webhook from '@lucide/svelte/icons/webhook';
import { resolve } from '$app/paths';
import type {
	NavigationGroup,
	NavigationItem,
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
	const content: NavigationItem[] = [
		{
			href: resolve('/panel/posts'),
			label: m.nav_posts(),
			icon: FileText,
			activePrefix: resolve('/panel/posts'),
			exact: false
		},
		{
			href: resolve('/panel/media'),
			label: m.nav_media(),
			icon: Images,
			activePrefix: resolve('/panel/media'),
			exact: false
		}
	];
	const administration: NavigationItem[] = [];
	const integrations: NavigationItem[] = [];

	if (access.reviews) {
		content.push({
			href: resolve('/panel/reviews'),
			label: m.nav_reviews(),
			icon: ClipboardCheck,
			activePrefix: resolve('/panel/reviews'),
			exact: false
		});
	}

	if (access.languages) {
		content.push({
			href: resolve('/panel/languages'),
			label: m.nav_languages(),
			icon: Languages,
			activePrefix: resolve('/panel/languages'),
			exact: false
		});
	}

	if (access.categories) {
		content.push({
			href: resolve('/panel/categories'),
			label: m.nav_categories(),
			icon: FolderTree,
			activePrefix: resolve('/panel/categories'),
			exact: false
		});
	}

	if (access.apiKeys) {
		integrations.push({
			href: resolve('/panel/api-keys'),
			label: m.nav_api_keys(),
			icon: KeyRound,
			activePrefix: resolve('/panel/api-keys'),
			exact: false
		});
	}

	if (access.webhooks) {
		integrations.push({
			href: resolve('/panel/webhooks'),
			label: m.nav_webhooks(),
			icon: Webhook,
			activePrefix: resolve('/panel/webhooks'),
			exact: false
		});
	}

	if (access.cors) {
		integrations.push({
			href: resolve('/panel/cors'),
			label: m.nav_cors(),
			icon: Globe,
			activePrefix: resolve('/panel/cors'),
			exact: false
		});
	}

	if (access.users) {
		administration.push({
			href: resolve('/panel/users'),
			label: m.nav_users(),
			icon: Users,
			activePrefix: resolve('/panel/users'),
			exact: false
		});
	}

	if (access.audit) {
		administration.push({
			href: resolve('/panel/audit'),
			label: m.nav_audit_log(),
			icon: ScrollText,
			activePrefix: resolve('/panel/audit'),
			exact: false
		});
	}

	if (access.settings) {
		administration.push({
			href: resolve('/panel/settings'),
			label: m.nav_settings(),
			icon: Settings,
			activePrefix: resolve('/panel/settings'),
			exact: false
		});
	}

	if (access.backups) {
		administration.push({
			href: resolve('/panel/backups'),
			label: m.nav_backups(),
			icon: ArchiveRestore,
			activePrefix: resolve('/panel/backups'),
			exact: false
		});
	}

	if (content.length > 0) {
		groups.push({ id: 'content', label: m.nav_content(), items: content });
	}

	if (integrations.length > 0) {
		groups.push({ id: 'integrations', label: m.nav_integrations(), items: integrations });
	}

	if (administration.length > 0) {
		groups.push({ id: 'administration', label: m.nav_administration(), items: administration });
	}

	groups.push({
		id: 'help',
		label: m.nav_help(),
		items: [
			{
				href: resolve('/docs'),
				label: m.nav_documentation(),
				icon: BookOpen,
				activePrefix: resolve('/docs'),
				exact: false
			}
		]
	});

	return groups;
}

export function isActiveLink(pathname: string, prefix: string, exact: boolean): boolean {
	if (exact) {
		return pathname === prefix;
	}

	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
