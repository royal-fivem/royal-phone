import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import {
	FishFoodIcon,
	Wrench01Icon,
	WaveIcon,
	ShoppingBasket01Icon,
	SquareLock01Icon,
	ViewIcon,
	ViewOffIcon,
	BoatIcon,
	Location01Icon,
	Medal01Icon,
	Store01Icon,
	StarIcon,
	Dollar01Icon,
	AnchorIcon,
} from '@hugeicons/core-free-icons';

import useFishingStore, { RARITY, rankFor, nextRankFor, BOAT_LEVEL } from '../state/fishingStore';
import { formatMoney, formatRelative } from '../utils/format';

const TABS = [
	{ id: 'home', label: 'Home', icon: FishFoodIcon },
	{ id: 'workshop', label: 'Workshop', icon: Wrench01Icon },
	{ id: 'zones', label: 'Zones', icon: WaveIcon },
	{ id: 'catches', label: 'Catches', icon: ShoppingBasket01Icon },
];

//#region shared

// Section headings, cards and tiles follow `_shared.jsx` so the app reads as
// part of the phone rather than a guest on it.
function Label({ children, action }) {
	return (
		<div className="mb-2 flex items-baseline justify-between px-1">
			<h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">{children}</h2>
			{action}
		</div>
	);
}

function Card({ children, className = '', locked = false }) {
	return (
		<div className={`rounded-2xl ${locked ? 'bg-white/[0.03]' : 'bg-white/[0.06]'} ${className}`}>{children}</div>
	);
}

/** Rounded-square glyph tile used by locked gear and zone headers. */
function Tile({ icon, tone = 'muted' }) {
	const tones = {
		muted: 'bg-white/[0.06] text-white/25',
		sky: 'bg-sky-500/15 text-sky-400',
		amber: 'bg-amber-500/15 text-amber-300',
	};

	return (
		<span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
			<HugeiconsIcon icon={icon} size={18} strokeWidth={1.9} />
		</span>
	);
}

function Empty({ icon, label, hint }) {
	return (
		<div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
			<span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.05] text-white/40">
				<HugeiconsIcon icon={icon} size={24} strokeWidth={1.7} />
			</span>
			<div>
				<div className="text-[14px] font-bold text-white/70">{label}</div>
				{hint && <div className="mt-0.5 text-[12px] text-white/35">{hint}</div>}
			</div>
		</div>
	);
}

