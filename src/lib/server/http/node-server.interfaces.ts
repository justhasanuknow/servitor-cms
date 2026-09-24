import type { IncomingMessage, ServerResponse } from 'node:http';

export type NodeRequestHandler = (request: IncomingMessage, response: ServerResponse) => void;

export interface HeaderTarget {
	setHeader(name: string, value: string): unknown;
}
