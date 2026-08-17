import { create } from 'zustand';
import fetchNui from '../utils/fetchNui';
import { SIZE_MIN, SIZE_MAX } from '../utils/usePhoneMetrics';

import { stopLoop } from '../utils/sound';

export const GRID_ROWS = 5;

export const BASE_COLS = 4;
export const DOCK_SLOTS = 4;

export const PAGE_SIZE = BASE_COLS * GRID_ROWS;

const DEFAULT_PAGES = [
	[
		'calculator', 'documents', 'doj', 'fishing',
		'bank', 'gallery', 'garage', 'lifeinvader',
		'music', 'news', 'estate', 'settings',
		'ventures', 'underground', 'hustlr', 'cliq',
		'weather',
	],
];

const DEFAULT_DOCK = ['dialer', 'messages', 'contacts', 'camera'];

/** @param {string[]} apps @param {number} size */
export const chunk = (apps, size) => {
	if (size <= 0) return [apps];

	const out = [];
	for (let i = 0; i < apps.length; i += size) out.push(apps.slice(i, i + size));

	return out.length ? out : [[]];
};

const normalize = (pages, { keepTrailingEmpty = false } = {}) => {
	const out = pages.map((page) => [...page]);

	for (let i = 0; i < out.length; i++) {
		while (out[i].length > PAGE_SIZE) {
			if (!out[i + 1]) out[i + 1] = [];
			out[i + 1].unshift(out[i].pop());
		}
	}

	if (!keepTrailingEmpty) {
		while (out.length > 1 && out[out.length - 1].length === 0) out.pop();
	}

	return out.length ? out : [[]];
};

const clampPage = (page, count) => Math.max(0, Math.min(count - 1, page));

let persistTimer = null;