/** Fish name + rarity dot, as used on the zone cards. */
function FishChip({ fish, dim }) {
	const rarity = RARITY[fish.rarity] ?? RARITY.common;

	return (
		<span
			className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] ${
				dim ? 'bg-white/[0.03] text-white/25' : 'bg-white/[0.06] text-white/75'
			}`}
		>
			<HugeiconsIcon icon={FishFoodIcon} size={11} strokeWidth={2} className={dim ? '' : 'text-white/45'} />
			{fish.name}
			<span className={`h-1.5 w-1.5 rounded-full ${dim ? 'bg-white/15' : rarity.dot}`} />
		</span>
	);
}

//#endregion

//#region home

function Journey() {
	const { level, xp, xpToNext, stats, boat, recent } = useFishingStore();

	const rank = rankFor(level);
	const next = nextRankFor(level);
	const pct = Math.min(100, Math.round((xp / Math.max(1, xpToNext)) * 100));

	return (
		<div className="royal-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-4">
			<Label>Your journey</Label>
			<Card className="mb-4 p-4">
				<div className="flex items-end justify-between">
					<div>
						<div className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-400">{rank}</div>
						<div className="mt-0.5 flex items-baseline gap-1.5">
							<span className="text-[28px] font-bold leading-none text-white">{level}</span>
							<span className="text-[12px] text-white/35">Level</span>
						</div>
					</div>

					<span className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-500/15 text-sky-400">
						<HugeiconsIcon icon={Medal01Icon} size={20} strokeWidth={1.9} />
					</span>
				</div>

				<div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
					<motion.div
						className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-400"
						initial={{ width: 0 }}
						animate={{ width: `${pct}%` }}
						transition={{ type: 'spring', stiffness: 120, damping: 24 }}
					/>
				</div>

				<div className="mt-1.5 flex items-center justify-between text-[11.5px]">
					<span className="tabular-nums text-white/45">
						{xp} / {xpToNext} XP
					</span>
					{next && <span className="text-white/35">Next: {next.name}</span>}
				</div>
			</Card>

			<div className="mb-4 grid grid-cols-2 gap-2.5">
				<Card className="p-3">
					<div className="mb-1 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/35">
						<HugeiconsIcon icon={FishFoodIcon} size={12} strokeWidth={2.2} /> Biggest
					</div>
					{stats.biggest ? (
						<>
							<div className="truncate text-[14px] font-bold text-white">{stats.biggest.name}</div>
							<div className="text-[12px] tabular-nums text-white/45">{stats.biggest.weight} kg</div>
						</>
					) : (
						<div className="text-[13px] text-white/25">Nothing yet</div>
					)}
				</Card>

				<Card className="p-3">
					<div className="mb-1 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/35">
						<HugeiconsIcon icon={StarIcon} size={12} strokeWidth={2.2} /> Rarest
					</div>
					{stats.rarest ? (
						<>
							<div className="truncate text-[14px] font-bold text-white">{stats.rarest.name}</div>
							<div className={`text-[12px] ${(RARITY[stats.rarest.rarity] ?? RARITY.common).text}`}>
								{(RARITY[stats.rarest.rarity] ?? RARITY.common).label}
							</div>
						</>
					) : (
						<div className="text-[13px] text-white/25">Nothing yet</div>
					)}
				</Card>
			</div>

			<div className="mb-4 grid grid-cols-2 gap-2.5">
				<Card className="p-3">
					<div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/35">Total caught</div>
					<div className="mt-0.5 text-[20px] font-bold tabular-nums leading-none text-white">{stats.caught}</div>
				</Card>

				<Card className="p-3">
					<div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/35">
						<HugeiconsIcon icon={Dollar01Icon} size={12} strokeWidth={2.2} /> Earnings
					</div>
					<div className="mt-0.5 text-[20px] font-bold tabular-nums leading-none text-emerald-400">
						{formatMoney(stats.earnings)}
					</div>
				</Card>
			</div>

			<Label>Your boat</Label>
			<Card locked={!boat.unlocked} className="mb-4 flex items-center gap-3 p-3.5">
				<Tile icon={boat.unlocked ? BoatIcon : SquareLock01Icon} tone={boat.unlocked ? 'sky' : 'muted'} />

				<div className="min-w-0 flex-1">
					<div className={`truncate text-[14.5px] font-bold ${boat.unlocked ? 'text-white' : 'text-white/40'}`}>
						{boat.unlocked ? boat.name : 'Locked'}
					</div>
					<div className="truncate text-[12px] text-white/35">
						{boat.unlocked ? 'Ready at the marina' : `Unlocks at level ${BOAT_LEVEL}`}
					</div>
				</div>

				{!boat.unlocked && (
					<span className="shrink-0 rounded-lg bg-white/[0.06] px-2 py-1 text-[11px] font-bold text-white/40">
						Lvl {BOAT_LEVEL}
					</span>
				)}
			</Card>

			<Label>Recent catches</Label>
			{recent.length === 0 ? (
				<Card className="px-4 py-6 text-center text-[13px] text-white/30">Nothing caught yet</Card>
			) : (
				recent.map((catchItem) => {
					const rarity = RARITY[catchItem.rarity] ?? RARITY.common;

					return (
						<Card key={catchItem.id} className="mb-2 flex items-center gap-3 p-3">
							<span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] ${rarity.text}`}>
								<HugeiconsIcon icon={FishFoodIcon} size={17} strokeWidth={1.9} />
							</span>

							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<span className="truncate text-[14px] font-bold text-white">{catchItem.name}</span>
									<span className={`shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase ${rarity.chip}`}>
										{rarity.label}
									</span>
								</div>
								<div className="truncate text-[11.5px] text-white/35">{catchItem.zone}</div>
							</div>

							<div className="shrink-0 text-right">
								<div className="text-[13px] font-bold tabular-nums text-white">{catchItem.weight} kg</div>
								<div className="text-[11px] text-white/30">{formatRelative(catchItem.at)}</div>
							</div>
						</Card>
					);
				})
			)}
		</div>
	);
}

//#endregion

//#region workshop

const FILTERS = [
	{ id: 'all', label: 'All' },
	{ id: 'rod', label: 'Rods' },
	{ id: 'bait', label: 'Bait' },
];

