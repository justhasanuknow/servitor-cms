import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { requireAccountActor } from '$lib/server/auth/actor';
import { createAuthRequest } from '$lib/server/auth/auth-request';
import { codeField, optionalCodeField, passwordField } from '$lib/server/auth/form-fields';
import { qrCodeShape } from '$lib/server/auth/qr-code';
import { requiresTwoFactorEnrollment } from '$lib/server/auth/two-factor-policy';
import {
	confirmTwoFactorEnrollment,
	countRemainingBackupCodes,
	disableTwoFactor,
	hasPendingEnrollment,
	regenerateBackupCodes,
	startTwoFactorEnrollment
} from '$lib/server/auth/two-factor-settings';
import { readFormFields } from '$lib/server/http/form';
import { getRuntime } from '$lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

const passwordSchema = z.object({ password: passwordField });

const confirmSchema = z.object({ code: codeField });

const protectedActionSchema = z.object({
	password: passwordField,
	totpCode: optionalCodeField
});

export const load: PageServerLoad = ({ locals }) => {
	const { user } = requireAccountActor(locals);
	const { db } = getRuntime();

	return {
		enabled: user.twoFactorEnabled === true,
		required: requiresTwoFactorEnrollment(db, user),
		pending: user.twoFactorEnabled !== true && hasPendingEnrollment(db, user.id),
		backupCodesRemaining: countRemainingBackupCodes(db, user.id)
	};
};

export const actions: Actions = {
	enable: async (event) => {
		const { user } = requireAccountActor(event.locals);
		const form = passwordSchema.safeParse(await readFormFields(event.request));

		if (!form.success) {
			return fail(400, { action: 'enable' as const, error: 'invalid_input' as const });
		}

		const result = await startTwoFactorEnrollment(
			getRuntime(),
			createAuthRequest(event),
			user,
			form.data.password
		);

		if (result.status !== 'started') {
			return fail(400, { action: 'enable' as const, error: result.status });
		}

		return {
			action: 'enable' as const,
			enrollment: {
				qrCode: qrCodeShape(result.enrollment.totpUri),
				secret: result.enrollment.secret,
				backupCodes: result.enrollment.backupCodes
			}
		};
	},
	confirm: async (event) => {
		const { user } = requireAccountActor(event.locals);
		const form = confirmSchema.safeParse(await readFormFields(event.request));

		if (!form.success) {
			return fail(400, { action: 'confirm' as const, error: 'invalid_input' as const });
		}

		const result = await confirmTwoFactorEnrollment(
			getRuntime(),
			createAuthRequest(event),
			user,
			form.data.code
		);

		if (result !== 'enabled') {
			return fail(400, { action: 'confirm' as const, error: result });
		}

		return { action: 'confirm' as const, success: true };
	},
	disable: async (event) => {
		const { user, session } = requireAccountActor(event.locals);
		const form = protectedActionSchema.safeParse(await readFormFields(event.request));

		if (!form.success) {
			return fail(400, { action: 'disable' as const, error: 'invalid_input' as const });
		}

		const result = await disableTwoFactor(
			getRuntime(),
			createAuthRequest(event),
			user,
			session.id,
			form.data
		);

		if (result !== 'disabled') {
			return fail(400, { action: 'disable' as const, error: result });
		}

		return { action: 'disable' as const, success: true };
	},
	regenerate: async (event) => {
		const { user } = requireAccountActor(event.locals);
		const form = protectedActionSchema.safeParse(await readFormFields(event.request));

		if (!form.success) {
			return fail(400, { action: 'regenerate' as const, error: 'invalid_input' as const });
		}

		const result = await regenerateBackupCodes(
			getRuntime(),
			createAuthRequest(event),
			user,
			form.data
		);

		if (result.status !== 'regenerated') {
			return fail(400, { action: 'regenerate' as const, error: result.status });
		}

		return { action: 'regenerate' as const, backupCodes: result.backupCodes };
	}
};
