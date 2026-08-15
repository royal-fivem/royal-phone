import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import {
	Search01Icon,
	Location01Icon,
	Car03Icon,
	CreditCardIcon,
	Copy01Icon,
	Tick02Icon,
	AutomotiveBattery01Icon,
	Fuel01Icon,
	CarParking01Icon,
	Location04Icon,
} from '@hugeicons/core-free-icons';

import { AppShell } from './_shared';
import usePhoneStore from '../state/phoneStore';
import fetchNui from '../utils/fetchNui';

const MOCK = [
	{
		id: 1,
		name: 'Adder',
		spawnName: 'adder',
		location: 'Elgin Avenue Garage',
		plate: '12345678',
		vin: null,
		engine: 100,
		body: 100,
		fuel: 100,
		mileage: 0,
		stored: true,
	},
];

const imageSources = (vehicle) => {
	const sources = [];
	if (vehicle.image) sources.push(vehicle.image);

	const name = vehicle.spawnName && String(vehicle.spawnName).toLowerCase();
	if (name) {
		sources.push(`https://cdn.jsdelivr.net/gh/royal-fivem/images@main/vehicles/${name}.webp`);
		sources.push(`https://docs.fivem.net/vehicles/${name}.webp`);
	}

	return sources;
};

const percent = (value) => `${Math.round(Math.max(0, Math.min(100, Number(value) || 0)))}%`;

const BTN_BASE =
	'flex items-center justify-center gap-2 rounded-full px-4 text-[13px] font-bold tracking-wide ' +
	'shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl transition ' +
	'disabled:pointer-events-none disabled:opacity-50';

const BTN_PRIMARY =
	`${BTN_BASE} border border-lime-300/35 bg-lime-900/60 text-lime-50 ` +
	'shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_6px_20px_-8px_rgba(163,230,53,0.55)] hover:bg-lime-800/70';

const BTN_GHOST =
	`${BTN_BASE} border border-white/[0.14] bg-white/[0.05] text-white/80 hover:bg-white/[0.09] hover:text-white`;

function VehicleShot({ vehicle, className = '' }) {
	const sources = useMemo(() => imageSources(vehicle), [vehicle.image, vehicle.spawnName]);
	const [index, setIndex] = useState(0);

	useEffect(() => setIndex(0), [sources]);

	if (index < sources.length) {
		return (
			<img
				key={sources[index]}
				src={sources[index]}
				onError={() => setIndex((current) => current + 1)}
				alt=""
				className={`w-full object-contain ${className}`}
				draggable={false}
			/>
		);
	}

	return (
		<div className={`grid w-full place-items-center text-white/15 ${className}`}>
			<HugeiconsIcon icon={Car03Icon} size={64} strokeWidth={1.2} />
		</div>
	);
}

function LocationLine({ location }) {
	return (
		<div className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-white/60">
			<HugeiconsIcon icon={Location01Icon} size={14} strokeWidth={1.9} className="shrink-0 text-white/45" />
			<span className="truncate">{location || 'Unknown location'}</span>
		</div>
	);
}

function CopyField({ icon, label, value }) {
	const [copied, setCopied] = useState(false);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(value ?? '');
		} catch {
		}

		setCopied(true);
		setTimeout(() => setCopied(false), 1200);
	};

	return (
		<div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 py-3">
			<div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.07] text-white/60">
				<HugeiconsIcon icon={icon} size={18} strokeWidth={1.8} />
			</div>

			<div className="min-w-0 flex-1">
				<div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/40">{label}</div>
				<div className="truncate text-[16px] font-bold tracking-wide text-white">{value || '——'}</div>
			</div>

			<button
				onClick={copy}
				className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/40 transition hover:bg-white/[0.08] hover:text-white"
			>
				<HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} size={16} strokeWidth={2} />
			</button>
		</div>
	);
}

function Stat({ icon, label, value, bar, tone = 'bg-white/60' }) {
	return (
		<div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3">
			<div className="flex items-center gap-2">
				<HugeiconsIcon icon={icon} size={15} strokeWidth={1.9} className="shrink-0 text-white/40" />
				<span className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-white/40">{label}</span>
			</div>

			<div className="mt-1.5 truncate text-[19px] font-bold leading-none tracking-tight text-white">{value}</div>

			<div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-white/[0.08]">
				{typeof bar === 'number' && (
					<div className={`h-full rounded-full ${tone}`} style={{ width: `${bar}%` }} />
				)}
			</div>
		</div>
	);
}

const toneFor = (value) => {
	const amount = Number(value) || 0;
	if (amount >= 70) return 'bg-lime-400/80';
	if (amount >= 35) return 'bg-amber-400/80';
	return 'bg-rose-500/80';
};

const clampPercent = (value) => Math.round(Math.max(0, Math.min(100, Number(value) || 0)));

function VehicleCard({ vehicle, onDetails, onTrack, selected }) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ type: 'spring', stiffness: 320, damping: 30 }}
			className={`mb-3 rounded-3xl border p-3.5 ${
				selected ? 'border-white/[0.16] bg-white/[0.07]' : 'border-white/[0.07] bg-white/[0.035]'
			}`}
		>
			<LocationLine location={vehicle.location} />

			<VehicleShot vehicle={vehicle} className="my-2 h-[112px]" />

			<div className="truncate text-[19px] font-bold tracking-tight text-white">{vehicle.name}</div>

			<div className="mt-3 flex gap-2.5">
				<button onClick={() => onDetails(vehicle)} className={`${BTN_GHOST} flex-1 py-2.5`}>
					DETAILS
				</button>

				<button onClick={() => onTrack(vehicle)} className={`${BTN_PRIMARY} flex-1 py-2.5`}>
					<HugeiconsIcon icon={Location04Icon} size={15} strokeWidth={2} />
					TRACK
				</button>
			</div>
		</motion.div>
	);
}

