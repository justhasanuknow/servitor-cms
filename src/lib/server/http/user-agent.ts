import type { UserAgentSummary } from './user-agent.interfaces';

const BROWSER_PATTERNS: [RegExp, string][] = [
	[/\bEdg(?:e|A|iOS)?\//, 'Edge'],
	[/\bOPR\/|\bOpera\b/, 'Opera'],
	[/\bSamsungBrowser\//, 'Samsung Internet'],
	[/\bFirefox\/|\bFxiOS\//, 'Firefox'],
	[/\bChrome\/|\bCriOS\/|\bChromium\//, 'Chrome'],
	[/\bSafari\//, 'Safari']
];

const OS_PATTERNS: [RegExp, string][] = [
	[/\biPhone\b|\biPad\b|\biPod\b/, 'iOS'],
	[/\bAndroid\b/, 'Android'],
	[/\bWindows\b/, 'Windows'],
	[/\bCrOS\b/, 'ChromeOS'],
	[/\bMac OS X\b|\bMacintosh\b/, 'macOS'],
	[/\bLinux\b/, 'Linux']
];

export function summarizeUserAgent(userAgent: string | null): UserAgentSummary {
	if (userAgent === null) {
		return { browser: null, os: null };
	}

	return {
		browser: firstMatch(userAgent, BROWSER_PATTERNS),
		os: firstMatch(userAgent, OS_PATTERNS)
	};
}

function firstMatch(value: string, patterns: [RegExp, string][]): string | null {
	for (const [pattern, name] of patterns) {
		if (pattern.test(value)) {
			return name;
		}
	}

	return null;
}
