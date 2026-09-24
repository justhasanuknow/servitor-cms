import type { BetterAuthOptions } from 'better-auth';
import { twoFactor } from 'better-auth/plugins';
import { USER_ROLES } from '../../constants/users';

export const authSchemaOptions = {
	advanced: {
		database: {
			generateId: 'uuid'
		}
	},
	user: {
		additionalFields: {
			role: {
				type: [...USER_ROLES],
				required: true,
				defaultValue: 'author',
				input: false
			},
			canPublishDirectly: {
				type: 'boolean',
				required: true,
				defaultValue: false,
				input: false
			},
			mustChangePassword: {
				type: 'boolean',
				required: true,
				defaultValue: false,
				input: false
			},
			deactivatedAt: {
				type: 'date',
				required: false,
				input: false
			}
		}
	},
	plugins: [twoFactor()]
} satisfies BetterAuthOptions;
