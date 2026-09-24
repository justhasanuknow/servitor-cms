import type { BetterAuthPlugin } from 'better-auth';
import { createAuthEndpoint } from 'better-auth/api';

const TWO_FACTOR_COOKIE_NAME = 'two_factor';

export function twoFactorChallenge() {
	return {
		id: 'servitor-two-factor-challenge',
		endpoints: {
			getTwoFactorChallenge: createAuthEndpoint.serverOnly(
				{ method: 'GET', requireHeaders: true },
				async (ctx) => {
					const cookie = ctx.context.createAuthCookie(TWO_FACTOR_COOKIE_NAME);
					const identifier = await ctx.getSignedCookie(cookie.name, ctx.context.secret);

					if (!identifier) {
						return ctx.json({ userId: null });
					}

					const verification =
						await ctx.context.internalAdapter.findVerificationValue(identifier);

					if (!verification || verification.expiresAt.getTime() <= Date.now()) {
						return ctx.json({ userId: null });
					}

					return ctx.json({ userId: verification.value });
				}
			)
		}
	} satisfies BetterAuthPlugin;
}
