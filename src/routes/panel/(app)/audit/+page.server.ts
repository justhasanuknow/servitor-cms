import { asc } from 'drizzle-orm';
import { z } from 'zod';
import { AUDIT_ACTIONS, AUDIT_ACTOR_TYPES } from '$lib/constants/audit';
import { queryAuditLog } from '$lib/server/audit/audit-query';
import type { AuditFilters } from '$lib/server/audit/audit-query.interfaces';
import { requireActor } from '$lib/server/auth/actor';
import { user } from '$lib/server/db/schema';
import { requirePermission } from '$lib/server/permissions/permissions';
import { getRuntime } from '$lib/server/runtime';
import type { PageServerLoad } from './$types';

const DAY_MS = 24 * 60 * 60 * 1000;

const optionalText = (max: number) => z.string().trim().min(1).max(max).optional().catch(undefined);

const filtersSchema = z.object({
	actor: z
		.union([z.enum(AUDIT_ACTOR_TYPES), z.uuid()])
		.optional()
		.catch(undefined),
	action: z.enum(AUDIT_ACTIONS).optional().catch(undefined),
	targetType: optionalText(64),
	targetId: optionalText(128),
	from: z.iso.date().optional().catch(undefined),
	to: z.iso.date().optional().catch(undefined),
	page: z.coerce.number().int().min(1).max(100_000).optional().catch(undefined)
});

export const load: PageServerLoad = ({ locals, url }) => {
	const { user: viewer } = requireActor(locals);

	requirePermission(viewer, 'audit.view', null);

	const values = filtersSchema.parse(Object.fromEntries(url.searchParams));
	const { db } = getRuntime();

	return {
		filters: {
			actor: values.actor ?? '',
			action: values.action ?? '',
			targetType: values.targetType ?? '',
			targetId: values.targetId ?? '',
			from: values.from ?? '',
			to: values.to ?? ''
		},
		result: queryAuditLog(db, toFilters(values)),
		actors: db
			.select({ id: user.id, name: user.name, email: user.email })
			.from(user)
			.orderBy(asc(user.name))
			.all(),
		actions: [...AUDIT_ACTIONS]
	};
};

function toFilters(values: z.infer<typeof filtersSchema>): AuditFilters {
	let actorId: string | null = null;
	let actorType: AuditFilters['actorType'] = null;

	if (values.actor !== undefined) {
		const special = z.enum(AUDIT_ACTOR_TYPES).safeParse(values.actor);

		if (special.success) {
			actorType = special.data;
		} else {
			actorId = values.actor;
		}
	}

	return {
		actorId,
		actorType,
		action: values.action ?? null,
		targetType: values.targetType ?? null,
		targetId: values.targetId ?? null,
		from: startOfDay(values.from),
		to: endOfDay(values.to),
		page: values.page ?? 1
	};
}

function startOfDay(value: string | undefined): Date | null {
	if (value === undefined) {
		return null;
	}

	return new Date(`${value}T00:00:00.000Z`);
}

function endOfDay(value: string | undefined): Date | null {
	const start = startOfDay(value);

	if (start === null) {
		return null;
	}

	return new Date(start.getTime() + DAY_MS);
}
