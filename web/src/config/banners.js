/**
 * Document banners.
 *
 * CSS gradients rather than image files: a banner ships as a short id in the
 * database, costs nothing to load, and cannot 404 on a player whose document
 * was written months ago. `css` is used raw as a `background` value.
 */
export const BANNERS = [
	{ id: 'slate', label: 'Slate', css: 'linear-gradient(120deg, #1e293b 0%, #0f172a 100%)' },
	{ id: 'ocean', label: 'Ocean', css: 'linear-gradient(120deg, #0ea5e9 0%, #1e3a8a 100%)' },
	{ id: 'dusk', label: 'Dusk', css: 'linear-gradient(120deg, #7c3aed 0%, #db2777 100%)' },
	{ id: 'ember', label: 'Ember', css: 'linear-gradient(120deg, #f59e0b 0%, #b91c1c 100%)' },
	{ id: 'forest', label: 'Forest', css: 'linear-gradient(120deg, #10b981 0%, #064e3b 100%)' },
	{ id: 'sand', label: 'Sand', css: 'linear-gradient(120deg, #fbbf24 0%, #78350f 100%)' },
	{ id: 'ice', label: 'Ice', css: 'linear-gradient(120deg, #67e8f9 0%, #1e40af 100%)' },
	{ id: 'rose', label: 'Rose', css: 'linear-gradient(120deg, #fb7185 0%, #881337 100%)' },
	{ id: 'mono', label: 'Mono', css: 'linear-gradient(120deg, #52525b 0%, #18181b 100%)' },
	{ id: 'legal', label: 'Legal', css: 'linear-gradient(120deg, #334155 0%, #0c4a6e 100%)' },
];

export const DEFAULT_BANNER = BANNERS[0].id;

const BY_ID = Object.fromEntries(BANNERS.map((banner) => [banner.id, banner]));

export const bannerFor = (id) => BY_ID[id] ?? BANNERS[0];
