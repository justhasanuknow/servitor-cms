import type { DocsSection } from '$lib/modules/interfaces/docs.interfaces';

export interface DocsNavigationProps {
	sections: DocsSection[];
	currentSlug: string | null;
}
