import { m } from '$lib/paraglide/messages';
import { reauthenticationMessage } from './auth-messages';

export function backupProblemMessage(problem: string | undefined): string {
	switch (problem) {
		case 'newer_version':
			return m.backups_problem_newer_version();
		case 'schema':
			return m.backups_problem_schema();
		case 'foreign':
			return m.backups_problem_foreign();
		case 'space':
			return m.backups_problem_space();
		case 'contents':
			return m.backups_problem_contents();
		case 'format':
			return m.backups_problem_format();
		default:
			return m.backups_problem_damaged();
	}
}

export function backupErrorMessage(
	error: string | null | undefined,
	problem?: string
): string | null {
	switch (error) {
		case null:
		case undefined:
			return null;
		case 'two_factor_required':
			return m.backups_two_factor_required();
		case 'busy':
			return m.backups_error_busy();
		case 'not_found':
			return m.backups_error_not_found();
		case 'not_confirmed':
			return m.backups_error_word();
		case 'passphrase_mismatch':
			return m.backups_error_passphrase_mismatch();
		case 'passphrase_too_short':
			return m.backups_error_passphrase_short();
		case 'passphrase_too_long':
			return m.backups_error_passphrase_long();
		case 'invalid_archive':
			return m.backups_error_invalid_archive({ reason: backupProblemMessage(problem) });
		default:
			return reauthenticationMessage(error);
	}
}

export function uploadErrorMessage(status: string, problem?: string): string {
	switch (status) {
		case 'two_factor_required':
			return m.backups_two_factor_required();
		case 'rate_limited':
			return m.common_rate_limited_generic();
		case 'insufficient_space':
			return m.backups_upload_error_space();
		case 'passphrase_required':
			return m.backups_upload_error_passphrase_required();
		case 'wrong_passphrase':
			return m.backups_upload_error_wrong_passphrase();
		case 'invalid_archive':
			return m.backups_error_invalid_archive({ reason: backupProblemMessage(problem) });
		default:
			return m.backups_upload_error_failed();
	}
}

export function archiveKindLabel(kind: string): string {
	switch (kind) {
		case 'auto':
			return m.backups_kind_auto();
		case 'upload':
			return m.backups_kind_upload();
		default:
			return m.backups_kind_backup();
	}
}
