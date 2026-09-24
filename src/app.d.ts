declare global {
	namespace App {
		interface Error {
			message: string;
			correlationId?: string;
		}

		interface Locals {
			requestId: string;
		}
	}
}

export {};
