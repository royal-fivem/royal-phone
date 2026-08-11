import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { CameraRotated01Icon, Album02Icon } from '@hugeicons/core-free-icons';

import useCameraStore from '../state/cameraStore';
import useDataStore from '../state/dataStore';
import usePhoneStore from '../state/phoneStore';
import { playSound } from '../utils/sound';

/**
 * Camera.
 *
 * The screen is a hole punched through the phone: PhoneShell drops the wallpaper
 * and the black backing while this is open, so what you see through the phone is
 * the game behind it — the player holds the phone up and frames the shot through
 * it, exactly like a real one.
 *
 * Everything drawn here is the furniture around that hole, in the phone's own
 * language rather than a camera app pasted on top of it.
 *
 * Controls are mouse-first, because that is what the player's hand is already on:
 *
 *   scroll        zoom
 *   middle click  flip between rear and selfie
 *   right click   shutter
 *
 * They are bound on the window rather than on the buttons, so the whole screen is
 * the control surface and there is nothing to aim at. The buttons duplicate them.
 */
export default function CameraApp() {
	const open = useCameraStore((s) => s.open);
	const close = useCameraStore((s) => s.close);

	const front = useCameraStore((s) => s.front);
	const zoom = useCameraStore((s) => s.zoom);
	const flash = useCameraStore((s) => s.flash);
	const hud = useCameraStore((s) => s.hud);
	const last = useCameraStore((s) => s.last);

	const flip = useCameraStore((s) => s.flip);
	const zoomBy = useCameraStore((s) => s.zoomBy);
	const capture = useCameraStore((s) => s.capture);

	const addPhoto = useDataStore((s) => s.addPhoto);
	const openApp = usePhoneStore((s) => s.openApp);

	// The scripted camera lives for exactly as long as this screen does.
	useEffect(() => {
		open();
		return () => close();
	}, []);

	const shoot = async () => {
		const url = await capture();
		if (!url) return;

		playSound('newmessagesent_inapp');
		addPhoto(url);
	};

	useEffect(() => {
		const onWheel = (event) => {
			event.preventDefault();
			// deltaY is negative scrolling up, which should zoom in.
			zoomBy(event.deltaY < 0 ? 1 : -1);
		};

		const onMouseDown = (event) => {
			// 1 = middle, 2 = right. Swallowed so the browser's own autoscroll and
			// context menu never appear over the viewfinder.
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
			{/* Shutter flash. Stays out of the `hud` block: it fires after the
			    capture, not during it. */}
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

			{/* Everything below is chrome, so it all goes for the frame Lua
			    captures — otherwise the brackets and buttons end up in the photo. */}
			<div className={`flex min-h-0 flex-1 flex-col ${hud ? '' : 'invisible'}`}>
				<header className="flex shrink-0 items-center justify-between px-5 pb-2 pt-1">
					<span className="rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70 backdrop-blur-xl">
						{front ? 'Selfie' : 'Rear'}
					</span>

					<span className="rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-white/70 backdrop-blur-xl">
						{(1 + zoom * 3).toFixed(1)}×
					</span>
				</header>

				{/* The viewfinder itself is empty on purpose — the game shows through
				    it. Only the framing marks are drawn. */}
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

					{/* Zoom rail, so the level reads without a number. */}
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
					</p>

					<div className="flex items-center justify-between">
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
