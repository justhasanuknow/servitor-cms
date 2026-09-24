import { confirmTwoFactorEnrollment, startTwoFactorEnrollment } from '../auth/two-factor-settings';
import type { createTestRuntime } from './runtime';
import type { TwoFactorUser } from './two-factor.interfaces';
import { generateTotp } from './totp';

const STEP_MS = 30_000;

export async function signInWithTwoFactor(
	harness: ReturnType<typeof createTestRuntime>,
	email: string,
	password: string
): Promise<TwoFactorUser> {
	const { jar, actor } = await harness.signIn(email, password);
	const started = await startTwoFactorEnrollment(
		harness.runtime,
		harness.request(jar),
		actor,
		password
	);

	if (started.status !== 'started') {
		throw new Error(`Two-factor enrollment did not start: ${started.status}`);
	}

	const confirmed = await confirmTwoFactorEnrollment(
		harness.runtime,
		harness.request(jar),
		actor,
		generateTotp(started.enrollment.secret)
	);

	if (confirmed !== 'enabled') {
		throw new Error(`Two-factor enrollment failed: ${confirmed}`);
	}

	const current = await harness.currentSession(jar);

	return {
		jar,
		actor: current.user,
		spareCodes: [
			generateTotp(started.enrollment.secret, Date.now() + STEP_MS),
			generateTotp(started.enrollment.secret, Date.now() - STEP_MS)
		]
	};
}
