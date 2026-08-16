import { create } from 'zustand';
import fetchNui from '../utils/fetchNui';

const useLifeinvaderStore = create((set, get) => ({
	loaded: false,

	accounts: [],

	account: null,

	posts: [],
	listings: [],
	notifications: [],

	people: [],

	following: [],
	blocked: [],

	setData: (data) => set({ ...(data || {}), loaded: true }),

	refresh: async () => {
		const payload = await fetchNui('li:refresh', {}, null);
		if (payload) set({ ...payload, loaded: true });
	},

	loadMock: () => {
		const shot = (a, b) =>
			'data:image/svg+xml;base64,' +
			btoa(
				`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="420" height="300" fill="url(#g)"/></svg>`
			);

		set({
			loaded: true,
			accounts: [],
			account: null,
			following: ['BigHands'],
			blocked: [],
			people: [
				{ handle: 'BigHands', name: 'Simon', avatar: null, bio: 'Crops, mostly.', posts: 4, followers: 12 },
				{ handle: 'SIREN', name: 'SIREN', avatar: null, bio: 'late night radio', posts: 9, followers: 41 },
				{ handle: 'Ethan_Rivers', name: 'Ethan Rivers', avatar: null, bio: '', posts: 2, followers: 5 },

				{ handle: 'quiet_one', name: 'Nora', avatar: null, bio: 'lurking', posts: 0, followers: 1 },
			],
			posts: [
				{
					id: 1, handle: 'BigHands', name: 'Simon', avatar: null,
					text: 'Big Hands, bigger crops', media: shot('#2c5364', '#0f2027'),
					likes: 12, liked: false, reposts: 2, reposted: false, comments: [], createdAt: Date.now() - 60_000,
				},
				{
					id: 2, handle: 'Ethan_Rivers', name: 'Ethan Rivers', avatar: null,
					text: 'sigh', media: null,
					likes: 3, liked: false, reposts: 0, reposted: false, comments: [], createdAt: Date.now() - 90_000,
				},
				{
					id: 3, handle: 'SIREN', name: 'SIREN', avatar: null,
					text: '💚 🤍', media: shot('#41295a', '#2f0743'),
					likes: 41, liked: true, reposts: 7, reposted: false,
					comments: [{ id: 1, handle: 'BigHands', name: 'Simon', text: 'no way', createdAt: Date.now() - 120_000 }],
					createdAt: Date.now() - 180_000,
				},
			],
			listings: [
				{ id: 1, title: 'Hollywood', price: 100, body: 'Herrera MC President', media: shot('#8e9eab', '#eef2f3'), seller: 'Jebadiah Huckleberry', handle: 'jeb', createdAt: Date.now() - 180_000 },
				{ id: 2, title: 'Samuel Silk', price: 1000, body: 'Current: Pimp / Paralegal. Future: Bahama Mamas…', media: shot('#2193b0', '#6dd5ed'), seller: 'Samuel Silk', handle: 'silk', createdAt: Date.now() - 1_200_000 },
				{ id: 3, title: 'AYY AYY', price: 1, body: ':)', media: shot('#c94b4b', '#4b134f'), seller: 'Kai Tundae', handle: 'kai', createdAt: Date.now() - 1_680_000 },
				{ id: 4, title: 'Sellin lockpicks', price: 1, body: '', media: shot('#232526', '#414345'), seller: 'Nathan Kookie', handle: 'kookie', createdAt: Date.now() - 2_760_000 },
			],
			notifications: [],
		});
	},

	/** @returns {object|null} the active profile */
	me: () => get().accounts.find((a) => a.id === get().account) ?? null,

	createAccount: async (profile) => {
		const handle = profile.handle?.trim().replace(/^@/, '');
		const name = profile.name?.trim();
		if (!handle || !name) return null;

		const result = await fetchNui('li:createAccount', { ...profile, handle, name }, { id: Date.now() });

		const account = {
			id: result?.id ?? Date.now(),
			handle,
			name,
			avatar: profile.avatar || null,
			bio: profile.bio?.trim() || '',
			followers: 0,
		};

		set((state) => ({ accounts: [...state.accounts, account], account: account.id }));
		return account;
	},

	switchAccount: (id) => set({ account: id }),

	updateAccount: (patch) => {
		const id = get().account;
		if (!id) return;

		fetchNui('li:updateAccount', { id, ...patch });
		set((state) => ({
			accounts: state.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
		}));
	},

	post: async ({ text, media }) => {
		const me = get().me();
		if (!me || (!text?.trim() && !media)) return;

		const result = await fetchNui('li:post', { text, media }, { id: Date.now() });

		const entry = {
			id: result?.id ?? Date.now(),
			handle: me.handle,
			name: me.name,
			avatar: me.avatar,
			text: text?.trim() ?? '',
			media: media ?? null,
			likes: 0,
			liked: false,
			reposts: 0,
			reposted: false,
			comments: [],
			createdAt: Date.now(),
		};

		set((state) => ({ posts: [entry, ...state.posts] }));
	},

	toggleLike: (id) => {
		fetchNui('li:like', { id });

		set((state) => ({
			posts: state.posts.map((p) =>
				p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p
			),
		}));
	},

	repost: (id) => {
		fetchNui('li:repost', { id });
		set((state) => ({
			posts: state.posts.map((p) =>
				p.id === id ? { ...p, reposted: !p.reposted, reposts: p.reposts + (p.reposted ? -1 : 1) } : p
			),
		}));
	},

	comment: (id, text) => {
		const me = get().me();
		if (!me || !text?.trim()) return;

		fetchNui('li:comment', { id, text });

		set((state) => ({
			posts: state.posts.map((p) =>
				p.id === id
					? {
							...p,
							comments: [
								...p.comments,
								{ id: Date.now(), handle: me.handle, name: me.name, text: text.trim(), createdAt: Date.now() },
							],
						}
					: p
			),
		}));
	},

	toggleFollow: (handle) => {
		fetchNui('li:follow', { handle });
		set((state) => ({
			following: state.following.includes(handle)
				? state.following.filter((h) => h !== handle)
				: [...state.following, handle],
		}));
	},

	list: async ({ title, price, body, media }) => {
		const me = get().me();
		if (!me || !title?.trim()) return;

		const result = await fetchNui('li:list', { title, price, body, media }, { id: Date.now() });

		set((state) => ({
			listings: [
				{
					id: result?.id ?? Date.now(),
					title: title.trim(),
					price: Number(price) || 0,
					body: body?.trim() ?? '',
					media: media ?? null,
					seller: me.name,
					handle: me.handle,
					createdAt: Date.now(),
				},
				...state.listings,
			],
		}));
	},

	removeListing: (id) => {
		fetchNui('li:removeListing', { id });
		set((state) => ({ listings: state.listings.filter((l) => l.id !== id) }));
	},

	markAllRead: () => {
		fetchNui('li:readNotifications');
		set((state) => ({ notifications: state.notifications.map((n) => ({ ...n, read: true })) }));
	},

	unread: () => get().notifications.filter((n) => !n.read).length,

	block: (handle) => {
		fetchNui('li:block', { handle });
		set((state) => ({
			blocked: state.blocked.includes(handle)
				? state.blocked.filter((h) => h !== handle)
				: [...state.blocked, handle],
		}));
	},
}));

export default useLifeinvaderStore;
