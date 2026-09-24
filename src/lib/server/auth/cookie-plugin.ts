import type { BetterAuthPlugin } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { parseSetCookieHeader, toCookieOptions, type CookieAttributes } from 'better-auth/cookies';
import { browserCookieName, isSecureAuthCookie } from './auth-cookies';
import type { AuthCookieJar, AuthCookieOptions } from './cookie-plugin.interfaces';

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
							jar.set(
								browserCookieName(name),
								attributes.value,
								jarOptions(name, attributes)
							);
						}
					})
				}
			]
		}
	} satisfies BetterAuthPlugin;
}

function jarOptions(name: string, attributes: CookieAttributes): AuthCookieOptions {
	const options = toCookieOptions(attributes);

	if (!isSecureAuthCookie(name)) {
		return { ...options, path: attributes.path ?? '/' };
	}

	return {
		path: '/',
		secure: true,
		httpOnly: options.httpOnly,
		sameSite: options.sameSite,
		maxAge: options.maxAge,
		expires: options.expires
	};
}
