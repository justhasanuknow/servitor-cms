export interface CorsOriginView {
	id: string;
	origin: string;
	createdAt: Date;
	createdByName: string;
}

export type CorsOriginAddResult = 'added' | 'invalid_origin' | 'exists' | 'too_many';

export type CorsOriginRemoveResult = 'removed' | 'not_found';
