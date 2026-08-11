import React, { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AnimatePresence, motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import {
	CameraRotated01Icon,
	Album02Icon,
	FlashIcon,
	FlashOffIcon,
	Cursor01Icon,
} from '@hugeicons/core-free-icons';

import useCameraStore from '../state/cameraStore';
import useDataStore from '../state/dataStore';
import usePhoneStore from '../state/phoneStore';
import useNuiEvent from '../utils/useNuiEvent';
import GameView from '../components/GameView';
import { playSound } from '../utils/sound';

export default function CameraApp() {
	const { front, zoom, flash, flashOn, cursor, hud, last } = useCameraStore(
		useShallow(({ front, zoom, flash, flashOn, cursor, hud, last }) => ({
			front, zoom, flash, flashOn, cursor, hud, last,
		})),
	);

	const { open, close, flip, zoomBy, capture, toggleFlash, toggleCursor } = useCameraStore.getState();
	const { addPhoto } = useDataStore.getState();
	const { openApp } = usePhoneStore.getState();

	useEffect(() => {
		open();
		return () => close();
	}, []);

	const shoot = async () => {
		const photo = await capture();
		if (!photo) return;

		playSound('newmessagesent_inapp');
		addPhoto(photo);
	};

	useNuiEvent('cameraShoot', () => shoot());

	useEffect(() => {
		const onKeyDown = (event) => {
			if (event.key !== 'Alt') return;

			event.preventDefault();
			toggleCursor();
		};

		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [toggleCursor]);

	useEffect(() => {
		const onWheel = (event) => {
			event.preventDefault();
			zoomBy(event.deltaY < 0 ? 1 : -1);
		};

		const onMouseDown = (event) => {
			if (event.button === 1) {
				event.preventDefault();
				flip();
			} else if (event.button === 2) {
				event.preventDefault();
				shoot();
			}
		};

		const block = (event) => event.preventDefault();

		window.addEventListener('wheel', onWheel, { passive: false });
		window.addEventListener('mousedown', onMouseDown);
		window.addEventListener('contextmenu', block);

		return () => {
			window.removeEventListener('wheel', onWheel);
			window.removeEventListener('mousedown', onMouseDown);
			window.removeEventListener('contextmenu', block);
		};
	}, [flip, zoomBy]);

	return (
		<div
			className="relative flex h-full w-full flex-col"
			style={{ paddingTop: 'var(--status-h)', paddingBottom: 'var(--chrome-b)' }}
		>
			<GameView visible={hud} />

			<AnimatePresence>
				{flash && (
					<motion.div
						initial={{ opacity: 0.9 }}
						animate={{ opacity: 0 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.18 }}
						className="pointer-events-none absolute inset-0 z-20 bg-white"
					/>
				)}
			</AnimatePresence>

			<div className={`relative z-10 flex min-h-0 flex-1 flex-col ${hud ? '' : 'invisible'}`}>
				<header className="flex shrink-0 items-center justify-between px-5 pb-2 pt-1">
					<div className="flex items-center gap-1.5">
						<span className="rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70 backdrop-blur-xl">
							{front ? 'Selfie' : 'Rear'}
						</span>

						<button
							onClick={toggleFlash}
							className={`grid h-[26px] w-[26px] place-items-center rounded-full border backdrop-blur-xl transition ${
								flashOn
									? 'border-amber-300/60 bg-amber-300/20 text-amber-200'
									: 'border-white/15 bg-black/45 text-white/50 hover:text-white'
							}`}
						>
							<HugeiconsIcon icon={flashOn ? FlashIcon : FlashOffIcon} size={13} strokeWidth={2} />
						</button>
					</div>

					<span className="rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-white/70 backdrop-blur-xl">
						{(1 + zoom * 3).toFixed(1)}×
					</span>
				</header>

				<div className="relative min-h-0 flex-1">
					<div className="pointer-events-none absolute inset-4">
						{[
							'left-0 top-0 border-l-2 border-t-2 rounded-tl-lg',
							'right-0 top-0 border-r-2 border-t-2 rounded-tr-lg',
							'left-0 bottom-0 border-b-2 border-l-2 rounded-bl-lg',
							'right-0 bottom-0 border-b-2 border-r-2 rounded-br-lg',
						].map((corner) => (
							<span key={corner} className={`absolute h-6 w-6 border-white/50 ${corner}`} />
						))}
					</div>

					<div className="pointer-events-none absolute right-6 top-1/2 h-24 w-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-white/20">
						<motion.div
							className="absolute inset-x-0 bottom-0 rounded-full bg-sky-400"
							animate={{ height: `${zoom * 100}%` }}
							transition={{ type: 'spring', stiffness: 320, damping: 34 }}
						/>
					</div>
				</div>

				<div className="shrink-0 px-5 pb-2">
					<p className="mb-2.5 text-center text-[10.5px] leading-relaxed text-white/45">
						Scroll to zoom · Middle click to flip · Right click to shoot
						<br />
						<span className="text-white/60">
							<kbd className="rounded border border-white/25 px-1 text-[9px] font-semibold">ALT</kbd>{' '}
							{cursor ? 'to aim the camera' : 'to use the buttons'}
						</span>
					</p>

					<div
						className={`mb-2 flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
							cursor ? 'text-sky-300' : 'text-white/35'
						}`}
					>
						<HugeiconsIcon icon={Cursor01Icon} size={12} strokeWidth={2} />
						{cursor ? 'Cursor' : 'Camera'}
					</div>

					<div className={`flex items-center justify-between ${cursor ? '' : 'opacity-45'}`}>
						<button
							onClick={() => openApp('gallery')}
							className="grid h-11 w-11 place-items-center overflow-hidden rounded-2xl border border-white/15 bg-black/45 text-white/70 backdrop-blur-xl transition hover:text-white"
						>
							{last ? (
								<img src={last} alt="" className="h-full w-full object-cover" />
							) : (
								<HugeiconsIcon icon={Album02Icon} size={18} strokeWidth={1.9} />
							)}
						</button>

						<motion.button
							whileTap={{ scale: 0.9 }}
							onClick={shoot}
							className="grid h-[62px] w-[62px] place-items-center rounded-full border-[3px] border-white/80 transition hover:border-white"
						>
							<span className="h-[48px] w-[48px] rounded-full bg-white shadow-[0_0_20px_-4px_rgba(255,255,255,0.7)]" />
						</motion.button>

						<button
							onClick={flip}
							className="grid h-11 w-11 place-items-center rounded-2xl border border-white/15 bg-black/45 text-white/70 backdrop-blur-xl transition hover:text-white"
						>
							<HugeiconsIcon icon={CameraRotated01Icon} size={18} strokeWidth={1.9} />
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
