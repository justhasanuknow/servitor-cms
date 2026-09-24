export interface ServerErrorContext {
	error: unknown;
	status: number;
	message: string;
	requestId: string | undefined;
	method: string;
	routeId: string | null;
}