const usePhoneStore = create((set, get) => ({
	open: false,
	expanded: false,
	activeApp: null,

	appProps: null,
	launchOrigin: null,
	notificationCentre: false,

	setOpen: (open) =>
		set(open ? { open: true } : { open: false, activeApp: null, appProps: null, editMode: false, notificationCentre: false }),

	setExpanded: (expanded) => set({ expanded }),
	toggleExpanded: () => set((state) => ({ expanded: !state.expanded })),

	openApp: (id, props = null, origin = null) =>
		set({ activeApp: id, appProps: props, launchOrigin: origin, editMode: false, notificationCentre: false }),
	closeApp: () => set({ activeApp: null, appProps: null }),

	toggleNotificationCentre: () =>
		set((state) => ({ notificationCentre: !state.notificationCentre })),

	back: () => {
		const { activeApp, notificationCentre, editMode, call } = get();

		if (editMode) return set({ editMode: false });
		if (notificationCentre) return set({ notificationCentre: false });

		if (call && !call.minimized) return set({ call: { ...call, minimized: true } });

		if (activeApp) return set({ activeApp: null, appProps: null });

		set({ open: false, expanded: false });
		fetchNui('close');
	},

	clock: { hour: 13, minute: 28, day: 1, date: 14, month: 6 },
	setClock: (clock) => set({ clock }),

	pages: DEFAULT_PAGES,
	dock: DEFAULT_DOCK,
	page: 0,
	editMode: false,

	setPage: (page) => set((state) => ({ page: clampPage(page, state.pages.length) })),

	setEditMode: (editMode) =>
		set((state) => {
			if (editMode) return { editMode };

			const pages = normalize(state.pages);
			return { editMode, pages, page: clampPage(state.page, pages.length) };
		}),

	setLayout: (layout) => {
		if (typeof layout === 'string') {
			try {
				layout = JSON.parse(layout);
			} catch {
				return;
			}
		}

		if (!layout) return;

		const pages = layout.pages?.length
			? normalize(layout.pages)
			: layout.apps?.length
				? normalize(chunk(layout.apps, PAGE_SIZE))
				: DEFAULT_PAGES;

		set((state) => {
			const settings = { ...state.settings, ...(layout.settings ?? {}) };

			settings.size = Math.min(SIZE_MAX, Math.max(SIZE_MIN, settings.size ?? SIZE_MIN));

			return {
				pages,
				dock: layout.dock?.length ? layout.dock : DEFAULT_DOCK,
				settings,
				page: 0,
			};
		});
	},

	/**
	 * Reconcile a stored layout against the app registry so a server update that
	 * adds or removes an app never leaves a dead icon (or a hidden new one).
	 * @param {string[]} known every registered app id
	 */
	syncLayout: (known) => {
		const valid = new Set(known);
		const placed = new Set();

		const keep = (id) => {
			if (!valid.has(id) || placed.has(id)) return false;
			placed.add(id);
			return true;
		};

		const dock = get().dock.filter(keep);
		const pages = get().pages.map((page) => page.filter(keep));

		const missing = known.filter((id) => !placed.has(id));
		if (missing.length) {
			const last = pages[pages.length - 1] ?? [];
			pages[pages.length - 1] = [...last, ...missing];
		}

		set({ dock, pages: normalize(pages) });
	},

	/**
	 * Move an icon to a slot on a page.
	 * @param {string} id
	 * @param {number} toPage
	 * @param {number} slot index within that page
	 */
	moveApp: (id, toPage, slot) => {
		const state = get();
		const pages = state.pages.map((page) => [...page]);

		while (pages.length <= toPage) pages.push([]);
		if (toPage < 0) return;

		const from = pages.findIndex((page) => page.includes(id));
		const dock = state.dock.filter((app) => app !== id);

		if (from === -1 && dock.length === state.dock.length) return;
		if (from !== -1) pages[from].splice(pages[from].indexOf(id), 1);

		const target = pages[toPage];
		target.splice(Math.max(0, Math.min(target.length, slot)), 0, id);

		const next = normalize(pages, { keepTrailingEmpty: state.editMode });

		set({ pages: next, dock, page: clampPage(toPage, next.length) });
		get().persistLayout(next, dock);
	},

	addPage: () => {
		const pages = [...get().pages, []];
		set({ pages, page: pages.length - 1 });
		return pages.length - 1;
	},

	moveToDock: (id, slot) => {
		const state = get();
		const pages = state.pages.map((page) => page.filter((app) => app !== id));
		const dock = state.dock.filter((app) => app !== id);

		dock.splice(Math.max(0, Math.min(dock.length, slot)), 0, id);

		while (dock.length > DOCK_SLOTS) pages[0] = [dock.pop(), ...(pages[0] ?? [])];

		const next = normalize(pages, { keepTrailingEmpty: state.editMode });

		set({ pages: next, dock, page: clampPage(state.page, next.length) });
		get().persistLayout(next, dock);
	},

	persistLayout: (pages, dock, settings) => {
		clearTimeout(persistTimer);

		persistTimer = setTimeout(() => {
			const state = get();

			fetchNui('saveLayout', {
				layout: JSON.stringify({
					pages: pages ?? state.pages,
					dock: dock ?? state.dock,
					settings: settings ?? state.settings,
				}),
			});
		}, 250);
	},

	resetLayout: () => {
		set({ pages: DEFAULT_PAGES, dock: DEFAULT_DOCK, page: 0 });
		get().persistLayout(DEFAULT_PAGES, DEFAULT_DOCK);
	},

	settings: {
		size: 100,

		wallpaper: '',
		airplane: false,
		dnd: false,
		sounds: true,
		volume: 70,
		hidePreviews: false,
		use24Hour: false,

		peekDuration: 1500,

		emojiUsage: {},
	},

	setSetting: (key, value) => {
		const settings = { ...get().settings, [key]: value };

		set({ settings });
		get().persistLayout(undefined, undefined, settings);
	},

	noteEmojiUse: (emoji) => {
		const usage = { ...(get().settings.emojiUsage ?? {}) };
		usage[emoji] = (usage[emoji] ?? 0) + 1;

		get().setSetting('emojiUsage', usage);
	},

	call: null,
	setCall: (call) => {
		if (!call || call.state !== 'incoming') stopLoop('ringtone');

		if (!call && get().callMuted) fetchNui('setMuted', { muted: false });
		set({ call, callMuted: false });
	},

	answerCall: () => {
		if (!get().call) return;
		fetchNui('answerCall');
	},

	declineCall: () => {
		if (!get().call) return;

		stopLoop('ringtone');

		fetchNui('declineCall');
		set({ call: null });
	},

	connectCall: () =>
		set((state) =>
			state.call ? { call: { ...state.call, state: 'active', connectedAt: Date.now() } } : {}
		),

	callMuted: false,

	toggleMute: () => {
		const muted = !get().callMuted;

		fetchNui('setMuted', { muted });
		set({ callMuted: muted });
	},

	minimizeCall: () =>
		set((state) => (state.call ? { call: { ...state.call, minimized: true, expanded: false } } : {})),

	expandCallCard: () =>
		set((state) => (state.call ? { call: { ...state.call, expanded: true } } : {})),

	collapseCallCard: () =>
		set((state) => (state.call ? { call: { ...state.call, expanded: false } } : {})),

	restoreCall: () => {
		if (!get().call) return;

		if (!get().open) fetchNui('requestOpen');

		set((state) => ({ call: { ...state.call, minimized: false, expanded: false }, open: true }));
	},

	openFromCallMode: () => {
		if (get().open) return;

		fetchNui('requestOpen');
		set((state) => ({
			open: true,
			call: state.call ? { ...state.call, expanded: false } : null,
		}));
	},
}));

export default usePhoneStore;
