import React from 'react';
import { motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, UserIcon } from '@hugeicons/core-free-icons';
import useDataStore from '../state/dataStore';

const PHOTO_REF = /^photo:(\d+)$/;

/** A gallery pick is stored as `photo:<id>` so the image itself lives only in the gallery. */
export const photoRef = (id) => `photo:${id}`;
export const isPhotoRef = (value) => typeof value === 'string' && PHOTO_REF.test(value);

/**
 * Turns a stored avatar into something an <img> can use: a `photo:<id>` reference
 * resolves against the gallery, anything else is passed through untouched.
 */
export function usePhotoSrc(avatar) {
	const id = typeof avatar === 'string' ? avatar.match(PHOTO_REF)?.[1] : null;
	const photo = useDataStore((s) => (id ? s.photos.find((p) => String(p.id) === id) : null));

	if (!id) return avatar || null;

	return photo?.url ?? null;
}

export function Avatar({ name, avatar, size = 'h-11 w-11' }) {
	const src = usePhotoSrc(avatar);

	if (src) {
		return <img src={src} alt="" className={`${size} shrink-0 rounded-full object-cover`} />;
	}

	return (
		<div className={`grid ${size} shrink-0 place-items-center rounded-full bg-white/[0.09] text-white/70`}>
			{name ? (
				<span className="text-[15px] font-bold text-white">{name.charAt(0).toUpperCase()}</span>
			) : (
				<HugeiconsIcon icon={UserIcon} size={20} strokeWidth={1.8} />
			)}
		</div>
	);
}

export function AppShell({ title, subtitle, onBack, action, children, className = '' }) {
	return (
		<div
			className="flex h-full w-full flex-col"
			style={{ paddingTop: 'var(--status-h)', paddingBottom: 'var(--chrome-b)' }}
		>
			<header className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-1">
				{onBack && (
					<button
						onClick={onBack}
						className="-ml-2 grid h-9 w-9 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
					>
						<HugeiconsIcon icon={ArrowLeft01Icon} size={22} strokeWidth={2} />
					</button>
				)}

				<div className="min-w-0 flex-1">
					<h1 className="truncate text-[26px] font-bold leading-tight tracking-tight text-white">{title}</h1>
					{subtitle && <p className="truncate text-[13px] text-white/45">{subtitle}</p>}
				</div>

				{action}
			</header>

			<div className={`royal-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-4 ${className}`}>{children}</div>
		</div>
	);
}

export function Section({ title, children, className = '' }) {
	return (
		<section className={`mb-5 ${className}`}>
			{title && (
				<h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
					{title}
				</h2>
			)}
			<div className="overflow-hidden rounded-2xl bg-white/[0.06] backdrop-blur-xl">{children}</div>
		</section>
	);
}

export function Row({ icon, iconClass = 'bg-white/10', title, subtitle, right, onClick, className = '' }) {
	const Tag = onClick ? motion.button : 'div';

	return (
		<Tag
			{...(onClick ? { onClick, whileTap: { scale: 0.985 } } : {})}
			className={`flex w-full items-center gap-3 border-b border-white/[0.06] px-4 py-3 text-left last:border-0 ${
				onClick ? 'transition hover:bg-white/[0.04]' : ''
			} ${className}`}
		>
			{icon && (
				<div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white ${iconClass}`}>
					{icon}
				</div>
			)}

			<div className="min-w-0 flex-1">
				<div className="truncate text-[15px] font-medium text-white">{title}</div>
				{subtitle && <div className="truncate text-[13px] text-white/45">{subtitle}</div>}
			</div>

			{right && <div className="shrink-0 text-[13px] text-white/45">{right}</div>}
		</Tag>
	);
}

export function EmptyState({ icon, title, hint }) {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
			{icon && (
				<div className="grid h-16 w-16 place-items-center rounded-3xl bg-white/[0.06] text-white/30">
					<HugeiconsIcon icon={icon} size={30} strokeWidth={1.5} />
				</div>
			)}
			<div className="text-[15px] font-semibold text-white/70">{title}</div>
			{hint && <div className="max-w-[220px] text-[13px] leading-snug text-white/35">{hint}</div>}
		</div>
	);
}

export function Toggle({ checked, onChange }) {
	return (
		<button
			onClick={() => onChange(!checked)}
			className={`relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors ${
				checked ? 'bg-emerald-500' : 'bg-white/15'
			}`}
		>

			<motion.span
				initial={false}
				animate={{ x: checked ? 20 : 0 }}
				transition={{ type: 'spring', stiffness: 700, damping: 36 }}
				className="absolute left-[3px] top-[3px] h-5 w-5 rounded-full bg-white shadow"
			/>
		</button>
	);
}
