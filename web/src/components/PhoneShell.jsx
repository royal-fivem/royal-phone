import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';

import StatusBar from './StatusBar';
import BottomBar from './BottomBar';
import HomeScreen from './HomeScreen';
import AppHost from './AppHost';
import CallOverlay from './CallOverlay';
import NotificationStack from './NotificationStack';
import NotificationCentre from './NotificationCentre';
import CallCard from './CallCard';

import usePhoneStore from '../state/phoneStore';
import useNotifyStore from '../state/notifyStore';
import useCameraStore from '../state/cameraStore';
import usePhoneMetrics, { cssVars } from '../utils/usePhoneMetrics';
import fetchNui from '../utils/fetchNui';

/** One spring drives the fold so width and position never drift apart. */
const FOLD = { type: 'spring', stiffness: 220, damping: 30, mass: 0.85 };
const ENTER = { type: 'spring', stiffness: 320, damping: 32, mass: 0.8 };

/**
 * Longest the phone will stay peeked, in ms.
 *
 * Deliberately much shorter than the toast's own lifetime: the banner is
 * readable in a glance, and a phone that pops up mid-drive should get out of the
 * way quickly. The toast itself carries on in the tray. This is also the cap
 * that stops a `duration: 0` notification pinning the phone on screen — it has
 * no NUI focus while pocketed, so there would be no way to dismiss it.
 *
 * Set from Config.PeekDuration by the bootstrap.
 */
const DEFAULT_PEEK_MS = 1500;

export default function PhoneShell() {
	const open = usePhoneStore((s) => s.open);
	const expanded = usePhoneStore((s) => s.expanded);
	const notificationCentre = usePhoneStore((s) => s.notificationCentre);

	const size = usePhoneStore((s) => s.settings.size);
	const wallpaper = usePhoneStore((s) => s.settings.wallpaper);
	const hasToast = useNotifyStore((s) => s.visible.length > 0);
	const latestToast = useNotifyStore((s) => s.visible[s.visible.length - 1]?.id ?? null);
	const inCall = usePhoneStore((s) => s.call !== null);
	const callExpanded = usePhoneStore((s) => s.call?.expanded === true);
	const openFromCallMode = usePhoneStore((s) => s.openFromCallMode);

	const [peekLatch, setPeekLatch] = useState(false);
	const peekMs = usePhoneStore((s) => s.settings.peekDuration) ?? DEFAULT_PEEK_MS;
	const cameraActive = useCameraStore((s) => s.active);

	const metrics = usePhoneMetrics(size / 100);
	const screenRef = useRef(null);
	const hinge = useAnimationControls();
	const first = useRef(true);

	// A short rotation on either side of the fold sells the hinge without
	// leaving the element rotated once the spring settles.
	useEffect(() => {
		if (first.current) {
			first.current = false;
			return;
		}

		hinge.start({
			rotateY: [0, expanded ? -8 : 7, 0],
			transition: { duration: 0.55, times: [0, 0.4, 1], ease: [0.22, 1, 0.36, 1] },
		});
	}, [expanded, hinge]);

	// Each new toast restarts the peek window; it ends when the toast expires or
	// the peek duration elapses, whichever comes first.
	useEffect(() => {
		if (open || latestToast === null) return;

		setPeekLatch(true);
		const timer = setTimeout(() => setPeekLatch(false), peekMs);

		return () => clearTimeout(timer);
	}, [latestToast, open, peekMs]);

	// Three resting heights when the phone is pocketed:
	//   peek      — a notification arrived, or the call card is showing
	//   call mode — a call is running; only the status bar and top row show
	//   nothing   — pocketed for real
	const notificationPeek = hasToast && peekLatch;
	const cardOpen = inCall && callExpanded;
	const peeking = !open && (cardOpen || notificationPeek);
	const callMode = !open && inCall && !peeking;

	const onScreen = open || peeking || callMode;

	const unfolded = open && expanded;
	const width = unfolded ? metrics.expandedWidth : metrics.width;
	const x = unfolded ? metrics.expandedX : metrics.collapsedX;
	const y = open ? metrics.top : callMode ? metrics.callTop : metrics.peekTop;

	// Call mode and the call card are interactive; a plain notification peek is
	// not, since the phone has no focus for it.
	const interactive = open || inCall;

	// Let Lua know when the pocketed phone needs to accept clicks.
	useEffect(() => {
		fetchNui('callMode', { active: (callMode || cardOpen) && !open });
	}, [callMode, cardOpen, open]);

	return (
		<div className="pointer-events-none fixed inset-0 z-40" style={{ perspective: 2400 }}>
			<AnimatePresence>
				{onScreen && (
					<motion.div
						key="phone"
						className={`absolute left-0 top-0 will-change-transform ${
							interactive ? 'pointer-events-auto' : 'pointer-events-none'
						}`}
						// In call mode the whole body is a target: tapping it brings the
						// phone back up without disturbing the call.
						onClick={callMode ? openFromCallMode : undefined}
						style={{ transformStyle: 'preserve-3d', ...cssVars(metrics.width) }}
						// Position rides on transforms so folding, resizing and peeking
						// stay on the compositor; only width/height touch layout.
						// It slides in from below the viewport and leaves the same way,
						// so opening reads as the same gesture as a peek going further.
						initial={{ opacity: 0, x, y: metrics.offscreenTop, width, height: metrics.height }}
						animate={{ opacity: 1, x, y, width, height: metrics.height }}
						exit={{ opacity: 0, y: metrics.offscreenTop, transition: { duration: 0.24, ease: [0.4, 0, 1, 1] } }}
						transition={{ x: FOLD, y: FOLD, width: FOLD, height: FOLD, default: ENTER }}
					>
						<motion.div
							animate={hinge}
							style={{
								transformStyle: 'preserve-3d',
								borderRadius: '0px',
							}}
							className="relative h-full w-full bg-gradient-to-b from-neutral-400/70 via-neutral-700/90 to-neutral-500/70 p-[2px] shadow-phone"
						>
							{/* Screen. Content sits full bleed underneath the chrome so an
							    app's own background runs behind the status bar and the home
							    indicator instead of leaving black bands. */}
							<div
								ref={screenRef}
								style={{
									borderRadius: '0px',
									// The camera punches a hole through the screen: the phone is
									// held up in front of the world, so the world is what the
									// screen shows. Wallpaper and the black backing both have to
									// go, or there is nothing to see through.
									...(cameraActive || !wallpaper
										? null
										: {
												// JSON.stringify quotes and escapes the URL, so a pasted
												// link containing a quote cannot break the declaration.
												backgroundImage: `url(${JSON.stringify(wallpaper)})`,
												backgroundSize: 'cover',
												backgroundPosition: 'center',
											}),
								}}
								className={`relative h-full w-full overflow-hidden ${
									cameraActive ? 'bg-transparent' : 'bg-black'
								}`}
							>
								{/* The home screen would sit behind the viewfinder and show
								    through it, so it stands down while the camera is up. */}
								{!cameraActive && (
									<div className="absolute inset-0 flex flex-col" style={{ paddingTop: 'var(--status-h)', paddingBottom: 'var(--chrome-b)' }}>
										<HomeScreen screenRef={screenRef} metrics={metrics} />
									</div>
								)}

								<AppHost panelWidth={metrics.width} />

								<AnimatePresence>
									{notificationCentre && <NotificationCentre key="centre" panelWidth={metrics.width} />}
								</AnimatePresence>

								<CallOverlay panelWidth={metrics.width} />

								<StatusBar />
								<BottomBar />

								<NotificationStack />
								<CallCard />
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

		</div>
	);
}
