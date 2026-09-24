import type { BetterAuthPlugin } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { parseSetCookieHeader, toCookieOptions } from 'better-auth/cookies';
import type { AuthCookieJar } from './cookie-plugin.interfaces';

export function requestCookies(currentJar: () => AuthCookieJar | undefined) {
	return {
		id: 'servitor-request-cookies',
		hooks: {
			after: [
				{
					matcher: () => true,
					handler: createAuthMiddleware(async (ctx) => {
						const setCookie = ctx.context.responseHeaders?.get('set-cookie');

						if (!setCookie) {
							return;
						}

						const jar = currentJar();

						if (!jar) {
							return;
						}

						for (const [name, attributes] of parseSetCookieHeader(setCookie)) {
							jar.set(name, attributes.value, {
								...toCookieOptions(attributes),
								path: attributes.path ?? '/'
							});
						}
					})
				}
			]
		}
	} satisfies BetterAuthPlugin;
}
