export interface MathSource {
	latex: string;
	displayMode: boolean;
}

export interface SanitizedContent {
	html: string;
	math: MathSource[];
}
