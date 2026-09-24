const port = process.env.PORT ?? '3000';

const response = await fetch(`http://127.0.0.1:${port}/healthz`, {
	signal: AbortSignal.timeout(4000)
}).catch(() => null);

if (response === null || !response.ok) {
	process.exit(1);
}
