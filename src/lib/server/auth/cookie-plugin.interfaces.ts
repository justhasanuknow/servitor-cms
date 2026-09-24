export interface AuthCookieOptions {
	path: string;
	maxAge?: number;
	expires?: Date;
	domain?: string;
	secure?: boolean;
	httpOnly?: boolean;
	sameSite?: 'strict' | 'lax' | 'none';
	partitioned?: boolean;
}

export interface AuthCookieJar {
	set(name: string, value: string, options: AuthCookieOptions): void;
}