function Workshop() {
	const harvesting = useFishingStore((s) => s.harvesting);
	const equipment = useFishingStore((s) => s.equipment);
	const equipped = useFishingStore((s) => s.equipped);
	const equip = useFishingStore((s) => s.equip);

	const [filter, setFilter] = useState('all');

	const shown = useMemo(
		() => (filter === 'all' ? equipment : equipment.filter((item) => item.kind === filter)),
		[equipment, filter]
	);

	return (
		<div className="royal-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-4">
			<Label>Harvesting</Label>
			{harvesting.map((item) => (
				<Card key={item.id} locked={!item.unlocked} className="mb-4 p-4">
					<Tile icon={item.unlocked ? FishFoodIcon : SquareLock01Icon} tone={item.unlocked ? 'sky' : 'muted'} />

					<div className="mt-3">
						<div className={`text-[14.5px] font-bold ${item.unlocked ? 'text-white' : 'text-white/40'}`}>
							{item.name}
						</div>
						<div className="text-[12px] text-white/30">Lvl {item.level}</div>
					</div>
				</Card>
			))}

			<Label
				action={
					<span className="flex items-center gap-1.5 text-[11.5px] font-medium text-sky-400">
						<HugeiconsIcon icon={Store01Icon} size={12} strokeWidth={2.2} /> Visit store to buy
					</span>
				}
			>
				Equipment catalog
			</Label>

			<div className="mb-3 grid grid-cols-2 gap-2.5">
				{[
					{ kind: 'rod', label: 'Rod', tone: 'sky' },
					{ kind: 'bait', label: 'Bait', tone: 'amber' },
				].map((slot) => (
					<Card key={slot.kind} className="flex items-center gap-2.5 p-3">
						<Tile icon={FishFoodIcon} tone={slot.tone} />
						<div className="min-w-0">
							<div className="text-[11.5px] text-white/40">{slot.label}</div>
							<div className="truncate text-[13.5px] font-bold text-white">
								{equipped[slot.kind]?.name ?? 'None'}
							</div>
						</div>
					</Card>
				))}
			</div>

			<div className="mb-3 flex gap-2">
				{FILTERS.map((item) => (
					<button
						key={item.id}
						onClick={() => setFilter(item.id)}
						className={`rounded-full px-4 py-1.5 text-[12.5px] font-bold transition ${
							filter === item.id
								? 'bg-white/[0.10] text-white'
								: 'bg-white/[0.045] text-white/40 hover:text-white/70'
						}`}
					>
						{item.label}
					</button>
				))}
			</div>

			{shown.map((item) => (
				<button
					key={item.id}
					onClick={() => equip(item)}
					disabled={!item.owned}
					className="mb-1 flex w-full items-center gap-3 rounded-xl px-1 py-3 text-left transition disabled:cursor-default"
				>
					<HugeiconsIcon
						icon={FishFoodIcon}
						size={17}
						strokeWidth={1.9}
						className={item.owned ? 'shrink-0 text-sky-400' : 'shrink-0 text-white/20'}
					/>

					<span className={`min-w-0 flex-1 truncate text-[14px] ${item.owned ? 'text-white' : 'text-white/30'}`}>
						{item.name}
					</span>

					{item.owned ? (
						<span className="shrink-0 text-[11.5px] font-bold text-sky-400">
							{equipped[item.kind]?.id === item.id ? 'Equipped' : 'Equip'}
						</span>
					) : (
						<span className="shrink-0 text-[11px] text-white/20">Lvl {item.level}</span>
					)}
				</button>
			))}
		</div>
	);
}

//#endregion

//#region zones

