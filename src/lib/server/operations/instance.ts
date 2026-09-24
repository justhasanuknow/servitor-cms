import { rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RUNNING_FILE = 'servitor.running';

const HEARTBEAT_INTERVAL_MS = 15_000;

const STALE_AFTER_MS = 45_000;

export function runningMarker(dataDir: string): string {
	return join(dataDir, RUNNING_FILE);
}

function writeMarker(marker: string, startedAt: Date): void {
	writeFileSync(marker, JSON.stringify({ pid: process.pid, startedAt: startedAt.toISOString() }));
}

function touchMarker(marker: string, startedAt: Date): void {
	const now = new Date();

	try {
		utimesSync(marker, now, now);
	} catch {
		try {
			writeMarker(marker, startedAt);
		} catch {
			return;
		}
	}
}

export function markInstanceRunning(dataDir: string): () => void {
	const marker = runningMarker(dataDir);
	const startedAt = new Date();

	writeMarker(marker, startedAt);

	const timer = setInterval(() => {
		touchMarker(marker, startedAt);
	}, HEARTBEAT_INTERVAL_MS);
	const stop = () => {
		clearInterval(timer);
		rmSync(marker, { force: true });
	};

	timer.unref();
	process.once('exit', stop);

	return stop;
}

export function instanceRunning(dataDir: string, now: Date = new Date()): boolean {
	try {
		return now.getTime() - statSync(runningMarker(dataDir)).mtime.getTime() < STALE_AFTER_MS;
	} catch {
		return false;
	}
}
