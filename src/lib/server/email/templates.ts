import type { UiLocale } from '../../constants/preferences';
import { m } from '../../paraglide/messages';
import type { EmailContent } from './mailer.interfaces';
import type { BackupDownloadDetails, EmailLink, NewDeviceDetails } from './templates.interfaces';

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

export function renderEmail(
	locale: UiLocale,
	subject: string,
	paragraphs: string[],
	link: EmailLink | null
): EmailContent {
	const textParts = [...paragraphs];
	const htmlParts = paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`);

	if (link !== null) {
		textParts.splice(1, 0, `${link.label}:\n${link.url}`);
		htmlParts.splice(
			1,
			0,
			`<p><a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a></p>`
		);
	}

	return {
		subject,
		text: `${textParts.join('\n\n')}\n`,
		html: [
			'<!doctype html>',
			`<html lang="${escapeHtml(locale)}">`,
			'<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">',
			...htmlParts,
			'</body>',
			'</html>'
		].join('\n')
	};
}

export function inviteEmail(
	locale: UiLocale,
	site: string,
	inviter: string,
	link: string
): EmailContent {
	return renderEmail(
		locale,
		m.email_invite_subject({ site }, { locale }),
		[
			m.email_invite_intro({ inviter, site }, { locale }),
			m.email_invite_expiry({}, { locale }),
			m.email_ignore_unexpected({}, { locale })
		],
		{ url: link, label: m.email_invite_action({}, { locale }) }
	);
}

export function passwordResetEmail(locale: UiLocale, site: string, link: string): EmailContent {
	return renderEmail(
		locale,
		m.email_reset_subject({ site }, { locale }),
		[
			m.email_reset_intro({ site }, { locale }),
			m.email_reset_expiry({}, { locale }),
			m.email_reset_ignore({}, { locale })
		],
		{ url: link, label: m.email_reset_action({}, { locale }) }
	);
}

export function emailChangeVerification(
	locale: UiLocale,
	site: string,
	address: string,
	link: string
): EmailContent {
	return renderEmail(
		locale,
		m.email_verify_subject({ site }, { locale }),
		[
			m.email_verify_intro({ address, site }, { locale }),
			m.email_verify_expiry({}, { locale }),
			m.email_ignore_unexpected({}, { locale })
		],
		{ url: link, label: m.email_verify_action({}, { locale }) }
	);
}

export function emailChangedNotice(locale: UiLocale, site: string, address: string): EmailContent {
	return renderEmail(
		locale,
		m.email_changed_subject({ site }, { locale }),
		[
			m.email_changed_intro({ address, site }, { locale }),
			m.email_changed_warning({}, { locale })
		],
		null
	);
}

export function newDeviceEmail(
	locale: UiLocale,
	site: string,
	details: NewDeviceDetails
): EmailContent {
	return renderEmail(
		locale,
		m.email_device_subject({ site }, { locale }),
		[
			m.email_device_intro({ site }, { locale }),
			m.email_device_details(
				{ device: details.device, ip: details.ip, time: details.time },
				{ locale }
			),
			m.email_device_warning({}, { locale })
		],
		null
	);
}

export function scheduledBackupFailedEmail(
	locale: UiLocale,
	site: string,
	reason: string
): EmailContent {
	return renderEmail(
		locale,
		m.email_backup_failed_subject({ site }, { locale }),
		[
			m.email_backup_failed_intro({ site }, { locale }),
			m.email_backup_failed_reason({ reason }, { locale }),
			m.email_backup_failed_action({}, { locale })
		],
		null
	);
}

export function backupDownloadedEmail(
	locale: UiLocale,
	site: string,
	details: BackupDownloadDetails
): EmailContent {
	return renderEmail(
		locale,
		m.email_backup_downloaded_subject({ site }, { locale }),
		[
			m.email_backup_downloaded_intro({ site }, { locale }),
			m.email_backup_downloaded_details(
				{ archive: details.archive, ip: details.ip, time: details.time },
				{ locale }
			),
			m.email_backup_downloaded_warning({}, { locale })
		],
		null
	);
}
