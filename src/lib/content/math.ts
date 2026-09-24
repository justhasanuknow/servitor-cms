import type { KatexOptions } from 'katex';

const MAX_MATH_SIZE_EM = 20;

const MAX_MACRO_EXPANSIONS = 1000;

export function katexOptions(displayMode: boolean): KatexOptions {
	return {
		displayMode,
		throwOnError: false,
		trust: false,
		strict: 'error',
		maxSize: MAX_MATH_SIZE_EM,
		maxExpand: MAX_MACRO_EXPANSIONS,
		output: 'htmlAndMathml'
	};
}
