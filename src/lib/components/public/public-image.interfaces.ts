import type { PublicImage } from '$lib/modules/interfaces/public.interfaces';

export interface PublicImageProps {
	image: PublicImage;
	loading?: 'lazy' | 'eager';
	class?: string;
}
