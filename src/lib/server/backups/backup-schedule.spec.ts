import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditLog } from '../db/schema';
import { createTestRuntime } from '../testing/runtime';
import { signInWithTwoFactor } from '../testing/two-factor';
import {
	latestSlot,
	loadBackupSchedule,
	nextSlot,
	scheduleIsDue,
	updateBackupSchedule
} from './backup-schedule';
import type { BackupScheduleView } from './backups.interfaces';

const PASSWORD = 'Kx7-quiet-harbor-19';

let harness: ReturnType<typeof createTestRuntime>;

beforeEach(() => {
	harness = createTestRuntime();
});

afterEach(() => {
	harness.dispose();
});

function schedule(
	frequency: BackupScheduleView['frequency'],
	hour = 3,
	updatedAt: Date | null = new Date('2026-01-01T00:00:00.000Z')
): BackupScheduleView {
	return { frequency, hour, retention: 7, updatedAt };
}

describe('schedule slots', () => {
	it.each([
		['daily, before the hour', 'daily', '2026-09-24T02:59:00.000Z', '2026-09-23T03:00:00.000Z'],
		['daily, at the hour', 'daily', '2026-09-24T03:00:00.000Z', '2026-09-24T03:00:00.000Z'],
		['weekly, on a Thursday', 'weekly', '2026-09-24T12:00:00.000Z', '2026-09-21T03:00:00.000Z'],
		[
			'weekly, on Monday before the hour',
			'weekly',
			'2026-09-21T02:00:00.000Z',
			'2026-09-14T03:00:00.000Z'
		]
	] as const)('finds the latest slot %s', (_name, frequency, now, expected) => {
		expect(latestSlot(schedule(frequency), new Date(now))?.toISOString()).toBe(expected);
	});

	it('has no slots while the schedule is off', () => {
		expect(latestSlot(schedule('off'), new Date())).toBeNull();
		expect(nextSlot(schedule('off'), new Date())).toBeNull();
	});

	it('finds the next slot', () => {
		const now = new Date('2026-09-24T12:00:00.000Z');

		expect(nextSlot(schedule('daily'), now)?.toISOString()).toBe('2026-09-25T03:00:00.000Z');
		expect(nextSlot(schedule('weekly'), now)?.toISOString()).toBe('2026-09-28T03:00:00.000Z');
	});

	it('is due once per slot and never for slots before the schedule was set', () => {
		const now = new Date('2026-09-24T12:00:00.000Z');

		expect(scheduleIsDue(schedule('daily'), null, now)).toBe(true);
		expect(scheduleIsDue(schedule('daily'), new Date('2026-09-24T03:00:05.000Z'), now)).toBe(
			false
		);
		expect(scheduleIsDue(schedule('daily'), new Date('2026-09-23T03:00:05.000Z'), now)).toBe(
			true
		);
		expect(
			scheduleIsDue(schedule('daily', 3, new Date('2026-09-24T09:00:00.000Z')), null, now)
		).toBe(false);
		expect(scheduleIsDue(schedule('off'), null, now)).toBe(false);
	});
});

describe('updateBackupSchedule', () => {
	it('saves a changed schedule after confirmation and records it', async () => {
		await harness.createUser({
			email: 'founder@example.com',
			password: PASSWORD,
			role: 'founder'
		});

		const founder = await signInWithTwoFactor(harness, 'founder@example.com', PASSWORD);
		const input = { frequency: 'daily' as const, hour: 4, retention: 3 };

		expect(loadBackupSchedule(harness.runtime.db)).toMatchObject({ frequency: 'off' });
		expect(
			await updateBackupSchedule(
				harness.runtime,
				harness.request(founder.jar),
				founder.actor,
				input,
				{
					password: PASSWORD,
					totpCode: founder.spareCodes[0]
				}
			)
		).toBe('updated');
		expect(loadBackupSchedule(harness.runtime.db)).toMatchObject(input);
		expect(
			await updateBackupSchedule(
				harness.runtime,
				harness.request(founder.jar),
				founder.actor,
				input,
				{
					password: PASSWORD,
					totpCode: null
				}
			)
		).toBe('unchanged');
		expect(
			harness.runtime.db
				.select()
				.from(auditLog)
				.where(eq(auditLog.action, 'backup.schedule_updated'))
				.all()
		).toHaveLength(1);
	});

	it('refuses a wrong code and a founder without two-factor authentication', async () => {
		await harness.createUser({
			email: 'founder@example.com',
			password: PASSWORD,
			role: 'founder'
		});

		const plain = await harness.signIn('founder@example.com', PASSWORD);
		const input = { frequency: 'weekly' as const, hour: 1, retention: 5 };

		expect(
			await updateBackupSchedule(
				harness.runtime,
				harness.request(plain.jar),
				plain.actor,
				input,
				{
					password: PASSWORD,
					totpCode: null
				}
			)
		).toBe('two_factor_required');

		const founder = await signInWithTwoFactor(harness, 'founder@example.com', PASSWORD);

		expect(
			await updateBackupSchedule(
				harness.runtime,
				harness.request(founder.jar),
				founder.actor,
				input,
				{
					password: PASSWORD,
					totpCode: '000000'
				}
			)
		).toBe('invalid_code');
		expect(loadBackupSchedule(harness.runtime.db)).toMatchObject({ frequency: 'off' });
	});

	it('is only for the founder', async () => {
		await harness.createUser({ email: 'admin@example.com', password: PASSWORD, role: 'admin' });

		const admin = await harness.signIn('admin@example.com', PASSWORD);

		await expect(
			updateBackupSchedule(
				harness.runtime,
				harness.request(admin.jar),
				admin.actor,
				{ frequency: 'daily', hour: 3, retention: 7 },
				{ password: PASSWORD, totpCode: null }
			)
		).rejects.toMatchObject({ status: 403 });
	});
});
