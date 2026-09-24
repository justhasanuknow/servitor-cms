import { DOCS_ROUTE } from '../../constants/routes';
import type { DocsPath } from '../../modules/interfaces/docs.interfaces';
import { DOCS_INDEX_FILE } from './docs-manifest';

const DOCS_FILE_LINK = /^([A-Za-z0-9-]+\.md)(#[^\s]*)?$/;

export function docsSlug(file: string): string {
	return file.replace(/\.md$/, '').toLowerCase();
}

export function docsFileHref(file: string): DocsPath {
	if (file === DOCS_INDEX_FILE) {
		return DOCS_ROUTE;
	}

	return `${DOCS_ROUTE}/${docsSlug(file)}`;
}

export function docsHref(href: string): string {
	const match = DOCS_FILE_LINK.exec(href);

	if (match === null) {
		return href;
	}

	return `${docsFileHref(match[1])}${match[2] ?? ''}`;
}
