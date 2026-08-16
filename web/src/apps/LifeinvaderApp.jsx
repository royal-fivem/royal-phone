import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import {
	Home01Icon,
	Store01Icon,
	Search01Icon,
	Notification03Icon,
	UserSettings01Icon,
} from '@hugeicons/core-free-icons';

import Onboarding from './lifeinvader/Onboarding';
import Feed from './lifeinvader/Feed';
import Marketplace from './lifeinvader/Marketplace';
import { Compose, Thread } from './lifeinvader/Overlays';
import { Search, Notifications, Settings } from './lifeinvader/Screens';
import useLifeinvaderStore from '../state/lifeinvaderStore';

const NAV = [
	{ id: 'feed', icon: Home01Icon },
	{ id: 'market', icon: Store01Icon },
	{ id: 'search', icon: Search01Icon },
	{ id: 'alerts', icon: Notification03Icon },
	{ id: 'settings', icon: UserSettings01Icon },
];

export default function LifeinvaderApp() {
	const account = useLifeinvaderStore((s) => s.account);
	const posts = useLifeinvaderStore((s) => s.posts);
	const unread = useLifeinvaderStore((s) => s.notifications.filter((n) => !n.read).length);

	const [view, setView] = useState('feed');
	const [composing, setComposing] = useState(false);
	const [openPost, setOpenPost] = useState(null);
	const [signingUp, setSigningUp] = useState(false);

	if (!account || signingUp) {
		return (
			<div className="relative h-full w-full">
				<Onboarding />
			</div>
		);
	}

	const thread = posts.find((p) => p.id === openPost);

	return (
		<div
			className="relative flex h-full w-full flex-col"
			style={{ paddingTop: 'var(--status-h)', paddingBottom: 'var(--chrome-b)' }}
		>
			{view === 'feed' && <Feed onCompose={() => setComposing(true)} onOpenPost={setOpenPost} />}
			{view === 'market' && <Marketplace />}
			{view === 'search' && <Search />}
			{view === 'alerts' && <Notifications />}
			{view === 'settings' && <Settings onSignUp={() => setSigningUp(true)} />}

			<nav className="mx-3 mb-1 flex shrink-0 items-center justify-around rounded-full bg-white/[0.06] px-1.5 py-1.5">
				{NAV.map((item) => {
					const active = view === item.id;

					return (
						<button
							key={item.id}
							onClick={() => setView(item.id)}
							className={`relative grid h-9 w-9 place-items-center rounded-full transition ${
								active ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
							}`}
						>
							<HugeiconsIcon icon={item.icon} size={18} strokeWidth={active ? 2.1 : 1.8} />

							{item.id === 'alerts' && unread > 0 && (
								<span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-[#07080c]" />
							)}
						</button>
					);
				})}
			</nav>

			<AnimatePresence>
				{composing && <Compose key="compose" onClose={() => setComposing(false)} />}
				{!composing && thread && <Thread key="thread" post={thread} onClose={() => setOpenPost(null)} />}
			</AnimatePresence>
		</div>
	);
}
