import { create } from 'zustand';
import fetchNui from '../utils/fetchNui';
import { playSound } from '../utils/sound';

const PHOTO_LIMIT = 30;

const MOCK = {
	number: '555-0134',
	name: 'Jonas Royal',
	sim: 'SIM-4821-0093',
	simOwner: 'Jonas Royal',
	job: 'Unemployed',
	cash: 2480,
	bank: 118_400,
	contacts: [
		{ id: 1, name: 'Mikkel', number: '555-0192', avatar: null },
		{ id: 2, name: 'Sara Vance', number: '555-0110', avatar: null },
		{ id: 3, name: 'Chop Shop', number: '555-0777', avatar: null },
	],
	messages: [
		{ id: 1, sender: '555-0192', receiver: '555-0134', content: 'yo you up?', read: 1, createdAt: Date.now() - 5_400_000 },
		{ id: 2, sender: '555-0134', receiver: '555-0192', content: 'yeah, garage in 10', read: 1, createdAt: Date.now() - 5_300_000 },
		{ id: 3, sender: '555-0110', receiver: '555-0134', content: 'The car is ready for pickup.', read: 0, createdAt: Date.now() - 900_000 },
	],
	calls: [
		{ id: 1, caller: '555-0192', receiver: '555-0134', answered: 1, createdAt: Date.now() - 7_200_000 },
		{ id: 2, caller: '555-0134', receiver: '555-0777', answered: 0, createdAt: Date.now() - 3_600_000 },
	],
	notes: [{ id: 1, title: 'Stash', body: 'Behind the pier, third crate.', updatedAt: Date.now() - 86_400_000 }],
	groups: [{ id: 1, name: 'Garage Crew', members: ['555-0192', '555-0777'], owner: '555-0134' }],

	photos: [
		{
			takenAt: Date.now() - 3_600_000,
			url:
				'data:image/svg+xml;base64,' +
				btoa(
					'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360">' +
						'<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">' +
						'<stop offset="0" stop-color="#1b2a4a"/><stop offset="0.55" stop-color="#4a3b6b"/>' +
						'<stop offset="1" stop-color="#c2643f"/></linearGradient></defs>' +
						'<rect width="480" height="360" fill="url(#s)"/>' +
						'<circle cx="370" cy="90" r="34" fill="#ffd9a0" opacity="0.9"/>' +
						'<path d="M0 268 L110 196 L196 250 L300 168 L480 262 L480 360 L0 360 Z" fill="#0d1120"/>' +
						'<path d="M0 300 L150 244 L268 292 L400 232 L480 268 L480 360 L0 360 Z" fill="#070a14"/>' +
						'</svg>'
				),
		},
	],
	invoices: [
		{ id: 41, label: 'Speeding fine', sender: 'LSPD', amount: 750, paid: 0, canDecline: 1, createdAt: Date.now() - 1_800_000 },
		{ id: 40, label: 'Court fine', sender: 'LSPD', amount: 5_000, paid: 0, canDecline: 0, createdAt: Date.now() - 3_600_000 },
		{
			id: 39,
			label: 'Garage storage',
			sender: 'Bennys',
			amount: 240,
			paid: 0,
			declined: 1,
			canDecline: 1,
			createdAt: Date.now() - 172_800_000,
			declinedAt: Date.now() - 169_200_000,
		},
		{
			id: 28,
			label: 'Vehicle repair',
			sender: 'Bennys',
			amount: 1_450,
			paid: 1,
			canDecline: 1,
			createdAt: Date.now() - 604_800_000,
			paidAt: Date.now() - 601_200_000,
		},
	],
	bankFeatures: { invoices: true },
	transactions: [
		{ id: 1, label: 'Vehicle fuel 61.72L', amount: -93, createdAt: Date.now() - 240_000 },
		{ id: 2, label: 'POS tax', amount: -60, createdAt: Date.now() - 480_000 },
		{ id: 3, label: 'POS sale', amount: -500, createdAt: Date.now() - 490_000 },
		{ id: 4, label: 'Vehicle Loan installment', amount: -1302, createdAt: Date.now() - 3_600_000 },
		{ id: 5, label: 'Paycheck', amount: 1850, createdAt: Date.now() - 86_400_000 },
		{ id: 6, label: 'Vehicle Loan installment', amount: -1302, createdAt: Date.now() - 259_200_000 },
	],
};

