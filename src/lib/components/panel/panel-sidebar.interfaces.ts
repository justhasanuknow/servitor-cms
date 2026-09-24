import type { NavigationGroup } from '$lib/modules/interfaces/navigation.interfaces';

export interface PanelSidebarProps {
	groups: NavigationGroup[];
	viewerName: string;
	viewerRole: string;
	onNavigate?: () => void;
}
