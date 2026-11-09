import { create } from 'zustand';
import { playSound } from '../utils/sound';
import fetchNui from '../utils/fetchNui';
import useDataStore from './dataStore';

let idCounter = 0;

const MAX_VISIBLE = 4;
const MAX_HISTORY = 60;

const trim = (list) => {
	if (list.length <= MAX_VISIBLE) return list;

	const excess = list.length - MAX_VISIBLE;
	const candidates = list.slice(0, -1);
	const dropped = new Set();

	for (const notification of candidates) {
		if (dropped.size === excess) break;
		if (notification.duration && !notification.offer) dropped.add(notification.id);
	}

	for (const notification of candidates) {
		if (dropped.size === excess) break;
		dropped.add(notification.id);
	}

	return list.filter((notification) => !dropped.has(notification.id));
};

const useNotifyStore = create((set, get) => ({
	visible: [],

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
			visible: trim([...state.visible, notification]),
			history: [notification, ...state.history].slice(0, MAX_HISTORY),
		}));

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
	answerOffer: async (id, accepted) => {
		const entry = get().history.find((n) => n.id === id);
		if (!entry?.offer) return;

		if (!accepted && entry.offer.canDecline === false) return;

		const resolve = (content) =>
			set((state) => ({
				visible: state.visible.filter((n) => n.id !== id),
				history: state.history.map((n) =>
					n.id === id ? { ...n, offer: null, read: true, content } : n
				),
			}));

		if (entry.offer.kind === 'invoice') {
			resolve(accepted ? 'Paying…' : 'Declining…');

			const result = await fetchNui(
				accepted ? 'bank:payInvoice' : 'bank:declineInvoice',
				{ id: entry.offer.invoice },
				{ ok: true }
			);

			if (!result || result.error) {
				return resolve(result?.error ?? (accepted ? 'Could not pay that.' : 'Could not decline that.'));
			}

			const invoiceId = entry.offer.invoice;
			const data = useDataStore.getState();

			data.setData({
				...(typeof result.cash === 'number' ? { cash: result.cash } : {}),
				...(typeof result.bank === 'number' ? { bank: result.bank } : {}),

				invoices: Array.isArray(result.invoices)
					? result.invoices
					: (data.invoices ?? []).map((row) =>
							row.id === invoiceId
								? accepted
									? { ...row, paid: 1, paidAt: Date.now() }
									: { ...row, declined: 1, declinedAt: Date.now() }
								: row
						),
			});

			return resolve(accepted ? 'Paid' : 'Declined');
		}

		fetchNui('answerOffer', { kind: entry.offer.kind, token: entry.offer.token, accepted });

		resolve(accepted ? entry.offer.acceptedText : 'Declined');
	},

	markRead: (id) =>
		set((state) => ({
			history: state.history.map((n) => (n.id === id ? { ...n, read: true } : n)),
		})),

	remove: (id) =>
		set((state) => ({
			visible: state.visible.filter((n) => n.id !== id),
			history: state.history.filter((n) => n.id !== id),
		})),

	removeApp: (app) =>
		set((state) => ({
			visible: state.visible.filter((n) => n.app !== app),
			history: state.history.filter((n) => n.app !== app),
		})),

	clearHistory: () => set({ history: [] }),

	markAllRead: () =>
		set((state) => ({ history: state.history.map((n) => ({ ...n, read: true })) })),

	markAppRead: (app) =>
		set((state) => {
			if (!state.history.some((n) => n.app === app && !n.read)) return {};

			return {
				history: state.history.map((n) => (n.app === app ? { ...n, read: true } : n)),
			};
		}),

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
