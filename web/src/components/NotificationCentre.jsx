import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import {
	Notification03Icon,
	NotificationOff01Icon,
	VolumeHighIcon,
	VolumeMute01Icon,
	AirplaneModeIcon,
	PencilEdit01Icon,
	Settings01Icon,
	ArrowRight01Icon,
	ArrowDown01Icon,
	Clock01Icon,
	Delete02Icon,
} from '@hugeicons/core-free-icons';

import AppGlyph from './AppGlyph';
import ScreenScale from './ScreenScale';
import useNotifyStore from '../state/notifyStore';
import usePhoneStore from '../state/phoneStore';
import { getApp } from '../config/apps';
import { formatTime, formatRelative } from '../utils/format';

function QuickButton({ icon, active, danger, onClick, title }) {
	return (
		<motion.button
			whileTap={{ scale: 0.9 }}
			onClick={onClick}
			title={title}
			className={`grid h-11 w-11 place-items-center rounded-full transition ${
				active
					? danger
						? 'bg-rose-500 text-white'
						: 'bg-white text-black'
					: 'bg-white/[0.09] text-white/75 hover:bg-white/[0.16] hover:text-white'
			}`}
		>
			<HugeiconsIcon icon={icon} size={19} strokeWidth={1.9} />
		</motion.button>
	);
}

function QuickActions({ onClose }) {
	const settings = usePhoneStore((s) => s.settings);
	const setSetting = usePhoneStore((s) => s.setSetting);
	const setEditMode = usePhoneStore((s) => s.setEditMode);
	const openApp = usePhoneStore((s) => s.openApp);

	const muted = !settings.sounds;
	const silenced = settings.dnd;

	return (
		<div className="flex items-center justify-between px-5 pb-4 pt-1">
			<QuickButton
				icon={muted ? VolumeMute01Icon : VolumeHighIcon}
				active={muted}
				danger
				title={muted ? 'Sounds off' : 'Sounds on'}
				onClick={() => setSetting('sounds', muted)}
			/>
			<QuickButton
				icon={silenced ? NotificationOff01Icon : Notification03Icon}
				active={silenced}
				danger
				title={silenced ? 'Do not disturb' : 'Notifications on'}
				onClick={() => setSetting('dnd', !silenced)}
			/>
			<QuickButton
				icon={AirplaneModeIcon}
				active={settings.airplane}
				title="Airplane mode"
				onClick={() => setSetting('airplane', !settings.airplane)}
			/>
			<QuickButton
				icon={PencilEdit01Icon}
				title="Rearrange apps"
				onClick={() => {
					setEditMode(true);
					onClose();
				}}
			/>
			<QuickButton
				icon={Settings01Icon}
				title="Settings"
				onClick={() => {
					openApp('settings');
					onClose();
				}}
			/>
		</div>
	);
}

function Entry({ notification, onOpen, onRemove, compact = false }) {
	const use24Hour = usePhoneStore((s) => s.settings.use24Hour);

	return (
		<motion.div
			initial={{ opacity: 0, y: -8 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, x: 40 }}
			className={`flex items-center gap-3 ${compact ? 'px-3 py-2.5' : 'px-3 py-3'}`}
		>
			{!compact && (
				<div className="h-9 w-9 shrink-0">
					<AppGlyph app={getApp(notification.app)} radius="28%" glyph="52%" />
				</div>
			)}

			<button onClick={onOpen} className="min-w-0 flex-1 text-left">
				<div className="truncate text-[13.5px] font-bold text-white">{notification.title}</div>
				{notification.content && (
					<p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-white/55">
						{notification.content}
					</p>
				)}
				<div className="mt-1 text-[11px] text-white/30">{formatTime(notification.receivedAt, use24Hour)}</div>
			</button>

			<button
				onClick={onRemove}
				className="shrink-0 text-white/25 transition hover:text-white/70"
				title="Dismiss"
			>
				<HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={2.2} />
			</button>
		</motion.div>
	);
}

