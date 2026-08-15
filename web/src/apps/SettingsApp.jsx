import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import {
	Simcard01Icon,
	Notification03Icon,
	VolumeHighIcon,
	Image01Icon,
	Shield01Icon,
	ArrowRight01Icon,
	ArrowLeft01Icon,
	SmartPhone01Icon,
	AirplaneModeIcon,
	Moon02Icon,
	GridViewIcon,
	Link01Icon,
	Delete02Icon,
} from '@hugeicons/core-free-icons';

import { Toggle } from './_shared';
import usePhoneStore from '../state/phoneStore';
import useDataStore from '../state/dataStore';
import { SIZE_MIN, SIZE_MAX } from '../utils/usePhoneMetrics';
import { playSound } from '../utils/sound';

function MenuRow({ icon, label, onClick }) {
	return (
		<motion.button
			whileTap={{ scale: 0.985 }}
			onClick={onClick}
			className="mb-3 flex w-full items-center gap-4 rounded-2xl bg-white/[0.045] px-3 py-3 text-left transition hover:bg-white/[0.075]"
		>
			<span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.09] text-white">
				<HugeiconsIcon icon={icon} size={18} strokeWidth={1.9} />
			</span>

			<span className="flex-1 text-[15px] font-semibold text-white">{label}</span>

			<HugeiconsIcon icon={ArrowRight01Icon} size={17} strokeWidth={2.2} className="shrink-0 text-white/35" />
		</motion.button>
	);
}

function Card({ children, className = '' }) {
	return <div className={`mb-3 overflow-hidden rounded-2xl bg-white/[0.045] ${className}`}>{children}</div>;
}

function Line({ icon, title, subtitle, right, onClick }) {
	const Tag = onClick ? 'button' : 'div';

	return (
		<Tag
			onClick={onClick}
			className="flex w-full items-center gap-3 border-b border-white/[0.05] px-4 py-3 text-left last:border-0"
		>
			{icon && (
				<span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.09] text-white">
					<HugeiconsIcon icon={icon} size={17} strokeWidth={1.9} />
				</span>
			)}

			<span className="min-w-0 flex-1">
				<span className="block truncate text-[14.5px] font-medium text-white">{title}</span>
				{subtitle && <span className="block truncate text-[12.5px] text-white/40">{subtitle}</span>}
			</span>

			{right && <span className="shrink-0 text-[13px] text-white/45">{right}</span>}
		</Tag>
	);
}

function Label({ children }) {
	return (
		<h2 className="mb-2 mt-5 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/30 first:mt-0">
			{children}
		</h2>
	);
}

function SimCard() {
	const { name, number, job, sim, simOwner } = useDataStore();

	const borrowed = sim && simOwner && simOwner.trim() && simOwner.trim() !== (name || '').trim();

	return (
		<>
			<Card>
				<Line icon={Simcard01Icon} title="Number" right={number} />
				{sim && <Line title="Serial" right={sim} />}
				<Line title="Carrier" right="Badger" />
				<Line title="Network" right="LTE" />
			</Card>

			{sim && (
				<>
					<Label>Registered to</Label>
					<Card>
						<Line
							title={simOwner?.trim() || 'Unregistered'}
							subtitle={borrowed ? 'This is not your card' : null}
							right={borrowed ? 'Borrowed' : 'You'}
						/>
					</Card>
				</>
			)}

			<Label>Account</Label>
			<Card>
				<Line title="Name" right={name || 'Unknown'} />
				<Line title="Occupation" right={job || 'Unemployed'} />
			</Card>
		</>
	);
}

function Notifications() {
	const settings = usePhoneStore((s) => s.settings);
	const setSetting = usePhoneStore((s) => s.setSetting);

	return (
		<Card>
			<Line
				icon={Moon02Icon}
				title="Do not disturb"
				subtitle="Silence incoming notifications"
				right={<Toggle checked={settings.dnd} onChange={(v) => setSetting('dnd', v)} />}
			/>
			<Line
				icon={AirplaneModeIcon}
				title="Airplane mode"
				right={<Toggle checked={settings.airplane} onChange={(v) => setSetting('airplane', v)} />}
			/>
			<Line
				icon={Notification03Icon}
				title="Hide previews"
				subtitle="Show the sender only"
				right={<Toggle checked={settings.hidePreviews} onChange={(v) => setSetting('hidePreviews', v)} />}
			/>
		</Card>
	);
}

function Sounds() {
	const settings = usePhoneStore((s) => s.settings);
	const setSetting = usePhoneStore((s) => s.setSetting);

	return (
		<Card>
			<Line
				icon={VolumeHighIcon}
				title="Notification sounds"
				right={<Toggle checked={settings.sounds} onChange={(v) => setSetting('sounds', v)} />}
			/>

			<div className="px-4 py-3.5">
				<div className="mb-2 flex items-center justify-between">
					<span className="text-[14.5px] font-medium text-white">Volume</span>
					<span className="text-[13px] tabular-nums text-white/45">{settings.volume}%</span>
				</div>

				<input
					type="range"
					min={0}
					max={100}
					value={settings.volume}
					onChange={(e) => setSetting('volume', Number(e.target.value))}

					onPointerUp={() => playSound('newnotification', { force: true })}
					onKeyUp={() => playSound('newnotification', { force: true })}
					className="royal-range w-full"
				/>

				<button
					onClick={() => playSound('newnotification', { force: true })}
					className="mt-3 w-full rounded-xl bg-white/[0.08] py-2 text-[13px] font-medium text-white/70 transition hover:bg-white/[0.14] hover:text-white"
				>
					Play test sound
				</button>
			</div>
		</Card>
	);
}

