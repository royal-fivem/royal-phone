/**
 * Optional artwork for app icons.
 *
 * Drop `<app-id>.webp` into `web/src/assets/icons/` (e.g. `bank.webp`) and it
 * replaces that app's gradient tile everywhere — home screen, dock, toasts and
 * the notification centre. Anything without a file keeps the Hugeicons glyph.
 *
 * The glob is resolved at build time, so a missing file costs nothing: there is
 * no per-icon request that 404s, and only files that actually exist end up in
 * the bundle. Adding artwork therefore needs a rebuild.
 */
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

export default APP_IMAGES;
