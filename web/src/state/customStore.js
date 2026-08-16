import { create } from 'zustand';

const sanitize = (app) => {
	if (!app || typeof app.id !== 'string' || !app.id) return null;
	if (typeof app.ui !== 'string' || !app.ui) return null;

	return {
		id: app.id,
		label: app.name || app.label || app.id,
		ui: app.ui,

		iconUrl: app.icon || undefined,
		gradient: app.gradient || 'bg-gradient-to-br from-zinc-600 to-zinc-800',
		background: app.background || 'bg-black',

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
