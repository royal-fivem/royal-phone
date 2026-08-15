import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import {
	Home01Icon,
	Layers01Icon,
	Store01Icon,
	PlusSignIcon,
	Search01Icon,
	Notification03Icon,
	UserSettings01Icon,
} from '@hugeicons/core-free-icons';

import Onboarding from './lifeinvader/Onboarding';
import Feed from './lifeinvader/Feed';
import Marketplace from './lifeinvader/Marketplace';
import { Compose, Thread } from './lifeinvader/Overlays';
import { Search, Notifications, Settings } from './lifeinvader/Screens';
import useDataStore from '../state/dataStore';
import useLifeinvaderStore from '../state/lifeinvaderStore';

const NAV = [
	{ id: 'feed', icon: Home01Icon },
	{ id: 'stories', icon: Layers01Icon },
	{ id: 'market', icon: Store01Icon },
	{ id: 'compose', icon: PlusSignIcon, primary: true },
	{ id: 'search', icon: Search01Icon },
	{ id: 'alerts', icon: Notification03Icon },
	{ id: 'settings', icon: UserSettings01Icon },
];

export default function LifeinvaderApp() {
	const account = useLifeinvaderStore((s) => s.account);
	const posts = useLifeinvaderStore((s) => s.posts);
	const unread = useLifeinvaderStore((s) => s.notifications.filter((n) => !n.read).length);
	const addStory = useLifeinvaderStore((s) => s.addStory);
	const photos = useDataStore((s) => s.photos);

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

	const postStory = () => {
		const latest = photos[0];
		if (latest?.url) addStory(latest.url);
	};

	const select = (id) => {
		if (id === 'compose') return setComposing(true);
		if (id === 'stories') return postStory();

		setView(id);
	};

	const thread = posts.find((p) => p.id === openPost);

	return (
		<div
			className="relative flex h-full w-full flex-col"
			style={{ paddingTop: 'var(--status-h)', paddingBottom: 'var(--chrome-b)' }}
		>
			{view === 'feed' && <Feed onAddStory={postStory} onOpenPost={setOpenPost} />}
			{view === 'market' && <Marketplace />}
			{view === 'search' && <Search />}
			{view === 'alerts' && <Notifications />}
			{view === 'settings' && <Settings onSignUp={() => setSigningUp(true)} />}

			<nav className="mx-3 mb-1 flex shrink-0 items-center justify-between rounded-full bg-white/[0.06] px-2 py-1.5">
				{NAV.map((item) => {
					const active = view === item.id;

					if (item.primary) {
						return (
							<button
								key={item.id}
								onClick={() => select(item.id)}
								className="grid h-9 w-9 place-items-center rounded-full bg-sky-500 text-white"
							>
								<HugeiconsIcon icon={item.icon} size={18} strokeWidth={2.4} />
							</button>
						);
					}

					return (
						<button
							key={item.id}
							onClick={() => select(item.id)}
							className={`relative grid h-9 w-9 place-items-center rounded-full transition ${
								active ? 'text-white' : 'text-white/40 hover:text-white/70'
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
