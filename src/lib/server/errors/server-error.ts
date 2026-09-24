import type { Logger } from 'pino';
import type { ServerErrorContext } from './server-error.interfaces';

export function reportServerError(context: ServerErrorContext, logger: Logger): App.Error {
	if (context.status < 500) {
		return { message: context.message };
	}

	const correlationId = context.requestId || crypto.randomUUID();

	logger.error(
		{
			err: context.error,
			correlationId,
			status: context.status,
			method: context.method,
			route: context.routeId
		},
		'Unhandled server error'
	);

	return { message: context.message, correlationId };
}
