const modules = import.meta.glob('../assets/icons/*.webp', {
	eager: true,
	query: '?url',
	import: 'default',
});

const APP_IMAGES = Object.fromEntries(
	Object.entries(modules).map(([path, url]) => [
		path.split('/').pop().replace(/\.webp$/i, '').toLowerCase(),
		url,
	])
);

/** @param {string} id app id @returns {string|undefined} */
export const imageFor = (id) => (id ? APP_IMAGES[id.toLowerCase()] : undefined);

const decoded = [];

let warmed = false;

export async function warmAppImages() {
	if (warmed) return;
	warmed = true;

	for (const url of Object.values(APP_IMAGES)) {
		const image = new Image();
		image.decoding = 'async';
		image.src = url;

		try {
			await image.decode();
			decoded.push(image);
		} catch {
		}
	}
}

export default APP_IMAGES;