const PRESETS = [
	{ label: 'Default', value: SIZE_MIN },
	{ label: 'Medium', value: Math.round((SIZE_MIN + SIZE_MAX) / 2) },
	{ label: 'Large', value: SIZE_MAX },
];

function WallpaperAndZoom() {
	const settings = usePhoneStore((s) => s.settings);
	const setSetting = usePhoneStore((s) => s.setSetting);

	const [draft, setDraft] = useState(settings.wallpaper);
	const applyTimer = useRef(null);

	const apply = (event) => {
		event?.preventDefault();
		clearTimeout(applyTimer.current);
		setSetting('wallpaper', draft.trim());
	};

	const change = (value) => {
		setDraft(value);

		clearTimeout(applyTimer.current);
		applyTimer.current = setTimeout(() => setSetting('wallpaper', value.trim()), 500);
	};

	useEffect(() => () => clearTimeout(applyTimer.current), []);

	return (
		<>
			<Label>Wallpaper</Label>
			<Card>
				<div className="px-4 py-4">
					<form onSubmit={apply} className="flex items-center gap-2">
						<span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.09] text-white">
							<HugeiconsIcon icon={Link01Icon} size={16} strokeWidth={2} />
						</span>

						<input
							value={draft}
							onChange={(e) => change(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') apply(e);
							}}
							placeholder="https://…/image.png"
							spellCheck={false}
							className="min-w-0 flex-1 rounded-xl bg-white/[0.07] px-3 py-2 text-[13.5px] text-white outline-none placeholder:text-white/25 focus:bg-white/[0.11]"
						/>

						<button
							type="submit"
							className="shrink-0 rounded-xl bg-white px-3 py-2 text-[13px] font-semibold text-black"
						>
							Set
						</button>
					</form>

					<p className="mt-2 px-1 text-[12px] leading-snug text-white/35">
						Paste a direct image link. It has to end in an image file, not a page it sits on.
					</p>

					<div className="mt-3 flex items-center gap-3">
						<div
							className="h-16 w-11 shrink-0 rounded-lg border border-white/10 bg-black bg-cover bg-center"
							style={
								settings.wallpaper
									? { backgroundImage: `url(${JSON.stringify(settings.wallpaper)})` }
									: undefined
							}
						/>
						<div className="min-w-0 flex-1">
							<div className="truncate text-[13px] text-white/60">
								{settings.wallpaper || 'No wallpaper set'}
							</div>
						</div>

						{settings.wallpaper && (
							<button
								onClick={() => {
									setDraft('');
									setSetting('wallpaper', '');
								}}
								className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-500/15 text-rose-400"
							>
								<HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
							</button>
						)}
					</div>
				</div>
			</Card>

			<Label>Zoom</Label>
			<Card>
				<div className="px-4 py-4">
					<div className="mb-3 flex items-center justify-between">
						<span className="text-[14.5px] font-medium text-white">Phone size</span>
						<span className="text-[13px] tabular-nums text-white/45">{settings.size}%</span>
					</div>

					<div className="grid grid-cols-3 gap-2">
						{PRESETS.map((preset) => (
							<motion.button
								key={preset.value}
								whileTap={{ scale: 0.95 }}
								onClick={() => setSetting('size', preset.value)}
								className={`rounded-xl py-2 text-[13px] font-medium transition ${
									settings.size === preset.value
										? 'bg-white text-black'
										: 'bg-white/[0.08] text-white/70 hover:bg-white/[0.14]'
								}`}
							>
								{preset.label}
							</motion.button>
						))}
					</div>
				</div>
			</Card>
		</>
	);
}

function Privacy() {
	const resetLayout = usePhoneStore((s) => s.resetLayout);

	return (
		<>
			<Card>
				<Line icon={Shield01Icon} title="Phone lock" right="Off" />
				<Line title="App permissions" right="All" />
			</Card>

			<Label>Home screen</Label>
			<Card>
				<Line
					icon={GridViewIcon}
					title="Reset layout"
					subtitle="Put every app back in its default slot"
					onClick={resetLayout}
				/>
			</Card>

			<Label>About</Label>
			<Card>
				<Line icon={SmartPhone01Icon} title="Royal Phone" right="1.0.0" />
			</Card>
		</>
	);
}

const PANES = [
	{ id: 'sim', label: 'SIM Card', icon: Simcard01Icon, Component: SimCard },
	{ id: 'notifications', label: 'Notifications', icon: Notification03Icon, Component: Notifications },
	{ id: 'sounds', label: 'Sounds', icon: VolumeHighIcon, Component: Sounds },
	{ id: 'wallpaper', label: 'Wallpaper & Zoom', icon: Image01Icon, Component: WallpaperAndZoom },
	{ id: 'privacy', label: 'Privacy', icon: Shield01Icon, Component: Privacy },
];

export default function SettingsApp() {
	const [open, setOpen] = useState(null);
	const pane = PANES.find((item) => item.id === open);

	return (
		<div
			className="flex h-full w-full flex-col"
			style={{ paddingTop: 'var(--status-h)', paddingBottom: 'var(--chrome-b)' }}
		>
			<header className="flex shrink-0 items-center gap-3 px-5 pb-4 pt-1">
				{pane && (
					<button
						onClick={() => setOpen(null)}
						className="-ml-2 grid h-9 w-9 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
					>
						<HugeiconsIcon icon={ArrowLeft01Icon} size={22} strokeWidth={2} />
					</button>
				)}

				<h1 className="truncate text-[26px] font-bold leading-tight tracking-tight text-white">
					{pane ? pane.label : 'Settings'}
				</h1>
			</header>

			<div className="royal-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-4">
				{pane ? (
					<pane.Component />
				) : (
					PANES.map((item) => (
						<MenuRow key={item.id} icon={item.icon} label={item.label} onClick={() => setOpen(item.id)} />
					))
				)}
			</div>
		</div>
	);
}
