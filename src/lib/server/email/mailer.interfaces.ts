export interface EmailContent {
	subject: string;
	text: string;
	html: string;
}

export interface EmailMessage extends EmailContent {
	to: string;
}

export interface Mailer {
	readonly enabled: boolean;
	send(message: EmailMessage): Promise<void>;
}
