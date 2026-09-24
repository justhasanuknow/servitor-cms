import { error } from '@sveltejs/kit';
import { m } from '../../paraglide/messages';
import { defaultLanguageCode } from '../languages/languages';
import type { Runtime } from '../runtime.interfaces';
import { listPublicPosts } from './public-posts';
import type { PublicListFilter } from './public-posts.interfaces';
import type { TermListingInput } from './listing-page.interfaces';
import { listingSeo } from './seo';

export function termListing(runtime: Runtime, input: TermListingInput, filter: PublicListFilter) {
	const { db, env } = runtime;
	const listing = listPublicPosts(db, input.language.code, input.page, filter);

	if (listing === null) {
		error(404, { message: 'Not found' });
	}

	let documentTitle = `${input.heading} · ${input.siteName}`;

	if (input.page > 1) {
		documentTitle = m.public_page_title({ title: documentTitle, page: String(input.page) });
	}

	return {
		heading: input.heading,
		listing,
		seo: listingSeo({
			origin: env.ORIGIN,
			siteName: input.siteName,
			defaultLanguage: defaultLanguageCode(db),
			languageCode: input.language.code,
			documentTitle,
			title: input.heading,
			description: '',
			path: input.path,
			page: input.page,
			pageCount: listing.pageCount,
			feedTitle: `${input.siteName} · ${input.language.nativeName}`,
			translatedPaths: null
		})
	};
}