function Zones() {
	const zones = useFishingStore((s) => s.zones);
	const route = useFishingStore((s) => s.route);
	const [showLocked, setShowLocked] = useState(true);

	const open = zones.filter((zone) => zone.open);
	const locked = zones.filter((zone) => !zone.open);

	return (
		<div className="royal-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-4">
			<Label>Open ({open.length})</Label>

			{open.length === 0 ? (
				<Card className="mb-4 px-4 py-6 text-center text-[13px] text-white/30">
					No zones open right now
				</Card>
			) : (
				open.map((zone) => (
					<Card key={zone.id} className="mb-4 !bg-emerald-500/[0.09] p-3.5">
						<span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-1 text-[10.5px] font-bold text-emerald-400">
							<span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Open
						</span>

						<div className="flex items-start gap-3">
							<Tile icon={Location01Icon} tone="sky" />

							<div className="min-w-0 flex-1">
								<button
									onClick={() => route(zone)}
									className="truncate text-left text-[15px] font-bold text-white"
								>
									{zone.name}
								</button>

								<div className="mb-2 mt-1.5 text-[11.5px] text-white/35">Fish in this area</div>

								<div className="flex flex-wrap gap-1.5">
									{zone.fish.map((fish) => (
										<FishChip key={fish.name} fish={fish} />
									))}
								</div>
							</div>
						</div>
					</Card>
				))
			)}

			<Label
				action={
					<button
						onClick={() => setShowLocked((v) => !v)}
						className="text-white/40 transition hover:text-white/70"
					>
						<HugeiconsIcon icon={showLocked ? ViewIcon : ViewOffIcon} size={14} strokeWidth={2} />
					</button>
				}
			>
				Locked ({locked.length})
			</Label>

			<AnimatePresence initial={false}>
				{showLocked &&
					locked.map((zone) => (
						<motion.div
							key={zone.id}
							initial={{ opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: 'auto' }}
							exit={{ opacity: 0, height: 0 }}
							className="overflow-hidden"
						>
							<Card locked className="mb-3 p-3.5">
								<div className="mb-3 flex items-center gap-2">
									<span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2 py-1 text-[10.5px] font-bold text-white/35">
										<HugeiconsIcon icon={SquareLock01Icon} size={10} strokeWidth={2.4} /> Locked
									</span>
									<span className="rounded-full bg-white/[0.05] px-2 py-1 text-[10.5px] font-bold text-white/35">
										Lvl {zone.level}
									</span>
								</div>

								<div className="flex items-start gap-3">
									<Tile icon={SquareLock01Icon} />

									<div className="min-w-0 flex-1">
										<div className="truncate text-[15px] font-bold text-white/40">{zone.name}</div>
										<div className="mb-2 mt-1.5 text-[11.5px] text-white/25">Fish in this area</div>

										<div className="flex flex-wrap gap-1.5">
											{zone.fish.map((fish) => (
												<FishChip key={fish.name} fish={fish} dim />
											))}
										</div>
									</div>
								</div>
							</Card>
						</motion.div>
					))}
			</AnimatePresence>
		</div>
	);
}

//#endregion

//#region catches

function Catches() {
	const bucket = useFishingStore((s) => s.bucket);
	const sellBucket = useFishingStore((s) => s.sellBucket);

	const total = bucket.reduce((sum, item) => sum + (item.price ?? 0), 0);

	if (bucket.length === 0) {
		return (
			<div className="min-h-0 flex-1 px-5">
				<Empty icon={AnchorIcon} label="Nothing in the bucket yet" hint="Head to a zone and start fishing" />
			</div>
		);
	}

	return (
		<div className="royal-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-4">
			{bucket.map((item) => {
				const rarity = RARITY[item.rarity] ?? RARITY.common;

				return (
					<Card key={item.id} className="mb-2 flex items-center gap-3 p-3">
						<span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] ${rarity.text}`}>
							<HugeiconsIcon icon={FishFoodIcon} size={17} strokeWidth={1.9} />
						</span>

						<div className="min-w-0 flex-1">
							<div className="truncate text-[14px] font-bold text-white">{item.name}</div>
							<div className="text-[11.5px] tabular-nums text-white/35">{item.weight} kg</div>
						</div>

						<span className="shrink-0 text-[13px] font-bold tabular-nums text-white/70">
							{formatMoney(item.price ?? 0)}
						</span>
					</Card>
				);
			})}

			<button
				onClick={sellBucket}
				className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-[14px] font-bold text-white"
			>
				Sell all · {formatMoney(total)}
			</button>
		</div>
	);
}

//#endregion

const TITLES = { home: 'Fishing', workshop: 'Workshop', zones: 'Fishing Zones', catches: 'Catches' };

export default function FishingApp() {
	const [tab, setTab] = useState('home');

	return (
		<div
			className="flex h-full w-full flex-col"
			style={{ paddingTop: 'var(--status-h)', paddingBottom: 'var(--chrome-b)' }}
		>
			<header className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-1">
				<h1 className="flex-1 truncate text-[26px] font-bold leading-tight tracking-tight text-white">
					{TITLES[tab]}
				</h1>
			</header>

			{tab === 'home' && <Journey />}
			{tab === 'workshop' && <Workshop />}
			{tab === 'zones' && <Zones />}
			{tab === 'catches' && <Catches />}

			<nav className="mx-4 mb-1 flex shrink-0 items-center justify-around rounded-3xl bg-white/[0.05] p-1.5">
				{TABS.map((item) => {
					const active = tab === item.id;

					return (
						<button
							key={item.id}
							onClick={() => setTab(item.id)}
							className={`flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 transition ${
								active ? 'bg-white/[0.10] text-white' : 'text-white/40 hover:text-white/70'
							}`}
						>
							<HugeiconsIcon icon={item.icon} size={19} strokeWidth={active ? 2 : 1.7} />
							<span className="text-[10px] font-medium">{item.label}</span>
						</button>
					);
				})}
			</nav>
		</div>
	);
}
