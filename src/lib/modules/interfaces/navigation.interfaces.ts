import type { ResolvedPathname } from '$app/types';

export interface NavigationLink {
	href: ResolvedPathname;
	label: string;
	activePrefix: string;
}
