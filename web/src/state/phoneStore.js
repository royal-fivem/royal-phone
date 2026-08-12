import { create } from 'zustand';
import fetchNui from '../utils/fetchNui';
import { SIZE_MIN, SIZE_MAX } from '../utils/usePhoneMetrics';
// Circular by design — sound.js reads this store for the volume settings. Safe
// because neither side touches the other at module scope, only inside functions.
import { stopLoop } from '../utils/sound';

export const GRID_ROWS = 5;
/** Columns when folded. Unfolding multiplies this by the expand factor. */
export const BASE_COLS = 4;
export const DOCK_SLOTS = 4;

/** Canonical page size: the folded 4 × 5 grid. */
export const PAGE_SIZE = BASE_COLS * GRID_ROWS;

/**
 * The home screen is stored as explicit pages of the folded grid. Explicit
 * rather than derived from a flat list because a page has to be able to exist
 * while empty — that is what dragging an icon off the right edge creates.
 *
 * Unfolding does not use these arrays directly: the order is flattened and
 * re-chunked to whatever fits, so the same layout reflows into a wider grid.
 */
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

/** Overflow cascades forward; trailing empties are kept only if asked for. */
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

/** Coalesces bursts of writes — dragging the size slider must not POST per pixel. */
let persistTimer = null;

