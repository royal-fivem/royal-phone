import { create } from 'zustand';
import { playSound } from '../utils/sound';
import fetchNui from '../utils/fetchNui';

let idCounter = 0;

/** Hard cap so a spam loop can never grow the DOM without bound. */
const MAX_VISIBLE = 4;
const MAX_HISTORY = 60;

const useNotifyStore = create((set, get) => ({
	/** Currently animating on screen. */
	visible: [],
	/** Everything received this session — shown in the notification centre. */
	history: [],

	/**
	 * @param {object} payload { app?, title, content?, avatar?, duration?, sound? }
	 * @returns {number} id, so a caller can dismiss it early
	 */
	add: (payload = {}) => {
		const id = ++idCounter;
		const duration = typeof payload.duration === 'number' ? payload.duration : 5000;
		const notification = { id, receivedAt: Date.now(), read: false, ...payload, duration };

		set((state) => ({
			visible: [...state.visible, notification].slice(-MAX_VISIBLE),
			history: [notification, ...state.history].slice(0, MAX_HISTORY),
		}));

		// `sound: false` lets a caller add something silently — a backfill, say.
		if (payload.sound !== false) playSound('newnotification');

		return id;
	},

	dismiss: (id) =>
		set((state) => ({ visible: state.visible.filter((n) => n.id !== id) })),

	/**
	 * Answer an offer notification — a shared contact, a document invite.
	 *
	 * The whole exchange rides on the notification rather than a separate dialog,
	 * so it works the same whether the phone is open, pocketed or peeking. The
	 * entry is resolved in place: it stops being actionable and says what happened.
	 *
	 * @param {number} id
	 * @param {boolean} accepted
	 */
	answerOffer: (id, accepted) => {
		const entry = get().history.find((n) => n.id === id);
		if (!entry?.offer) return;

		fetchNui('answerOffer', { kind: entry.offer.kind, token: entry.offer.token, accepted });

		const resolve = (n) =>
			n.id === id
				? {
						...n,
						offer: null,
						read: true,
						content: accepted ? entry.offer.acceptedText : 'Declined',
					}
				: n;

		set((state) => ({
			// Answering also takes the toast down — the decision is made.
			visible: state.visible.filter((n) => n.id !== id),
			history: state.history.map(resolve),
		}));
	},

	/** Mark one entry acknowledged without removing it. */
	markRead: (id) =>
		set((state) => ({
			history: state.history.map((n) => (n.id === id ? { ...n, read: true } : n)),
		})),

	/** Remove a single entry from the centre. */
	remove: (id) =>
		set((state) => ({
			visible: state.visible.filter((n) => n.id !== id),
			history: state.history.filter((n) => n.id !== id),
		})),

	/** Remove every entry belonging to one app. */
	removeApp: (app) =>
		set((state) => ({
			visible: state.visible.filter((n) => n.app !== app),
			history: state.history.filter((n) => n.app !== app),
		})),

	clearHistory: () => set({ history: [] }),

	markAllRead: () =>
		set((state) => ({ history: state.history.map((n) => ({ ...n, read: true })) })),

	/** Opening an app clears its dot. */
	markAppRead: (app) =>
		set((state) => {
			if (!state.history.some((n) => n.app === app && !n.read)) return {};

			return {
				history: state.history.map((n) => (n.app === app ? { ...n, read: true } : n)),
			};
		}),

	/** `{ [appId]: unreadCount }` — drives the red bubble on each home icon. */
	unreadByApp: () => {
		const counts = {};

		for (const notification of get().history) {
			if (notification.read || !notification.app) continue;
			counts[notification.app] = (counts[notification.app] ?? 0) + 1;
		}

		return counts;
	},
}));

export default useNotifyStore;
