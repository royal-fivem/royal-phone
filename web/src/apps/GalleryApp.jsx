import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import {
	Album02Icon,
	Cancel01Icon,
	Delete02Icon,
	Message01Icon,
	Camera01Icon,
	Image01Icon,
	ArrowLeft01Icon,
	ArrowRight01Icon,
} from '@hugeicons/core-free-icons';

import { AppShell, EmptyState } from './_shared';
import useDataStore from '../state/dataStore';
import usePhoneStore from '../state/phoneStore';
import { formatDayDivider, formatTime } from '../utils/format';

/** Long-form stamp for the viewer: "Monday 14 July 2026 · 21:04". */
const fullStamp = (at) => {
	if (!at) return '';

	const date = new Date(at).toLocaleDateString(undefined, {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	});

	return `${date} · ${formatTime(at)}`;
};

function Viewer({ photos, index, onClose, onDelete, onSend, onStep }) {
	const photo = photos[index]; 

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			className="absolute inset-0 z-20 flex flex-col bg-[#08090c]"
			style={{ paddingTop: 'var(--status-h)', paddingBottom: 'var(--chrome-b)' }}
		>
			<header className="flex shrink-0 items-center justify-between px-4 py-2">
				<button onClick={onClose} className="text-white/70 transition hover:text-white">
					<HugeiconsIcon icon={Cancel01Icon} size={20} strokeWidth={2} />
				</button>

				<div className="min-w-0 px-3 text-center">
					<div className="truncate text-[12.5px] font-bold text-white">
						{formatDayDivider(photo.takenAt).replace(/^./, (c) => c + '')}
					</div>
					<div className="truncate text-[11px] text-white/35">{formatTime(photo.takenAt)}</div>
				</div>

				<button onClick={onDelete} className="text-rose-400 transition hover:text-rose-300">
					<HugeiconsIcon icon={Delete02Icon} size={19} strokeWidth={2} />
				</button>
			</header>

			<div className="relative flex min-h-0 flex-1 items-center justify-center px-3">
				{photo.url ? (
					<img src={photo.url} alt="" className="max-h-full max-w-full rounded-2xl object-contain" />
				) : (
					<div className="grid h-40 w-40 place-items-center rounded-2xl bg-white/[0.06] text-white/30">
						<HugeiconsIcon icon={Image01Icon} size={32} strokeWidth={1.4} />
					</div>
				)}

				{index > 0 && (
					<button
						onClick={() => onStep(index - 1)}
						className="absolute left-1 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white/70 transition hover:text-white"
					>
						<HugeiconsIcon icon={ArrowLeft01Icon} size={18} strokeWidth={2} />
					</button>
				)}

				{index < photos.length - 1 && (
					<button
						onClick={() => onStep(index + 1)}
						className="absolute right-1 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white/70 transition hover:text-white"
					>
						<HugeiconsIcon icon={ArrowRight01Icon} size={18} strokeWidth={2} />
					</button>
				)}
			</div>

			<div className="shrink-0 px-4 pb-2 pt-3">
				<p className="mb-2.5 text-center text-[12px] text-white/40">{fullStamp(photo.takenAt)}</p>

				<button
					onClick={onSend}
					className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.09] py-2.5 text-[14px] font-bold text-white transition hover:bg-white/[0.14]"
				>
					<HugeiconsIcon icon={Message01Icon} size={16} strokeWidth={2} /> Send in a message
				</button>
			</div>
		</motion.div>
	);
}

export default function GalleryApp() {
	const photos = useDataStore((s) => s.photos);
	const removePhoto = useDataStore((s) => s.removePhoto);
	const expanded = usePhoneStore((s) => s.expanded);
	const openApp = usePhoneStore((s) => s.openApp);

	const [open, setOpen] = useState(null);

	/** Newest first, split into day sections so the shelf reads as a timeline. */
	const sections = useMemo(() => {
		const indexed = photos.map((photo, index) => ({ ...photo, index }));
		indexed.sort((a, b) => (b.takenAt ?? 0) - (a.takenAt ?? 0));

		const out = [];

		for (const photo of indexed) {
			const label = formatDayDivider(photo.takenAt);
			const last = out[out.length - 1];

			if (last && last.label === label) last.items.push(photo);
			else out.push({ label, items: [photo] });
		}

		return out;
	}, [photos]);

	return (
		<div className="relative h-full">
			<AppShell
				title="Gallery"
				subtitle={`${photos.length} photo${photos.length === 1 ? '' : 's'}`}
				action={
					<button
						onClick={() => openApp('camera')}
						className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white"
					>
						<HugeiconsIcon icon={Camera01Icon} size={18} strokeWidth={2} />
					</button>
				}
			>
				{photos.length === 0 ? (
					<EmptyState icon={Album02Icon} title="No photos" hint="Shots from the Camera app land here." />
				) : (
					sections.map((section) => (
						<div key={section.label} className="mb-4">
							<h2 className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/35">
								{section.label}
							</h2>

							<div className={`grid gap-1.5 ${expanded ? 'grid-cols-6' : 'grid-cols-3'}`}>
								{section.items.map((item) => (
									<button
										key={`${item.takenAt}-${item.index}`}
										onClick={() => setOpen(item.index)}
										className="group relative aspect-square overflow-hidden rounded-xl bg-white/[0.06]"
									>
										{item.url ? (
											<img
												src={item.url}
												alt=""
												className="h-full w-full object-cover transition group-hover:scale-[1.04]"
												loading="lazy"
											/>
										) : (
											<span className="grid h-full place-items-center text-white/25">
												<HugeiconsIcon icon={Image01Icon} size={20} strokeWidth={1.4} />
											</span>
										)}

										<span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-1 pt-4 text-left text-[9.5px] tabular-nums text-white/70">
											{formatTime(item.takenAt)}
										</span>
									</button>
								))}
							</div>
						</div>
					))
				)}
			</AppShell>

			<AnimatePresence>
				{open !== null && photos[open] && (
					<Viewer
						photos={photos}
						index={open}
						onStep={setOpen}
						onClose={() => setOpen(null)}
						onDelete={() => {
							removePhoto(open);
							setOpen(null);
						}}
						onSend={() => openApp('messages', { attach: photos[open].url })}
					/>
				)}
			</AnimatePresence>
		</div>
	);
}
