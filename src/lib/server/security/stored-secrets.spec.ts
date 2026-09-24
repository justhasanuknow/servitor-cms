import { symmetricDecrypt } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { confirmTwoFactorEnrollment, startTwoFactorEnrollment } from '../auth/two-factor-settings';
import { twoFactor, webhooks } from '../db/schema';
import { createTestRuntime } from '../testing/runtime';
import { generateTotp } from '../testing/totp';
import { decryptSecret, encryptSecret } from '../webhooks/secret-box';
import { secretKeys, secretVersion } from './secret-keys';
import { reencryptStoredSecrets } from './stored-secrets';

const EMAIL = 'founder@example.com';

const PASSWORD = 'Kx7-quiet-harbor-19';

const NEW_SECRET = 'n'.repeat(48);

let harness: ReturnType<typeof createTestRuntime>;

beforeEach(() => {
	harness = createTestRuntime();
});

afterEach(() => {
	harness.dispose();
});

function onlyKey(secret: string) {
	return {
		keys: new Map([[secretVersion(secret), secret]]),
		currentVersion: secretVersion(secret)
	};
}

async function seedSecrets(): Promise<{ totpSecret: string; webhookId: string }> {
	const userId = await harness.createUser({ email: EMAIL, password: PASSWORD, role: 'founder' });
	const { jar, actor } = await harness.signIn(EMAIL, PASSWORD);
	const started = await startTwoFactorEnrollment(
		harness.runtime,
		harness.request(jar),
		actor,
		PASSWORD
	);

	if (started.status !== 'started') {
		throw new Error(`Enrollment did not start: ${started.status}`);
	}

	await confirmTwoFactorEnrollment(
		harness.runtime,
		harness.request(jar),
		actor,
		generateTotp(started.enrollment.secret)
	);

	const stored = harness.runtime.db.select().from(twoFactor).get();
	const webhookId = crypto.randomUUID();

	harness.runtime.db
		.insert(webhooks)
		.values({
			id: webhookId,
			url: 'https://hooks.example.com',
			events: ['post.published'],
			secretCiphertext: encryptSecret('whsec_value', secretKeys(harness.runtime.env)),
			createdBy: userId
		})
		.run();

	return {
		totpSecret: await symmetricDecrypt({
			key: onlyKey(harness.runtime.env.BETTER_AUTH_SECRET),
			data: stored?.secret ?? ''
		}),
		webhookId
	};
}

describe('reencryptStoredSecrets', () => {
	it('moves every stored secret to the current key after a rotation', async () => {
		const { totpSecret, webhookId } = await seedSecrets();
		const rotated = { current: NEW_SECRET, previous: [harness.runtime.env.BETTER_AUTH_SECRET] };

		expect(await reencryptStoredSecrets(harness.runtime.db, rotated)).toEqual({
			reencrypted: 2,
			unreadable: 0
		});

		const webhook = harness.runtime.db
			.select()
			.from(webhooks)
			.where(eq(webhooks.id, webhookId))
			.get();
		const stored = harness.runtime.db.select().from(twoFactor).get();

		expect(
			decryptSecret(webhook?.secretCiphertext ?? '', { current: NEW_SECRET, previous: [] })
		).toBe('whsec_value');
		expect(stored?.secret.startsWith(`$ba$${secretVersion(NEW_SECRET)}$`)).toBe(true);
		expect(
			await symmetricDecrypt({ key: onlyKey(NEW_SECRET), data: stored?.secret ?? '' })
		).toBe(totpSecret);
		expect(await reencryptStoredSecrets(harness.runtime.db, rotated)).toEqual({
			reencrypted: 0,
			unreadable: 0
		});
	});

	it('reports secrets that no configured key can open and leaves them untouched', async () => {
		await seedSecrets();

		const before = harness.runtime.db.select().from(twoFactor).get();

		expect(
			await reencryptStoredSecrets(harness.runtime.db, { current: NEW_SECRET, previous: [] })
		).toEqual({ reencrypted: 0, unreadable: 2 });
		expect(harness.runtime.db.select().from(twoFactor).get()?.secret).toBe(before?.secret);
	});
});
