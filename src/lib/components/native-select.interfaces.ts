export interface NativeSelectOption {
	value: string;
	label: string;
}

export interface NativeSelectProps {
	id: string;
	name: string;
	options: NativeSelectOption[];
	value?: string;
	required?: boolean;
	class?: string;
}