function Details({ vehicle, onBack, onTrack }) {
	return (
		<AppShell title="Car Details" onBack={onBack}>
			<div className="rounded-3xl border border-white/[0.07] bg-white/[0.035] p-4">
				<LocationLine location={vehicle.location} />
				<VehicleShot vehicle={vehicle} className="mt-2 h-[132px]" />
			</div>

			<h2 className="mt-4 truncate text-[24px] font-bold tracking-tight text-white">{vehicle.name}</h2>

			<div className="mt-3 space-y-2.5">
				<button onClick={() => onTrack(vehicle)} className={`${BTN_PRIMARY} w-full py-3.5`}>
					<HugeiconsIcon icon={Location04Icon} size={16} strokeWidth={2} />
					TRACK VEHICLE
				</button>
			</div>

			<div className="my-4 h-px bg-white/[0.07]" />

			<div className="space-y-2.5">
				<CopyField icon={CreditCardIcon} label="Plate" value={vehicle.plate} />
				{vehicle.vin && <CopyField icon={CarParking01Icon} label="VIN" value={vehicle.vin} />}
			</div>

			<div className="my-4 h-px bg-white/[0.07]" />

			<div className="grid grid-cols-2 gap-2.5 pb-4">
				<Stat
					icon={AutomotiveBattery01Icon}
					label="Engine"
					value={percent(vehicle.engine)}
					bar={clampPercent(vehicle.engine)}
					tone={toneFor(vehicle.engine)}
				/>
				<Stat
					icon={Fuel01Icon}
					label="Fuel"
					value={percent(vehicle.fuel)}
					bar={clampPercent(vehicle.fuel)}
					tone={toneFor(vehicle.fuel)}
				/>
				<Stat
					icon={Car03Icon}
					label="Body"
					value={percent(vehicle.body)}
					bar={clampPercent(vehicle.body)}
					tone={toneFor(vehicle.body)}
				/>
			</div>
		</AppShell>
	);
}

export default function GarageApp() {
	const [vehicles, setVehicles] = useState(null);
	const [query, setQuery] = useState('');
	const [openId, setOpenId] = useState(null);

	const expanded = usePhoneStore((s) => s.expanded);

	useEffect(() => {
		let alive = true;

		fetchNui('garage:vehicles', {}, MOCK).then((list) => {
			if (alive) setVehicles(Array.isArray(list) ? list : []);
		});

		return () => {
			alive = false;
		};
	}, []);

	const rows = useMemo(() => {
		const list = vehicles ?? [];
		const needle = query.trim().toLowerCase();
		if (!needle) return list;

		return list.filter((vehicle) =>
			[vehicle.name, vehicle.label, vehicle.plate, vehicle.location]
				.filter(Boolean)
				.some((field) => String(field).toLowerCase().includes(needle))
		);
	}, [vehicles, query]);

	const open = (vehicles ?? []).find((vehicle) => vehicle.id === openId) ?? null;

	useEffect(() => {
		if (expanded && openId === null && rows.length) setOpenId(rows[0].id);
	}, [expanded, openId, rows]);

	const track = (vehicle) => fetchNui('garage:track', { id: vehicle.id, plate: vehicle.plate }, { ok: true });

	const details = open ? (
		<Details vehicle={open} onBack={expanded ? undefined : () => setOpenId(null)} onTrack={track} />
	) : null;

	if (details && !expanded) return details;

	const list = (
		<AppShell title="Garage">
			{(vehicles?.length ?? 0) > 0 && (
				<>
					<div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.05] px-4 py-3">
						<input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search vehicles..."
							className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/35"
						/>
						<HugeiconsIcon icon={Search01Icon} size={18} strokeWidth={2} className="shrink-0 text-white/45" />
					</div>

					<h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
						In garage
					</h2>
				</>
			)}

			{vehicles === null ? (
				<div className="py-16 text-center text-[13px] text-white/30">Loading…</div>
			) : rows.length === 0 ? (
				<div className="flex h-full flex-col items-center justify-center gap-3 pb-10 text-center">
					<HugeiconsIcon icon={Car03Icon} size={34} strokeWidth={1.5} className="text-white/35" />
					<span className="text-[14px] font-medium text-white/45">
						{query ? 'No vehicles match that search' : "You don't have any vehicles"}
					</span>
				</div>
			) : (
				<AnimatePresence initial={false}>
					{rows.map((vehicle) => (
						<VehicleCard
							key={vehicle.id}
							vehicle={vehicle}
							selected={expanded && vehicle.id === openId}
							onDetails={(entry) => setOpenId(entry.id)}
							onTrack={track}
						/>
					))}
				</AnimatePresence>
			)}
		</AppShell>
	);

	if (!expanded) return list;

	return (
		<div className="flex h-full">
			<div className="w-[340px] shrink-0 border-r border-white/[0.07]">{list}</div>

			<div className="min-w-0 flex-1">
				{details ?? (
					<div className="flex h-full flex-col items-center justify-center gap-3 text-center">
						<HugeiconsIcon icon={Car03Icon} size={34} strokeWidth={1.4} className="text-white/30" />
						<span className="text-[14px] font-medium text-white/45">Pick a vehicle</span>
					</div>
				)}
			</div>
		</div>
	);
}
