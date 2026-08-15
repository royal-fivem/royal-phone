import { create } from 'zustand';
import fetchNui from '../utils/fetchNui';

export const RANKS = [
	{ from: 1, name: 'Novice' },
	{ from: 5, name: 'Apprentice' },
	{ from: 10, name: 'Angler' },
	{ from: 20, name: 'Skilled Angler' },
	{ from: 35, name: 'Expert' },
	{ from: 50, name: 'Master' },
	{ from: 75, name: 'Legend' },
];

export const rankFor = (level) =>
	[...RANKS].reverse().find((rank) => level >= rank.from)?.name ?? RANKS[0].name;

export const nextRankFor = (level) => RANKS.find((rank) => level < rank.from) ?? null;

export const RARITY = {
	common: { label: 'Common', dot: 'bg-white/40', text: 'text-white/50', chip: 'bg-white/[0.08] text-white/60' },
	uncommon: { label: 'Uncommon', dot: 'bg-emerald-400', text: 'text-emerald-400', chip: 'bg-emerald-500/15 text-emerald-400' },
	rare: { label: 'Rare', dot: 'bg-sky-400', text: 'text-sky-400', chip: 'bg-sky-500/15 text-sky-400' },
	epic: { label: 'Epic', dot: 'bg-violet-400', text: 'text-violet-400', chip: 'bg-violet-500/15 text-violet-400' },
	legendary: { label: 'Legendary', dot: 'bg-amber-400', text: 'text-amber-400', chip: 'bg-amber-500/15 text-amber-400' },
};

export const BOAT_LEVEL = 10;

const useFishingStore = create((set, get) => ({
	loaded: false,

	level: 1,
	xp: 0,

	xpToNext: 100,

	stats: { caught: 0, earnings: 0, biggest: null, rarest: null },

	boat: { unlocked: false, name: null },

	recent: [],

	bucket: [],

	harvesting: [],

	equipment: [],
	equipped: { rod: null, bait: null },

	zones: [],

	setData: (data) => set({ ...(data || {}), loaded: true }),

	loadMock: () =>
		set({
			loaded: true,
			level: 6,
			xp: 340,
			xpToNext: 600,
			stats: {
				caught: 39,
				earnings: 14_820,
				biggest: { name: 'Channel Catfish', weight: 8.4, rarity: 'uncommon' },
				rarest: { name: 'Northern Pike', weight: 3.1, rarity: 'rare' },
			},
			boat: { unlocked: false, name: 'Dinghy' },
			recent: [
				{ id: 1, name: 'Perch', weight: 1.2, rarity: 'common', zone: 'Alamo Sea - South Shore', at: Date.now() - 900_000 },
				{ id: 2, name: 'Catfish', weight: 4.7, rarity: 'uncommon', zone: 'Alamo Sea - South Shore', at: Date.now() - 3_600_000 },
				{ id: 3, name: 'Northern Pike', weight: 3.1, rarity: 'rare', zone: 'Dam Reservoir', at: Date.now() - 86_400_000 },
				{ id: 4, name: 'Carp', weight: 2.4, rarity: 'common', zone: 'Alamo Sea - South Shore', at: Date.now() - 90_000_000 },
			],
			bucket: [],
			harvesting: [{ id: 1, name: 'Crab Pots', level: 6, unlocked: false }],
			equipment: [
				{ id: 1, name: 'Prodigy Rod', kind: 'rod', level: 30, owned: false },
				{ id: 2, name: 'Basic Rod', kind: 'rod', level: 1, owned: false },
				{ id: 3, name: 'Sunset Rod', kind: 'rod', level: 12, owned: false },
				{ id: 4, name: 'Golden Rod', kind: 'rod', level: 25, owned: false },
				{ id: 5, name: 'Aqua Rod', kind: 'rod', level: 8, owned: false },
				{ id: 6, name: 'Professional Rod', kind: 'rod', level: 18, owned: false },
				{ id: 7, name: 'Worm Bait', kind: 'bait', level: 1, owned: false },
				{ id: 8, name: 'Shrimp Bait', kind: 'bait', level: 5, owned: false },
				{ id: 9, name: 'Lure Bait', kind: 'bait', level: 14, owned: false },
			],
			equipped: { rod: null, bait: null },
			zones: [
				{
					id: 1, name: 'Alamo Sea - South Shore', open: true, level: 1,
					coords: { x: 1298.0, y: 4225.0 },
					fish: [
						{ name: 'Perch', rarity: 'common' },
						{ name: 'Catfish', rarity: 'uncommon' },
						{ name: 'Bullhead', rarity: 'common' },
						{ name: 'Carp', rarity: 'common' },
						{ name: 'Hake', rarity: 'uncommon' },
					],
				},
				{
					id: 2, name: 'Dam Reservoir', open: false, level: 2,
					coords: { x: 1720.0, y: 200.0 },
					fish: [
						{ name: 'Catfish', rarity: 'uncommon' },
						{ name: 'Bullhead', rarity: 'common' },
						{ name: 'Carp', rarity: 'common' },
						{ name: 'Drum Fish', rarity: 'uncommon' },
						{ name: 'Northern Pike', rarity: 'rare' },
					],
				},
				{
					id: 3, name: 'Alamo Sea - Deep', open: false, level: 8,
					coords: { x: 1050.0, y: 4300.0 },
					fish: [
						{ name: 'Lake Trout', rarity: 'uncommon' },
						{ name: 'Sturgeon', rarity: 'rare' },
						{ name: 'Muskie', rarity: 'epic' },
					],
				},
				{
					id: 4, name: 'Paleto Cove', open: false, level: 14,
					coords: { x: -275.0, y: 6635.0 },
					fish: [
						{ name: 'Rainbow Trout', rarity: 'common' },
						{ name: 'Salmon', rarity: 'uncommon' },
						{ name: 'Halibut', rarity: 'rare' },
					],
				},
				{
					id: 5, name: 'North Chumash', open: false, level: 22,
					coords: { x: -3200.0, y: 1300.0 },
					fish: [
						{ name: 'Yellowfin Tuna', rarity: 'rare' },
						{ name: 'Swordfish', rarity: 'epic' },
					],
				},
				{
					id: 6, name: 'Open Ocean', open: false, level: 30,
					coords: { x: -3400.0, y: 500.0 },
					fish: [
						{ name: 'Marlin', rarity: 'epic' },
						{ name: 'Great White', rarity: 'legendary' },
					],
				},
			],
		}),

	route: (zone) => {
		if (!zone?.coords) return;
		fetchNui('setWaypoint', zone.coords);
	},

	equip: (item) => {
		if (!item?.owned) return;

		fetchNui('fish:equip', { id: item.id, kind: item.kind });
		set((state) => ({ equipped: { ...state.equipped, [item.kind]: item } }));
	},

	sellBucket: () => {
		if (get().bucket.length === 0) return;

		fetchNui('fish:sell');
		set({ bucket: [] });
	},
}));

export default useFishingStore;
