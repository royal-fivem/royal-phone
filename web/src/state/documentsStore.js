import { create } from 'zustand';
import fetchNui from '../utils/fetchNui';
import { DEFAULT_BANNER } from '../config/banners';

/**
 * Documents — written by one character, readable by whoever is invited.
 *
 * The list holds every document the player can see, owned or shared, with
 * `mine` and `canEdit` decided server-side. The client never asks to write a
 * document it was not invited to; the server checks anyway.
 *
 * Saves are debounced through `queueSave` so a burst of typing is one round
 * trip, and the local copy is updated straight away — the editor reads its own
 * state, never the response.
 */

let saveTimer = null;
let editing = null;

const useDocumentsStore = create((set, get) => ({
	loaded: false,
	documents: [],

	setData: (data) =>
		set((state) => {
			const incoming = data?.documents ?? [];
			const local = editing !== null ? state.documents.find((doc) => doc.id === editing) : null;

			return {
				loaded: true,
				documents: local
					? incoming.map((doc) =>
							doc.id === local.id
								? { ...doc, title: local.title, banner: local.banner, body: local.body }
								: doc
						)
					: incoming,
			};
		}),

	get: (id) => get().documents.find((doc) => doc.id === id) ?? null,

	/** Create locally with a temporary id, then adopt the server's. */
	create: async () => {
		const temporary = -Date.now();

		const draft = {
			id: temporary,
			title: 'Untitled document',
			banner: DEFAULT_BANNER,
			body: '',
			mine: true,
			canEdit: true,
			owner: 'You',
			shares: [],
			updatedAt: Date.now(),
			pending: true,
		};

		set((state) => ({ documents: [draft, ...state.documents] }));

		const result = await fetchNui('docs:save', {
			title: draft.title,
			banner: draft.banner,
			body: '',
		}, { id: temporary });

		const id = result?.id ?? temporary;

		set((state) => ({
			documents: state.documents.map((doc) => (doc.id === temporary ? { ...doc, id, pending: false } : doc)),
		}));

		return id;
	},

	/** Create from a template — same as `create`, with the body filled in. */
	createFrom: async (template) => {
		const temporary = -Date.now();

		const draft = {
			id: temporary,
			title: template.title || 'Untitled document',
			banner: template.banner || DEFAULT_BANNER,
			body: template.body || '',
			mine: true,
			canEdit: true,
			owner: 'You',
			shares: [],
			signable: false,
			sealed: false,
			canSign: false,
			signatures: [],
			updatedAt: Date.now(),
			pending: true,
		};

		set((state) => ({ documents: [draft, ...state.documents] }));

		const result = await fetchNui('docs:save', {
			title: draft.title,
			banner: draft.banner,
			body: draft.body,
		}, { id: temporary });

		const id = result?.id ?? temporary;

		set((state) => ({
			documents: state.documents.map((doc) => (doc.id === temporary ? { ...doc, id, pending: false } : doc)),
		}));

		return id;
	},

	/** Patch a document in place. Pass `{ silent: true }` to skip the save. */
	update: (id, patch, { silent = false } = {}) => {
		set((state) => ({
			documents: state.documents.map((doc) =>
				doc.id === id ? { ...doc, ...patch, updatedAt: Date.now() } : doc
			),
		}));

		if (!silent) get().queueSave(id);
	},

	/**
	 * One write per 800 ms of quiet. The timer is module-level rather than per
	 * document because the editor only ever has one open.
	 */
	queueSave: (id) => {
		clearTimeout(saveTimer);
		editing = id;

		saveTimer = setTimeout(async () => {
			saveTimer = null;

			const doc = get().get(id);
			if (!doc || doc.pending || !doc.canEdit) {
				editing = null;
				return;
			}

			await fetchNui('docs:save', {
				id: doc.id,
				title: doc.title,
				banner: doc.banner,
				body: doc.body,
			});

			// Only release the guard if nothing was typed while that was in flight.
			if (editing === id && saveTimer === null) editing = null;
		}, 800);
	},

	save: async (id) => {
		clearTimeout(saveTimer);
		saveTimer = null;

		const doc = get().get(id);
		if (!doc || doc.pending || !doc.canEdit) return { error: 'Nothing to save.' };

		editing = id;

		const result = await fetchNui('docs:save', {
			id: doc.id,
			title: doc.title,
			banner: doc.banner,
			body: doc.body,
			notify: true,
		}, { id: doc.id });

		if (editing === id && saveTimer === null) editing = null;

		if (!result || result.error) return { error: result?.error ?? 'Could not save.' };

		return { ok: true };
	},

	/** Force the pending write out — used when the editor closes. */
	flush: (id) => {
		clearTimeout(saveTimer);
		saveTimer = null;

		const doc = get().get(id);
		if (!doc || doc.pending || !doc.canEdit) {
			editing = null;
			return;
		}

		fetchNui('docs:save', { id: doc.id, title: doc.title, banner: doc.banner, body: doc.body });

		editing = null;
	},

	remove: (id) => {
		set((state) => ({ documents: state.documents.filter((doc) => doc.id !== id) }));
		fetchNui('docs:delete', { id });
	},

	/**
	 * Send a document round for signing, or pull it back to a draft.
	 *
	 * Signing locks the document — the point of a contract is that what was
	 * agreed cannot be edited afterwards — so the server refuses if nobody has
	 * been invited yet.
	 */
	requestSignatures: async (id, signable = true) => {
		const result = await fetchNui('docs:requestSignatures', { id, signable }, { ok: true, signable });
		if (!result || result.error) return { error: result?.error ?? 'Could not send it for signing.' };

		set((state) => ({
			documents: state.documents.map((doc) =>
				doc.id === id ? { ...doc, signable, signatures: signable ? doc.signatures : [] } : doc
			),
		}));

		return { ok: true };
	},

	/** Sign it. The server owns the outcome; this only reflects it. */
	sign: async (id) => {
		const result = await fetchNui('docs:sign', { id }, { ok: true, outstanding: 0 });
		if (!result || result.error) return { error: result?.error ?? 'Could not sign.' };

		return { ok: true, outstanding: result.outstanding ?? 0 };
	},

	/**
	 * Invite by phone number. The server resolves it to a character and sends
	 * back the real name; `name` here is only the fallback used in the browser,
	 * where there is no server to ask.
	 */
	invite: async (id, number, canEdit = true, name = null) => {
		const result = await fetchNui('docs:invite', { id, number, canEdit }, {
			number,
			name: name ?? number,
			canEdit,
		});
		if (!result) return false;

		set((state) => ({
			documents: state.documents.map((doc) =>
				doc.id === id
					? { ...doc, shares: [...doc.shares.filter((s) => s.number !== result.number), result] }
					: doc
			),
		}));

		return true;
	},

	uninvite: (id, number) => {
		set((state) => ({
			documents: state.documents.map((doc) =>
				doc.id === id ? { ...doc, shares: doc.shares.filter((s) => s.number !== number) } : doc
			),
		}));

		fetchNui('docs:uninvite', { id, number });
	},

	/** Browser-only seed. */
	loadMock: () =>
		set({
			loaded: true,
			documents: [
				{
					id: 1,
					title: 'Garage inventory',
					banner: 'ocean',
					body:
						'<h2>Stock on hand</h2><p>Counted after the <b>Tuesday</b> delivery. Anything below three needs ordering.</p><ul><li>Brake pads — 12</li><li>Turbo kits — 2</li><li>Nitrous — 7</li></ul><blockquote>Mikkel is picking up the turbo order Friday.</blockquote>',
					mine: true,
					canEdit: false,
					owner: 'You',
					shares: [{ number: '555-0192', name: 'Mikkel', canEdit: true }],
					updatedAt: Date.now() - 3_600_000,
					// Fully signed, so locked.
					signable: true,
					sealed: true,
					canSign: false,
					signatures: [
						{ identifier: 'me', name: 'Jonas Royal', number: '555-0134', signed: true, signedAt: Date.now() - 3_700_000 },
						{ identifier: 'mk', name: 'Mikkel', number: '555-0192', signed: true, signedAt: Date.now() - 3_600_000 },
					],
				},
				{
					id: 2,
					title: 'Crew rules',
					banner: 'ember',
					body:
						'<h1>House rules</h1><p>Short and non-negotiable.</p><ol><li>No business over open radio.</li><li>Cuts are settled the same night.</li><li>Nobody rides alone after dark.</li></ol>',
					mine: false,
					canEdit: false,
					owner: 'Sara Vance',
					shares: [],
					updatedAt: Date.now() - 86_400_000,
					// Waiting on you — the case the Notifications tab exists for.
					signable: true,
					sealed: false,
					canSign: true,
					signatures: [
						{ identifier: 'sv', name: 'Sara Vance', number: '555-0110', signed: true, signedAt: Date.now() - 90_000_000 },
						{ identifier: 'me', name: 'Jonas Royal', number: '555-0134', signed: false, signedAt: null },
					],
				},
				{
					id: 3,
					title: 'Untitled document',
					banner: 'slate',
					body: '',
					mine: true,
					canEdit: true,
					owner: 'You',
					shares: [],
					updatedAt: Date.now() - 172_800_000,
					signable: false,
					sealed: false,
					canSign: false,
					signatures: [],
				},
			],
		}),
}));

export default useDocumentsStore;
