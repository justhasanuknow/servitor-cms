export interface PagerProps {
	page: number;
	pageCount: number;
	label: string;
	params?: Record<string, string>;
}
