import { createServer } from 'node:http';
import {
	applyBaselineHeaders,
	applyFallbackContentType,
	isUnsupportedMethod,
	loadRequestHandler,
	rejectUnsupportedMethod
} from './lib/server/http/node-server';

const HANDLER_FILE = './handler.js';

const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'] as const;

const MILLISECONDS_PER_SECOND = 1000;

const host = process.env.HOST ?? '0.0.0.0';

const port = Number(process.env.PORT ?? '3000');

const shutdownTimeoutSeconds = Number(process.env.SHUTDOWN_TIMEOUT ?? '30');

const handler = await loadRequestHandler(new URL(HANDLER_FILE, import.meta.url));

const server = createServer((request, response) => {
	applyBaselineHeaders(response, true);
	applyFallbackContentType(request.url, response);

	if (isUnsupportedMethod(request.method)) {
		rejectUnsupportedMethod(response);

		return;
	}

	handler(request, response);
});

let shuttingDown = false;

function shutDown(): void {
	if (shuttingDown) {
		return;
	}

	shuttingDown = true;
	server.closeIdleConnections();
	server.close();
	setTimeout(() => {
		server.closeAllConnections();
	}, shutdownTimeoutSeconds * MILLISECONDS_PER_SECOND).unref();
}

for (const signal of SHUTDOWN_SIGNALS) {
	process.on(signal, shutDown);
}

server.listen(port, host, () => {
	process.stdout.write(`Listening on http://${host}:${port}\n`);
});
