import pino, { type DestinationStream, type Logger } from 'pino';
import type { Env } from '../config/env';
import { redactLogLine } from './redact';

export function createLogger(
	level: Env['LOG_LEVEL'],
	destination: DestinationStream = pino.destination({ dest: 1, sync: true })
): Logger {
	return pino(
		{
			level,
			timestamp: pino.stdTimeFunctions.isoTime,
			formatters: {
				level: (label) => ({ level: label })
			}
		},
		createRedactingStream(destination)
	);
}

function createRedactingStream(destination: DestinationStream): DestinationStream {
	return {
		write(line: string) {
			destination.write(redactLogLine(line));
		}
	};
}
