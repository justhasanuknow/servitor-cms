import { z } from 'zod';

const MAX_PASSWORD_INPUT_LENGTH = 1024;

const MAX_CODE_INPUT_LENGTH = 64;

export const emailField = z.string().trim().toLowerCase().max(254).pipe(z.email());

export const passwordField = z.string().min(1).max(MAX_PASSWORD_INPUT_LENGTH);

export const codeField = z
	.string()
	.max(MAX_CODE_INPUT_LENGTH)
	.transform(compactCode)
	.pipe(z.string().min(1));

export const optionalCodeField = z
	.string()
	.max(MAX_CODE_INPUT_LENGTH)
	.optional()
	.transform((value) => {
		if (value === undefined) {
			return null;
		}

		const compact = compactCode(value);

		if (compact === '') {
			return null;
		}

		return compact;
	});

function compactCode(value: string): string {
	return value.replace(/\s+/g, '');
}
