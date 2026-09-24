import type { PublicLanguage } from '../../modules/interfaces/public.interfaces';

export interface TermListingInput {
	siteName: string;
	language: PublicLanguage;
	heading: string;
	path: string;
	page: number;
}
