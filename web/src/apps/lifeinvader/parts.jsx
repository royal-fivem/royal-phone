import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { UserIcon } from '@hugeicons/core-free-icons';

/** Round profile picture: the image, else the initial, else a person glyph. */
export function Face({ src, name, size = 'h-9 w-9', text = 'text-[13px]' }) {
	if (src) {
		return <img src={src} alt="" className={`${size} shrink-0 rounded-full object-cover`} />;
	}

	return (
		<div className={`grid ${size} shrink-0 place-items-center rounded-full bg-white/[0.09] text-white/70`}>
			{name ? (
				<span className={`${text} font-bold text-white`}>{name.charAt(0).toUpperCase()}</span>
			) : (
				<HugeiconsIcon icon={UserIcon} size={18} strokeWidth={1.8} />
			)}
		</div>
	);
}

/** Underlined tab strip used by the feed and the notifications screen. */
export function Tabs({ tabs, value, onChange, className = '' }) {
	return (
		<nav className={`flex shrink-0 items-center ${className}`}>
			{tabs.map((tab) => {
				const active = value === tab.id;

				return (
					<button
						key={tab.id}
						onClick={() => onChange(tab.id)}
						className={`relative flex-1 pb-2.5 pt-1 text-[13.5px] font-bold transition ${
							active ? 'text-white' : 'text-white/35 hover:text-white/60'
						}`}
					>
						{tab.label}
						{active && (
							<span className="absolute inset-x-2 bottom-0 h-[2.5px] rounded-full bg-sky-500" />
						)}
					</button>
				);
			})}
		</nav>
	);
}

export function Empty({ icon, label, hint }) {
	return (
		<div className="flex flex-col items-center justify-center gap-2.5 py-24 text-center">
			<HugeiconsIcon icon={icon} size={34} strokeWidth={1.4} className="text-white/30" />
			<span className="text-[14px] font-medium text-white/45">{label}</span>
			{hint && <span className="max-w-[220px] text-[12.5px] leading-snug text-white/25">{hint}</span>}
		</div>
	);
}

export function Field({ label, required, children }) {
	return (
		<label className="mb-4 block shrink-0">
			<span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">
				{label}
				{required && <span className="text-sky-400"> *</span>}
			</span>
			{children}
		</label>
	);
}

export const inputClass =
	'w-full rounded-xl border border-white/[0.09] bg-white/[0.04] px-3.5 py-3 text-[14px] font-bold text-white outline-none transition focus:border-sky-500/60 focus:bg-white/[0.07] placeholder:font-normal placeholder:text-white/25';
