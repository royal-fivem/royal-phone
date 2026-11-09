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

const FOLD = { type: 'spring', stiffness: 220, damping: 30, mass: 0.85 };
const ENTER = { type: 'spring', stiffness: 320, damping: 32, mass: 0.8 };
const HOME_AWAY = { duration: 0.26, ease: [0.32, 0, 0.67, 0] };
const HOME_BACK = { duration: 0.22, ease: [0.33, 1, 0.68, 1] };

const DEFAULT_PEEK_MS = 1500;

export default function PhoneShell() {
	const open = usePhoneStore((s) => s.open);
	const expanded = usePhoneStore((s) => s.expanded);
	const notificationCentre = usePhoneStore((s) => s.notificationCentre);

	const size = usePhoneStore((s) => s.settings.size);
	const wallpaper = usePhoneStore((s) => s.settings.wallpaper);
	const hasToast = useNotifyStore((s) => s.visible.length > 0);
	const latestToast = useNotifyStore((s) => s.visible[s.visible.length - 1]?.id ?? null);
	const activeApp = usePhoneStore((s) => s.activeApp);
	const inCall = usePhoneStore((s) => s.call !== null);
	const callExpanded = usePhoneStore((s) => s.call?.expanded === true);
	const openFromCallMode = usePhoneStore((s) => s.openFromCallMode);
	const openTo = usePhoneStore((s) => s.openTo);

	const [peekLatch, setPeekLatch] = useState(false);
	const peekMs = usePhoneStore((s) => s.settings.peekDuration) ?? DEFAULT_PEEK_MS;
	const cameraActive = useCameraStore((s) => s.active);

	const metrics = usePhoneMetrics(size / 100);
	const screenRef = useRef(null);
	const hinge = useAnimationControls();
	const first = useRef(true);

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

	useEffect(() => {
		if (open || latestToast === null) return;

		setPeekLatch(true);
		const timer = setTimeout(() => setPeekLatch(false), peekMs);

		return () => clearTimeout(timer);
	}, [latestToast, open, peekMs]);

	const notificationPeek = hasToast && peekLatch;

	// In game the peek never has the mouse (driving, shooting), so the open key
	// is how a player acts on it: pressed during a peek, the phone opens on that
	// notification. A click or tap on a toast sets its own launch and wins.
	useEffect(() => {
		const { setPendingLaunch } = usePhoneStore.getState();

		if (notificationPeek && !open) {
			const toast = useNotifyStore.getState().visible.find((n) => n.id === latestToast);
			if (toast?.app && !toast.offer) {
				setPendingLaunch({ app: toast.app, route: toast.route ?? null, fromPeek: true, at: Date.now() });
			}
			return;
		}

		if (usePhoneStore.getState().pendingLaunch?.fromPeek) setPendingLaunch(null);
	}, [notificationPeek, latestToast, open]);
	const cardOpen = inCall && callExpanded;
	const peeking = !open && (cardOpen || notificationPeek);
	const callMode = !open && inCall && !peeking;

	const onScreen = open || peeking || callMode;

	const unfolded = open && expanded;
	const width = unfolded ? metrics.expandedWidth : metrics.width;
	const x = unfolded ? metrics.expandedX : metrics.collapsedX;
	const y = open ? metrics.top : callMode ? metrics.callTop : metrics.peekTop;

	// A notification peek takes clicks too: the phone body brings it up on the
	// home screen, a toast brings it up on that notification (NotificationStack).
	const interactive = open || inCall || notificationPeek;

	const onShellClick = open
		? undefined
		: callMode
			? openFromCallMode
			: notificationPeek
				? () => openTo(null)
				: undefined;

	useEffect(() => {
		fetchNui('callMode', { active: (callMode || cardOpen) && !open });
	}, [callMode, cardOpen, open]);

	const [parked, setParked] = useState(!onScreen);

	useEffect(() => {
		if (onScreen) {
			setParked(false);
			return;
		}

		const timer = setTimeout(() => setParked(true), 300);
		return () => clearTimeout(timer);
	}, [onScreen]);

	return (
		<div className="pointer-events-none fixed inset-0 z-40" style={{ perspective: 2400 }}>
			<motion.div
				className={`absolute left-0 top-0 will-change-transform ${
					interactive && onScreen ? 'pointer-events-auto' : 'pointer-events-none'
				}`}
				onClick={onShellClick}
				style={{
					transformStyle: 'preserve-3d',
					visibility: parked ? 'hidden' : 'visible',
					...cssVars(metrics.width),
				}}
				initial={false}
				animate={{
					opacity: onScreen ? 1 : 0,
					x,
					y: onScreen ? y : metrics.offscreenTop,
					width,
					height: metrics.height,
				}}
				transition={
					onScreen
						? { x: FOLD, y: FOLD, width: FOLD, height: FOLD, default: ENTER }
						: { duration: 0.24, ease: [0.4, 0, 1, 1] }
				}
			>
				<motion.div
					animate={hinge}
					style={{
						transformStyle: 'preserve-3d',
						borderRadius: '0px',
					}}
					className="relative h-full w-full bg-gradient-to-b from-neutral-400/70 via-neutral-700/90 to-neutral-500/70 p-[2px] shadow-phone"
				>
					<div
						ref={screenRef}
						style={{
							borderRadius: '0px',
							...(cameraActive || !wallpaper
								? null
								: {
										backgroundImage: `url(${JSON.stringify(wallpaper)})`,
										backgroundSize: 'cover',
										backgroundPosition: 'center',
									}),
						}}
						className={`relative h-full w-full overflow-hidden ${
							cameraActive ? 'bg-transparent' : 'bg-black'
						}`}
					>
						{!cameraActive && (
							<motion.div
								className="absolute inset-0 flex flex-col"
								style={{ paddingTop: 'var(--status-h)', paddingBottom: 'var(--chrome-b)' }}
								initial={false}
								animate={{ scale: activeApp ? 1.12 : 1, opacity: activeApp ? 0 : 1 }}
								transition={activeApp ? HOME_AWAY : HOME_BACK}
							>
								<HomeScreen screenRef={screenRef} metrics={metrics} />
							</motion.div>
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
		</div>
	);
}
