import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';

import AppGlyph from './AppGlyph';
import useNotifyStore from '../state/notifyStore';
import usePhoneStore from '../state/phoneStore';
import { getApp } from '../config/apps';

const SPRING = { type: 'spring', stiffness: 460, damping: 38, mass: 0.7 };

function Toast({ notification, onClick }) {
	const app = getApp(notification.app);
	const dismiss = useNotifyStore((s) => s.dismiss);
	const answerOffer = useNotifyStore((s) => s.answerOffer);

	const offer = notification.offer;

	return (
		<motion.div
			initial={{ y: -60, opacity: 0 }}
			animate={{ y: 0, opacity: 1 }}
			exit={{ y: -60, opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
			transition={SPRING}

			drag={offer ? false : 'y'}
			dragConstraints={{ top: 0, bottom: 0 }}
			dragElastic={{ top: 0.5, bottom: 0 }}
			onDragEnd={(_event, info) => {
				if (info.offset.y < -22) dismiss(notification.id);
			}}
			onClick={() => !offer && onClick?.(notification)}
			className={`pointer-events-auto w-full touch-none ${offer ? '' : 'cursor-pointer'}`}
		>
			<div
				className="border border-white/[0.07] bg-[#0d0d0f]/95 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.9)]"
				style={{
					borderRadius: 'calc(var(--pw) * 0.04)',
					padding: 'calc(var(--pw) * 0.028)',
					paddingRight: 'calc(var(--pw) * 0.017)',
				}}
			>
			<div className="flex items-center" style={{ gap: 'calc(var(--pw) * 0.034)' }}>
				<div
					className="shrink-0"
					style={{ width: 'calc(var(--pw) * 0.101)', height: 'calc(var(--pw) * 0.101)' }}
				>
					{notification.avatar ? (
						<img src={notification.avatar} alt="" className="h-full w-full rounded-[28%] object-cover" />
					) : (
						<AppGlyph app={app} radius="28%" glyph="50%" />
					)}
				</div>

				<div className="min-w-0 flex-1">
					<div
						className="font-bold leading-tight text-white"
						style={{ fontSize: 'calc(var(--pw) * 0.038)' }}
					>
						{notification.title}
					</div>
					{notification.content && (
						<p
							className="line-clamp-2 text-white/65"
							style={{
								fontSize: 'calc(var(--pw) * 0.035)',
								lineHeight: 1.35,
								marginTop: 'calc(var(--pw) * 0.008)',
							}}
						>
							{notification.content}
						</p>
					)}
				</div>

				{!offer && (
					<button
						onClick={(event) => {
							event.stopPropagation();
							dismiss(notification.id);
						}}
						className="grid shrink-0 place-items-center self-start rounded-full text-white/35 transition hover:bg-white/10 hover:text-white/80"
						style={{ width: 'calc(var(--pw) * 0.067)', height: 'calc(var(--pw) * 0.067)' }}
					>
						<HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={2.4} className="h-1/2 w-1/2" />
					</button>
				)}
			</div>

			{offer && (
				<div
					className="flex"
					style={{ gap: 'calc(var(--pw) * 0.022)', marginTop: 'calc(var(--pw) * 0.028)' }}
				>
					<button
						onClick={(event) => {
							event.stopPropagation();
							answerOffer(notification.id, false);
						}}
						className="flex-1 rounded-full bg-white/[0.08] font-bold text-white/70 transition hover:bg-white/[0.14] hover:text-white"
						style={{
							fontSize: 'calc(var(--pw) * 0.034)',
							paddingTop: 'calc(var(--pw) * 0.022)',
							paddingBottom: 'calc(var(--pw) * 0.022)',
						}}
					>
						Decline
					</button>

					<button
						onClick={(event) => {
							event.stopPropagation();
							answerOffer(notification.id, true);
						}}
						className="flex-1 rounded-full bg-sky-500 font-bold text-white transition hover:bg-sky-400"
						style={{
							fontSize: 'calc(var(--pw) * 0.034)',
							paddingTop: 'calc(var(--pw) * 0.022)',
							paddingBottom: 'calc(var(--pw) * 0.022)',
						}}
					>
						{offer.acceptLabel ?? 'Accept'}
					</button>
				</div>
			)}
			</div>
		</motion.div>
	);
}

export default function NotificationStack() {
	const visible = useNotifyStore((s) => s.visible);
	const openApp = usePhoneStore((s) => s.openApp);
	const dismiss = useNotifyStore((s) => s.dismiss);

	const onClick = (notification) => {
		if (notification.app) openApp(notification.app, notification.route ?? null);
		dismiss(notification.id);
	};

	return (
		<div
			className="pointer-events-none absolute left-1/2 z-[70] flex w-[min(90%,calc(var(--pw)*0.9))] -translate-x-1/2 flex-col gap-2"
			style={{ top: 'calc(var(--status-h) * 0.84)' }}
		>
			<AnimatePresence initial={false}>
				{visible.map((notification) => (
					<Toast key={notification.id} notification={notification} onClick={onClick} />
				))}
			</AnimatePresence>
		</div>
	);
}