function Group({ group, onOpen, onRemoveApp, onRemove }) {
	const [open, setOpen] = useState(false);
	const app = getApp(group.app);
	const latest = group.items[0];

	return (
		<motion.div
			layout={false}
			initial={{ opacity: 0, y: -8 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, x: 40 }}
			className="overflow-hidden rounded-2xl bg-white/[0.06]"
		>
			<div className="flex items-center gap-3 px-3 py-3">
				<div className="h-9 w-9 shrink-0">
					<AppGlyph app={app} radius="28%" glyph="52%" />
				</div>

				<button onClick={() => setOpen((v) => !v)} className="min-w-0 flex-1 text-left">
					<div className="flex items-center gap-2">
						<span className="truncate text-[13.5px] font-bold text-white">
							{app?.label ?? 'Notifications'}
						</span>
						<span className="grid h-[17px] min-w-[17px] shrink-0 place-items-center rounded-full bg-white/15 px-1 text-[10px] font-bold text-white">
							{group.items.length}
						</span>
						<span className="ml-auto shrink-0 text-[11px] text-white/30">
							{formatRelative(latest.receivedAt)}
						</span>
					</div>

					<p className="mt-0.5 truncate text-[12.5px] text-white/55">
						{latest.title}
						{latest.content ? `: ${latest.content}` : ''}
					</p>
				</button>

				<button
					onClick={() => setOpen((v) => !v)}
					className="shrink-0 text-white/30 transition hover:text-white/70"
				>
					<HugeiconsIcon icon={open ? ArrowDown01Icon : ArrowRight01Icon} size={16} strokeWidth={2.2} />
				</button>
			</div>

			<AnimatePresence initial={false}>
				{open && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: 'auto', opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						className="overflow-hidden border-t border-white/[0.06]"
					>
						{group.items.map((item) => (
							<Entry
								key={item.id}
								notification={item}
								compact
								onOpen={() => onOpen(item)}
								onRemove={() => onRemove(item.id)}
							/>
						))}

						<button
							onClick={() => onRemoveApp(group.app)}
							className="flex w-full items-center justify-center gap-1.5 border-t border-white/[0.06] py-2 text-[12px] font-medium text-white/40 transition hover:text-white/70"
						>
							<HugeiconsIcon icon={Delete02Icon} size={13} strokeWidth={2} /> Clear these
						</button>
					</motion.div>
				)}
			</AnimatePresence>
		</motion.div>
	);
}

export default function NotificationCentre({ panelWidth }) {
	const history = useNotifyStore((s) => s.history);
	const clearHistory = useNotifyStore((s) => s.clearHistory);
	const markAllRead = useNotifyStore((s) => s.markAllRead);
	const remove = useNotifyStore((s) => s.remove);
	const removeApp = useNotifyStore((s) => s.removeApp);
	const markRead = useNotifyStore((s) => s.markRead);

	const openApp = usePhoneStore((s) => s.openApp);
	const toggle = usePhoneStore((s) => s.toggleNotificationCentre);

	const [showRead, setShowRead] = useState(true);

	const blocks = useMemo(() => {
		const source = showRead ? history : history.filter((n) => !n.read);
		const out = [];

		for (const notification of source) {
			const last = out[out.length - 1];

			if (last && last.app === notification.app && notification.app) {
				last.items.push(notification);
			} else {
				out.push({ app: notification.app, items: [notification] });
			}
		}

		return out;
	}, [history, showRead]);

	const open = (notification) => {
		markRead(notification.id);

		if (notification.app) {
			openApp(notification.app, notification.route ?? null);
			return;
		}

		toggle();
	};

	const body = (
		<div className="flex h-full flex-col" style={{ paddingTop: 'var(--status-h)', paddingBottom: 'var(--chrome-b)' }}>
			<QuickActions onClose={toggle} />

			<div className="h-px shrink-0 bg-white/[0.09]" />

			<header className="flex shrink-0 items-center gap-3 px-5 py-3">
				<h2 className="flex-1 text-[17px] font-bold tracking-tight text-white">Notifications</h2>

				<button
					onClick={clearHistory}
					disabled={history.length === 0}
					className="text-[12.5px] font-medium text-white/55 transition hover:text-white disabled:opacity-30"
				>
					Clear All
				</button>

				<button
					onClick={() => {
						setShowRead((v) => !v);
						markAllRead();
					}}
					className={`flex items-center gap-1 text-[12.5px] font-medium transition ${
						showRead ? 'text-white/55 hover:text-white' : 'text-sky-400'
					}`}
				>
					<HugeiconsIcon icon={Clock01Icon} size={13} strokeWidth={2} />
					History
				</button>
			</header>

			<div className="royal-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
				<AnimatePresence initial={false}>
					{blocks.length === 0 ? (
						<div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center">
							<HugeiconsIcon icon={Notification03Icon} size={28} strokeWidth={1.4} className="text-white/20" />
							<span className="text-[13px] text-white/30">
								{showRead ? 'No notifications' : 'Nothing unread'}
							</span>
						</div>
					) : (
						blocks.map((block) =>
							block.items.length > 1 ? (
								<Group
									key={`${block.app}-${block.items[0].id}`}
									group={block}
									onOpen={open}
									onRemove={remove}
									onRemoveApp={removeApp}
								/>
							) : (
								<motion.div
									key={block.items[0].id}
									initial={{ opacity: 0, y: -8 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, x: 40 }}
									className="overflow-hidden rounded-2xl bg-white/[0.06]"
								>
									<Entry
										notification={block.items[0]}
										onOpen={() => open(block.items[0])}
										onRemove={() => remove(block.items[0].id)}
									/>
								</motion.div>
							)
						)
					)}
				</AnimatePresence>
			</div>
		</div>
	);

	return (
		<motion.div
			initial={{ y: '-100%' }}
			animate={{ y: 0 }}
			exit={{ y: '-100%' }}
			transition={{ type: 'spring', stiffness: 380, damping: 40 }}
			className="absolute inset-0 z-[25] bg-stone-950/85 backdrop-blur-md"
		>
			<ScreenScale panelWidth={panelWidth}>{body}</ScreenScale>
		</motion.div>
	);
}
