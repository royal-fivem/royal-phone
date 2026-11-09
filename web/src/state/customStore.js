import { create } from 'zustand';

// Only pages a resource can actually serve. No javascript:, no file:.
const SAFE_UI = /^(https?:|nui:)/i;
const SAFE_ICON = /^(https?:|nui:|data:image\/)/i;

// `background` is either a tailwind class (`bg-zinc-950`) or a CSS colour /
// gradient, which can't be a class because tailwind never saw it at build time.
const CSS_BACKGROUND = /^(#|rgb|hsl|oklch|linear-gradient|radial-gradient|conic-gradient)/i;

const sanitize = (app) => {
	if (!app || typeof app.id !== 'string' || !app.id) return null;
	if (typeof app.ui !== 'string' || !SAFE_UI.test(app.ui)) return null;

	const icon = typeof app.icon === 'string' && SAFE_ICON.test(app.icon) ? app.icon : undefined;
	const background = typeof app.background === 'string' ? app.background : '';
	const cssBackground = CSS_BACKGROUND.test(background);

	return {
		id: app.id,
		label: app.name || app.label || app.id,
		ui: app.ui,
		resource: typeof app.resource === 'string' ? app.resource : undefined,
		description: typeof app.description === 'string' ? app.description : undefined,

		iconUrl: icon,
		gradient: app.gradient || 'bg-gradient-to-br from-zinc-600 to-zinc-800',
		background: cssBackground || !background ? 'bg-black' : background,
		backgroundStyle: cssBackground ? background : undefined,

		custom: true,
	};
};

const useCustomStore = create((set, get) => ({
	apps: [],
	byId: {},

	setApps: (list) => {
		const apps = [];
		const byId = {};

		for (const entry of Array.isArray(list) ? list : []) {
			const app = sanitize(entry);
			if (!app || byId[app.id]) continue;

			apps.push(app);
			byId[app.id] = app;
		}

		set({ apps, byId });
	},

	get: (id) => (id ? get().byId[id] : undefined),
}));

export default useCustomStore;
