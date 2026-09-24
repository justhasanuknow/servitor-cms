import type { DocsSectionId } from '$lib/modules/interfaces/docs.interfaces';
import { m } from '$lib/paraglide/messages';

export function docsSectionLabel(id: DocsSectionId): string {
	switch (id) {
		case 'start':
			return m.docs_section_start();
		case 'operate':
			return m.docs_section_operate();
		case 'use':
			return m.docs_section_use();
		case 'integrate':
			return m.docs_section_integrate();
		case 'reference':
			return m.docs_section_reference();
	}
}
