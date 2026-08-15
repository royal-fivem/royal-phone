import { create } from 'zustand';
import fetchNui from '../utils/fetchNui';
import { DEFAULT_BANNER } from '../config/banners';

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

	update: (id, patch, { silent = false } = {}) => {
		set((state) => ({
			documents: state.documents.map((doc) =>
				doc.id === id ? { ...doc, ...patch, updatedAt: Date.now() } : doc
			),
		}));

		if (!silent) get().queueSave(id);
	},

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

	sign: async (id) => {
		const result = await fetchNui('docs:sign', { id }, { ok: true, outstanding: 0 });
		if (!result || result.error) return { error: result?.error ?? 'Could not sign.' };

		return { ok: true, outstanding: result.outstanding ?? 0 };
	},

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
