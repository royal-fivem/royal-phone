import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { Notification03Icon, MapsIcon, ArrowShrinkIcon, Call02Icon, HotelBellIcon } from '@hugeicons/core-free-icons';
import { BellIcon } from '@heroicons/react/24/solid'

import usePhoneStore from '../state/phoneStore';
import useNotifyStore from '../state/notifyStore';
import { formatClock } from '../utils/format';
import useCallTimer, { formatDuration } from '../utils/useCallTimer';

function CallPill() {
	const call = usePhoneStore((s) => s.call);
	const open = usePhoneStore((s) => s.open);
	const restoreCall = usePhoneStore((s) => s.restoreCall);
	const expandCallCard = usePhoneStore((s) => s.expandCallCard);
	const collapseCallCard = usePhoneStore((s) => s.collapseCallCard);

	const seconds = useCallTimer(call?.connectedAt);

	const tap = () => {
		if (open) return restoreCall();
		if (call?.expanded) return collapseCallCard();
		expandCallCard();
	};

	return (
		<AnimatePresence>
			{call && (
				<motion.button
					initial={{ opacity: 0, scale: 0.7, width: 0 }}
					animate={{ opacity: 1, scale: 1, width: 'auto' }}
					exit={{ opacity: 0, scale: 0.7, width: 0 }}
					transition={{ type: 'spring', stiffness: 520, damping: 34 }}
					onClick={(event) => {
						event.stopPropagation();
						tap();
					}}
					className="pointer-events-auto flex shrink-0 items-center overflow-hidden rounded-full bg-emerald-500 text-white"
					style={{
						gap: 'calc(var(--pw) * 0.014)',
						paddingInline: 'calc(var(--pw) * 0.024)',
						paddingBlock: 'calc(var(--pw) * 0.008)',
					}}
				>
					<HugeiconsIcon
						icon={Call02Icon}
						size={12}
						strokeWidth={2.4}
						style={{ width: 'calc(var(--pw) * 0.034)', height: 'calc(var(--pw) * 0.034)' }}
					/>
					<span
						className="font-semibold tabular-nums leading-none"
						style={{ fontSize: 'calc(var(--pw) * 0.034)' }}
					>
						{call.state === 'active' ? formatDuration(seconds) : '···'}
					</span>
				</motion.button>
			)}
		</AnimatePresence>
	);
}

export default function StatusBar() {
	const clock = usePhoneStore((s) => s.clock);
	const expanded = usePhoneStore((s) => s.expanded);
	const toggleExpanded = usePhoneStore((s) => s.toggleExpanded);
	const toggleNotificationCentre = usePhoneStore((s) => s.toggleNotificationCentre);
	const notificationCentre = usePhoneStore((s) => s.notificationCentre);

	const unread = useNotifyStore((s) => s.history.filter((n) => !n.read).length);

	return (
		<div
			className="absolute inset-x-0 top-0 z-30 flex items-center justify-between"
			style={{
				height: 'var(--status-h)',
				paddingLeft: 'calc(var(--pw) * 0.05)',
				paddingRight: 'calc(var(--pw) * 0.05)',
			}}
		>
			<div className="flex min-w-0 items-center" style={{ gap: 'calc(var(--pw) * 0.02)' }}>
				<span
					className="shrink-0 font-normal tabular-nums tracking-tight text-white"
					style={{ fontSize: 'calc(var(--pw) * 0.042)' }}
				>
					{formatClock(clock.hour, clock.minute)}
				</span>

				<CallPill />

				<button
					onClick={toggleNotificationCentre}
					className={`relative transition ${notificationCentre ? 'text-white' : 'text-white/50'}`}
					style={{ width: 'calc(var(--pw) * 0.046)', height: 'calc(var(--pw) * 0.046)' }}
				>

<BellIcon className="h-full w-full" />

					<AnimatePresence>
						{unread > 0 && (
							<motion.span
								initial={{ scale: 0 }}
								animate={{ scale: 1 }}
								exit={{ scale: 0 }}
								className="absolute grid place-items-center rounded-full bg-rose-600 font-bold leading-none text-white"
								style={{
									top: 'calc(var(--pw) * -0.022)',
									left: 'calc(var(--pw) * 0.022)',
									height: 'calc(var(--pw) * 0.042)',
									minWidth: 'calc(var(--pw) * 0.042)',
									paddingInline: 'calc(var(--pw) * 0.008)',
									fontSize: 'calc(var(--pw) * 0.026)',
								}}
							>
								{unread > 99 ? '99+' : unread}
							</motion.span>
						)}
					</AnimatePresence>
				</button>
			</div>

			<motion.button
				onClick={toggleExpanded}
				whileTap={{ scale: 0.86 }}
				title={expanded ? 'Fold' : 'Flip out'}
				className="text-white/90 transition hover:text-white"
				style={{ width: 'calc(var(--pw) * 0.055)', height: 'calc(var(--pw) * 0.055)' }}
			>
				<motion.span
					key={expanded ? 'in' : 'out'}
					initial={{ rotate: -90, opacity: 0 }}
					animate={{ rotate: 0, opacity: 1 }}
					transition={{ type: 'spring', stiffness: 500, damping: 30 }}
					className="block h-full w-full"
				>
					<HugeiconsIcon
						icon={expanded ? ArrowShrinkIcon : MapsIcon}
						size={20}
						strokeWidth={1.8}
						className="h-full w-full"
					/>
				</motion.span>
			</motion.button>
		</div>
	);
}
