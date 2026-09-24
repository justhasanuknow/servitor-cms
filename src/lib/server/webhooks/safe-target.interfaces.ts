export interface ResolvedAddress {
	address: string;
	family: 4 | 6;
}

export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;

export interface TargetOptions {
	allowPrivate: boolean;
	resolve: Resolver;
}

export type TargetRejection =
	| 'unsupported_scheme'
	| 'credentials_in_url'
	| 'dns_failed'
	| 'blocked_address'
	| 'private_address'
	| 'insecure_scheme';

export type TargetResult =
	| { status: 'ok'; address: string; family: 4 | 6 }
	| { status: 'rejected'; reason: TargetRejection };
