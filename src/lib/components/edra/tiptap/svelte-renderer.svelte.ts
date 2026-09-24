import { mount, unmount, type Component } from 'svelte';

export class SvelteRenderer<
	Props extends Record<string, unknown>,
	Exports extends Record<string, unknown> = Record<string, never>
> {
	private readonly container: HTMLDivElement;

	private readonly store: Props;

	private instance: Exports | null = null;

	destroyed = false;

	element: Element | null = null;

	constructor(component: Component<Props, Exports>, props: Props) {
		this.store = $state(props);
		this.container = document.createElement('div');
		this.instance = mount(component, { target: this.container, props: this.store });
		this.element = this.container.firstElementChild;
	}

	get props(): Props {
		return this.store;
	}

	get ref(): Exports | null {
		return this.instance;
	}

	updateProps(props: Partial<Props>): void {
		if (this.destroyed) {
			return;
		}

		Object.assign(this.store, props);
	}

	destroy(): void {
		if (this.destroyed) {
			return;
		}

		this.destroyed = true;

		if (this.instance !== null) {
			unmount(this.instance);
			this.instance = null;
		}

		this.element = null;
	}
}