const usePhoneStore = create((set, get) => ({
	//#region shell

	open: false,
	expanded: false,
	activeApp: null,
	/** Payload handed to an app when something else opens it (e.g. a contact). */
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

	/** The home indicator and Escape both route through here. */
	back: () => {
		const { activeApp, notificationCentre, editMode, call } = get();

		if (editMode) return set({ editMode: false });
		if (notificationCentre) return set({ notificationCentre: false });

		// A live call tucks into the status bar instead of hanging up, so the
		// player can use other apps — or pocket the phone — mid-conversation.
		if (call && !call.minimized) return set({ call: { ...call, minimized: true } });

		if (activeApp) return set({ activeApp: null, appProps: null });

		set({ open: false, expanded: false });
		fetchNui('close');
	},

	//#endregion

	//#region clock

	clock: { hour: 13, minute: 28, day: 1, date: 14, month: 6 },
	setClock: (clock) => set({ clock }),

	//#endregion

	//#region home screen layout

	pages: DEFAULT_PAGES,
	dock: DEFAULT_DOCK,
	page: 0,
	editMode: false,

	setPage: (page) => set((state) => ({ page: clampPage(page, state.pages.length) })),

	setEditMode: (editMode) =>
		set((state) => {
			if (editMode) return { editMode };

			// Leaving edit mode tidies up any empty page the drag left behind.
			const pages = normalize(state.pages);
			return { editMode, pages, page: clampPage(state.page, pages.length) };
		}),

	/** Accepts the paged shape, and the flat `apps` shape from older saves. */
	setLayout: (layout) => {
		if (!layout) return;

		const pages = layout.pages?.length
			? normalize(layout.pages)
			: layout.apps?.length
				? normalize(chunk(layout.apps, PAGE_SIZE))
				: DEFAULT_PAGES;

		set((state) => {
			const settings = { ...state.settings, ...(layout.settings ?? {}) };

			// The size scale was rebased (the old 80% is the new 100%), so clamp
			// rather than letting an old save render the phone tiny.
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

		// Nothing to move: not on a page and not coming out of the dock.
		if (from === -1 && dock.length === state.dock.length) return;
		if (from !== -1) pages[from].splice(pages[from].indexOf(id), 1);

		const target = pages[toPage];
		target.splice(Math.max(0, Math.min(target.length, slot)), 0, id);

		// Empty pages survive while editing so a freshly made one does not
		// vanish under the icon being dropped into it.
		const next = normalize(pages, { keepTrailingEmpty: state.editMode });

		set({ pages: next, dock, page: clampPage(toPage, next.length) });
		get().persistLayout(next, dock);
	},

	/** Add an empty page at the end and move to it. */
	addPage: () => {
		const pages = [...get().pages, []];
		set({ pages, page: pages.length - 1 });
		return pages.length - 1;
	},

	/** Drop an icon into a dock slot; whatever no longer fits goes back to the grid. */
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

	/** Layout and settings ride in one KVP blob — one write, one read. */
	persistLayout: (pages, dock, settings) => {
		clearTimeout(persistTimer);

		persistTimer = setTimeout(() => {
			const state = get();

			fetchNui('saveLayout', {
				pages: pages ?? state.pages,
				dock: dock ?? state.dock,
				settings: settings ?? state.settings,
			});
		}, 250);
	},

	resetLayout: () => {
		set({ pages: DEFAULT_PAGES, dock: DEFAULT_DOCK, page: 0 });
		get().persistLayout(DEFAULT_PAGES, DEFAULT_DOCK);
	},

	//#endregion

	//#region settings

	settings: {
		/** Percent of the default frame height; 100 is the smallest. */
		size: 100,
		/** Direct image URL. Empty falls back to the plain black screen. */
		wallpaper: '',
		airplane: false,
		dnd: false,
		sounds: true,
		volume: 70,
		hidePreviews: false,
		/**
		 * How long the pocketed phone peeks after a notification, in ms. Pushed
		 * from Config.PeekDuration at bootstrap — not a player setting, it just
		 * rides along here so PhoneShell can read it without another store.
		 */
		peekDuration: 1500,
		/** emoji -> times picked, drives the Recent tray. */
		emojiUsage: {},
	},

	setSetting: (key, value) => {
		const settings = { ...get().settings, [key]: value };

		set({ settings });
		get().persistLayout(undefined, undefined, settings);
	},

	/** Bump an emoji's tally so the Recent tray reflects real use. */
	noteEmojiUse: (emoji) => {
		const usage = { ...(get().settings.emojiUsage ?? {}) };
		usage[emoji] = (usage[emoji] ?? 0) + 1;

		get().setSetting('emojiUsage', usage);
	},

	//#endregion

	//#region calls

	/**
	 * `{ number, name, direction, state, connectedAt?, minimized?, answerKey?, declineKey? }`
	 * state: 'incoming' | 'dialing' | 'active'
	 *
	 * 'active' is set by Lua when the server confirms the pickup, not locally —
	 * the caller has no way of knowing the other end answered until told, and
	 * flipping the UI early showed a connected call that had no voice channel.
	 */
	call: null,
	setCall: (call) => {
		// The catch-all for "this call is over or has moved on": every path that
		// clears or replaces the call runs through here, so the ringtone can never
		// be left playing by a route nobody thought about.
		if (!call || call.state !== 'incoming') stopLoop('ringtone');

		// Every call starts unmuted, and a finished call leaves nothing behind.
		if (!call && get().callMuted) fetchNui('setMuted', { muted: false });
		set({ call, callMuted: false });
	},

	/**
	 * Ask the server to connect the call. The UI stays on 'incoming' until the
	 * `callConnected` event lands, which is also what joins the voice channel.
	 */
	answerCall: () => {
		if (!get().call) return;
		fetchNui('answerCall');
	},

	declineCall: () => {
		if (!get().call) return;

		// Silenced here rather than waiting for the server's callEnded to come
		// back — a ringtone that plays on for a beat after you hit Decline reads
		// as the button not working.
		stopLoop('ringtone');

		fetchNui('declineCall');
		set({ call: null });
	},

	/** Server says both ends are on the channel. */
	connectCall: () =>
		set((state) =>
			state.call ? { call: { ...state.call, state: 'active', connectedAt: Date.now() } } : {}
		),

	/**
	 * Mic muted for the current call. Lives outside `call` so ending a call
	 * always clears it — a mute that survived into the next call would be a very
	 * confusing bug to hit.
	 */
	callMuted: false,

	toggleMute: () => {
		const muted = !get().callMuted;

		fetchNui('setMuted', { muted });
		set({ callMuted: muted });
	},

	/** Tuck the call into the status bar pill. */
	minimizeCall: () =>
		set((state) => (state.call ? { call: { ...state.call, minimized: true, expanded: false } } : {})),

	/**
	 * Tapping the pill while the phone is pocketed lifts it to peek height and
	 * shows the call card, rather than taking over the whole screen.
	 */
	expandCallCard: () =>
		set((state) => (state.call ? { call: { ...state.call, expanded: true } } : {})),

	collapseCallCard: () =>
		set((state) => (state.call ? { call: { ...state.call, expanded: false } } : {})),

	/** Bring the full-screen call back, opening the phone if it was pocketed. */
	restoreCall: () => {
		if (!get().call) return;

		// Ask Lua for focus too — the phone may have been in call mode, where the
		// UI is on screen but the game still owns most input.
		if (!get().open) fetchNui('requestOpen');

		set((state) => ({ call: { ...state.call, minimized: false, expanded: false }, open: true }));
	},

	/** Open the phone from call mode without taking the call full screen. */
	openFromCallMode: () => {
		if (get().open) return;

		fetchNui('requestOpen');
		set((state) => ({
			open: true,
			call: state.call ? { ...state.call, expanded: false } : null,
		}));
	},

	//#endregion
}));

export default usePhoneStore;
