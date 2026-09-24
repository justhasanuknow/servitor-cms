import type { AuthCookieJar, AuthCookieOptions } from '../auth/cookie-plugin.interfaces';

export class TestCookieJar implements AuthCookieJar {
	readonly #values = new Map<string, string>();

	set(name: string, value: string, options: AuthCookieOptions): void {
		if (options.maxAge !== undefined && options.maxAge <= 0) {
			this.#values.delete(name);

			return;
		}

		if (options.expires !== undefined && options.expires.getTime() <= Date.now()) {
			this.#values.delete(name);

			return;
		}

		this.#values.set(name, value);
	}

	has(name: string): boolean {
		return this.#values.has(name);
	}

	header(): string {
		return [...this.#values]
			.map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
			.join('; ');
	}
}