const useDataStore = create((set, get) => ({
	loaded: false,
	number: '',
	name: '',

	sim: null,
	simOwner: null,
	job: null,
	cash: 0,
	bank: 0,
	contacts: [],
	messages: [],
	calls: [],
	notes: [],
	photos: [],
	transactions: [],
	invoices: [],
	bankFeatures: { invoices: true },

	groups: [],

	setData: (data) => set({ ...(data || {}), loaded: true }),

	loadMock: () => set({ ...MOCK, loaded: true }),

	pushMessage: (message) =>
		set((state) => ({ messages: [...state.messages, message] })),

	/**
	 * @param {string} target a number, or `group:<id>` for a group thread
	 * @param {string} content
	 * @param {{ kind?: 'text'|'image'|'voice', media?: string, seconds?: number }} [extra]
	 */
	sendMessage: async (target, content, extra = {}) => {
		const mine = get().number;

		playSound('newmessagesent_inapp');
		const optimistic = {
			id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
			sender: mine,
			receiver: target,
			content,
			kind: extra.kind ?? 'text',
			media: extra.media,
			seconds: extra.seconds,
			location: extra.location,
			read: 1,
			createdAt: Date.now(),
			pending: true,
		};

		set((state) => ({ messages: [...state.messages, optimistic] }));

		const result = await fetchNui(
			'sendMessage',
			{
				number: target,
				content,
				kind: optimistic.kind,
				media: extra.media,
				seconds: extra.seconds,
				location: extra.location,
			},
			{ id: optimistic.id, createdAt: Date.now() }
		);

		set((state) => ({
			messages: state.messages.map((m) =>
				m.id === optimistic.id ? { ...m, id: result?.id ?? m.id, pending: false } : m
			),
		}));
	},

	markRead: (number) => {
		const mine = get().number;
		const hasUnread = get().messages.some((m) => m.sender === number && m.receiver === mine && !m.read);
		if (!hasUnread) return;

		set((state) => ({
			messages: state.messages.map((m) =>
				m.sender === number && m.receiver === mine ? { ...m, read: 1 } : m
			),
		}));

		fetchNui('markRead', { number });
	},

	addContact: async (contact) => {
		const result = await fetchNui('addContact', contact, { id: Date.now() });
		if (!result) return;

		set((state) => {
			const next = contact.id
				? state.contacts.map((c) => (c.id === contact.id ? { ...c, ...contact } : c))
				: [...state.contacts, { ...contact, id: result.id }];

			return { contacts: next.sort((a, b) => a.name.localeCompare(b.name)) };
		});
	},

	removeContact: async (id) => {
		await fetchNui('removeContact', { id }, true);
		set((state) => ({ contacts: state.contacts.filter((c) => c.id !== id) }));
	},

	saveNotes: (notes) => {
		set({ notes });
		fetchNui('saveNotes', { notes });
	},

	addPhoto: (photo) =>
		set((state) => ({ photos: [photo, ...state.photos].slice(0, PHOTO_LIMIT) })),

	addPhotoUrl: async (url) => {
		const clean = (url || '').trim();

		if (!/^https?:\/\/\S+$/i.test(clean)) return { error: 'Paste a link starting with http.' };

		const result = await fetchNui(
			'addPhotoUrl',
			{ url: clean },
			{ ok: true, photo: { id: Date.now(), takenAt: Date.now(), url: clean } }
		);

		if (!result?.ok) return { error: 'That link could not be saved.' };

		get().addPhoto(result.photo);

		return {};
	},

	removePhoto: (index) => {
		const photo = get().photos[index];

		set((state) => ({ photos: state.photos.filter((_, i) => i !== index) }));

		if (photo?.id) fetchNui('deletePhoto', { id: photo.id });
	},

	createGroup: async (name, members) => {
		const clean = (members || []).filter(Boolean);

		if (!name?.trim()) return { error: 'Give the group a name.' };
		if (clean.length === 0) return { error: 'Pick at least one person.' };

		const result = await fetchNui(
			'createGroup',
			{ name: name.trim(), members: clean },
			{ id: Date.now() }
		);

		if (!result) return { error: 'Could not create the group.' };
		if (result.error) return { error: result.error };

		const group = {
			id: result.id,
			name: name.trim(),
			members: [get().number, ...clean],
			owner: get().number,
			isOwner: true,
		};

		set((state) => ({ groups: [...state.groups, group] }));

		return { group };
	},

	inviteToGroup: async (id, member) => {
		const number = member?.trim();
		if (!number) return { error: 'Enter a number.' };

		const group = get().groups.find((g) => g.id === id);
		if (!group) return { error: 'Group not found.' };
		if (group.members.includes(number)) return { error: 'They are already in it.' };

		const result = await fetchNui('inviteToGroup', { id, number }, { ok: true });

		if (!result || result.error) return { error: result?.error ?? 'Could not add them.' };

		set((state) => ({
			groups: state.groups.map((g) =>
				g.id === id ? { ...g, members: [...g.members, number] } : g
			),
		}));

		return { ok: true };
	},

	kickFromGroup: (id, member) => {
		fetchNui('kickFromGroup', { id, number: member });
		set((state) => ({
			groups: state.groups.map((g) =>
				g.id === id ? { ...g, members: g.members.filter((m) => m !== member) } : g
			),
		}));
	},

	renameGroup: (id, name) => {
		if (!name?.trim()) return { error: 'Give the group a name.' };

		fetchNui('updateGroup', { id, name: name.trim() });
		set((state) => ({
			groups: state.groups.map((g) => (g.id === id ? { ...g, name: name.trim() } : g)),
		}));

		return { ok: true };
	},

	setGroupAvatar: (id, avatar) => {
		fetchNui('updateGroup', { id, avatar: avatar ?? '' });
		set((state) => ({
			groups: state.groups.map((g) => (g.id === id ? { ...g, avatar: avatar || null } : g)),
		}));
	},

	removeGroup: (id) => {
		fetchNui('removeGroup', { id });
		set((state) => ({ groups: state.groups.filter((g) => g.id !== id) }));
	},

	ownsGroup: (group) =>
		Boolean(group) && (group.isOwner === true || group.owner === get().number),

	nameFor: (number) => {
		if (typeof number === 'string' && number.startsWith('group:')) {
			const group = get().groups.find((g) => `group:${g.id}` === number);
			return group?.name || 'Group';
		}

		const contact = get().contacts.find((c) => c.number === number);
		return contact?.name || number;
	},

	contactFor: (number) => get().contacts.find((c) => c.number === number),
}));

export default useDataStore;
