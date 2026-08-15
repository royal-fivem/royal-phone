import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { UserIcon, Cancel01Icon } from '@hugeicons/core-free-icons';

import { Field, inputClass } from './parts';
import useDataStore from '../../state/dataStore';
import useLifeinvaderStore from '../../state/lifeinvaderStore';

export default function Onboarding() {
	const createAccount = useLifeinvaderStore((s) => s.createAccount);
	const photos = useDataStore((s) => s.photos);
	const playerName = useDataStore((s) => s.name);

	const [handle, setHandle] = useState(
		(playerName || '').toLowerCase().trim().replace(/\s+/g, '_')
	);
	const [name, setName] = useState(playerName || '');
	const [avatar, setAvatar] = useState(null);
	const [bio, setBio] = useState('');
	const [picking, setPicking] = useState(false);
	const [busy, setBusy] = useState(false);

	const valid = handle.trim() && name.trim();

	const submit = async (event) => {
		event.preventDefault();
		if (!valid || busy) return;

		setBusy(true);
		await createAccount({ handle, name, avatar, bio });
		setBusy(false);
	};

	return (
		<form
			onSubmit={submit}
			className="royal-scroll flex h-full flex-col overflow-y-auto px-5"
			style={{ paddingTop: 'var(--status-h)', paddingBottom: 'var(--chrome-b)' }}
		>
			<header className="shrink-0 py-5 text-center">
				<h1 className="text-[20px] font-bold tracking-tight text-white">Welcome to Lifeinvader</h1>
				<p className="mt-1 text-[13px] text-white/45">Create an account to get started</p>
			</header>

			<Field label="Handle">
				<div className="relative">
					<span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] font-bold text-white/30">
						@
					</span>
					<input
						value={handle}
						onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
						placeholder="handle"
						maxLength={20}
						className={`${inputClass} pl-7`}
					/>
				</div>
			</Field>

			<Field label="Display name" required>
				<input
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Your name"
					maxLength={32}
					className={inputClass}
				/>
			</Field>

			<Field label="Profile picture">
				<button
					type="button"
					onClick={() => setPicking((v) => !v)}
					className="grid h-[150px] w-full shrink-0 place-items-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/[0.02] transition hover:border-white/30 hover:bg-white/[0.04]"
				>
					{avatar ? (
						<img src={avatar} alt="" className="h-[150px] w-full rounded-2xl object-cover" />
					) : (
						<span className="flex flex-col items-center gap-2 text-white/30">
							<HugeiconsIcon icon={UserIcon} size={30} strokeWidth={1.3} />
							<span className="text-[13px]">Select from gallery</span>
						</span>
					)}
				</button>

				{picking && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: 'auto', opacity: 1 }}
						className="mt-2 overflow-hidden rounded-xl bg-black/30 p-2"
					>
						{photos.length === 0 ? (
							<p className="px-2 py-3 text-[12.5px] text-white/35">
								No photos yet — take one with the Camera app.
							</p>
						) : (
							<div className="royal-scroll flex gap-2 overflow-x-auto">
								{photos.map((photo, index) => (
									<button
										key={`${photo.takenAt}-${index}`}
										type="button"
										onClick={() => {
											setAvatar(photo.url ?? null);
											setPicking(false);
										}}
										className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/[0.06]"
									>
										{photo.url && <img src={photo.url} alt="" className="h-full w-full object-cover" />}
									</button>
								))}
							</div>
						)}

						{avatar && (
							<button
								type="button"
								onClick={() => setAvatar(null)}
								className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-rose-500/15 py-1.5 text-[12px] font-medium text-rose-400"
							>
								<HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={2.2} /> Remove
							</button>
						)}
					</motion.div>
				)}
			</Field>

			<Field label="Bio">
				<textarea
					value={bio}
					onChange={(e) => setBio(e.target.value)}
					placeholder="Tell us about yourself"
					rows={3}
					maxLength={160}
					className={`${inputClass} resize-none font-normal`}
				/>
			</Field>

			<motion.button
				type="submit"
				whileTap={{ scale: 0.98 }}
				disabled={!valid || busy}
				className="mb-4 mt-1 shrink-0 rounded-xl bg-sky-500 py-3 text-[14.5px] font-bold text-white transition disabled:opacity-30"
			>
				{busy ? 'Creating…' : 'Create account'}
			</motion.button>
		</form>
	);
}
