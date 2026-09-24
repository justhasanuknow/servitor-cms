import { symmetricDecrypt, symmetricEncrypt } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '../db';
import { twoFactor, webhooks } from '../db/schema';
import { decryptSecret, encryptSecret, sealedWithCurrentKey } from '../webhooks/secret-box';
import { allSecrets, secretVersion, versionedSecrets } from './secret-keys';
import type { SecretKeys } from './secret-keys.interfaces';
import type { ReencryptionReport } from './stored-secrets.interfaces';

const ENVELOPE_PREFIX = '$ba$';

export async function reencryptStoredSecrets(
	db: AppDatabase,
	keys: SecretKeys
): Promise<ReencryptionReport> {
	const report: ReencryptionReport = { reencrypted: 0, unreadable: 0 };

	reencryptWebhookSecrets(db, keys, report);
	await reencryptTwoFactorSecrets(db, keys, report);

	return report;
}

export function twoFactorSecretConfig(keys: SecretKeys) {
	return {
		keys: new Map(versionedSecrets(keys).map(({ version, value }) => [version, value])),
		currentVersion: secretVersion(keys.current),
		legacySecret: keys.current
	};
}

function reencryptWebhookSecrets(
	db: AppDatabase,
	keys: SecretKeys,
	report: ReencryptionReport
): void {
	const rows = db
		.select({ id: webhooks.id, secretCiphertext: webhooks.secretCiphertext })
		.from(webhooks)
		.all();

	for (const row of rows) {
		if (sealedWithCurrentKey(row.secretCiphertext, keys)) {
			continue;
		}

		const plaintext = decryptSecret(row.secretCiphertext, keys);

		if (plaintext === null) {
			report.unreadable += 1;
			continue;
		}

		db.update(webhooks)
			.set({ secretCiphertext: encryptSecret(plaintext, keys) })
			.where(eq(webhooks.id, row.id))
			.run();
		report.reencrypted += 1;
	}
}

async function reencryptTwoFactorSecrets(
	db: AppDatabase,
	keys: SecretKeys,
	report: ReencryptionReport
): Promise<void> {
	const config = twoFactorSecretConfig(keys);
	const currentPrefix = `${ENVELOPE_PREFIX}${config.currentVersion}$`;
	const rows = db.select({ id: twoFactor.id, secret: twoFactor.secret }).from(twoFactor).all();

	for (const row of rows) {
		if (row.secret.startsWith(currentPrefix)) {
			continue;
		}

		const plaintext = await decryptTwoFactorSecret(row.secret, keys);

		if (plaintext === null) {
			report.unreadable += 1;
			continue;
		}

		db.update(twoFactor)
			.set({ secret: await symmetricEncrypt({ key: config, data: plaintext }) })
			.where(eq(twoFactor.id, row.id))
			.run();
		report.reencrypted += 1;
	}
}

async function decryptTwoFactorSecret(stored: string, keys: SecretKeys): Promise<string | null> {
	if (stored.startsWith(ENVELOPE_PREFIX)) {
		return symmetricDecrypt({ key: twoFactorSecretConfig(keys), data: stored }).catch(
			() => null
		);
	}

	for (const secret of allSecrets(keys)) {
		const plaintext = await symmetricDecrypt({ key: secret, data: stored }).catch(() => null);

		if (plaintext !== null) {
			return plaintext;
		}
	}

	return null;
}
