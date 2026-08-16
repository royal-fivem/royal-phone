import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import {
	Comment02Icon,
	Search01Icon,
	UserIcon,
	Settings01Icon,
	UserSwitchIcon,
	UserBlock01Icon,
	ArrowRight01Icon,
	ArrowLeft01Icon,
	Cancel01Icon,
	Image01Icon,
	FavouriteIcon,
	UserAdd01Icon,
	ArrowReloadHorizontalIcon,
} from '@hugeicons/core-free-icons';

import { Face, Tabs, Empty, Field, inputClass } from './parts';
import useDataStore from '../../state/dataStore';
import useLifeinvaderStore from '../../state/lifeinvaderStore';
import { formatRelative } from '../../utils/format';

export function Search() {
	const directory = useLifeinvaderStore((s) => s.people);
	const posts = useLifeinvaderStore((s) => s.posts);
	const following = useLifeinvaderStore((s) => s.following);
	const toggleFollow = useLifeinvaderStore((s) => s.toggleFollow);
	const refresh = useLifeinvaderStore((s) => s.refresh);
	const me = useLifeinvaderStore((s) => s.me());

	const [query, setQuery] = useState('');

	useEffect(() => {
		refresh();
	}, []);

	const people = useMemo(() => {
		const seen = new Map();

		for (const person of directory) {
			if (person.handle === me?.handle) continue;
			seen.set(person.handle, person);
		}

		if (seen.size === 0) {
			for (const post of posts) {
				if (post.handle === me?.handle) continue;
				if (!seen.has(post.handle)) {
					seen.set(post.handle, { handle: post.handle, name: post.name, avatar: post.avatar });
				}
			}
		}

		const needle = query.trim().toLowerCase();
		const all = [...seen.values()];

		if (!needle) return all;
		return all.filter(
			(p) => p.name.toLowerCase().includes(needle) || p.handle.toLowerCase().includes(needle)
		);
	}, [directory, posts, query, me]);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<header className="shrink-0 px-4 pb-2 pt-1">
				<h1 className="mb-2 text-[20px] font-bold tracking-tight text-white">Search</h1>

				<div className="flex items-center gap-2 rounded-xl bg-white/[0.07] px-3.5 py-2.5">
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="People and posts"
						className="min-w-0 flex-1 bg-transparent text-[13.5px] text-white outline-none placeholder:text-white/35"
					/>
					<HugeiconsIcon icon={Search01Icon} size={16} strokeWidth={2} className="shrink-0 text-white/45" />
				</div>
			</header>

			<div className="royal-scroll min-h-0 flex-1 overflow-y-auto px-4">
				{people.length === 0 ? (
					<Empty icon={UserIcon} label="No one found" />
				) : (
					people.map((person) => {
						const followed = following.includes(person.handle);

						return (
							<div key={person.handle} className="flex items-center gap-3 py-2.5">
								<Face src={person.avatar} name={person.name} size="h-10 w-10" />

								<div className="min-w-0 flex-1">
									<div className="truncate text-[14px] font-bold text-white">{person.name}</div>
									<div className="truncate text-[12.5px] text-white/35">@{person.handle}</div>
								</div>

								<button
									onClick={() => toggleFollow(person.handle)}
									className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition ${
										followed ? 'bg-white/[0.09] text-white' : 'bg-white text-black'
									}`}
								>
									{followed ? 'Following' : 'Follow'}
								</button>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}

const NOTIFY_TABS = [
	{ id: 'all', label: 'All' },
	{ id: 'reply', label: 'Reply' },
	{ id: 'follow', label: 'Follows' },
	{ id: 'like', label: 'Likes' },
];

const NOTIFY_ICON = {
	reply: Comment02Icon,
	follow: UserAdd01Icon,
	like: FavouriteIcon,
	repost: ArrowReloadHorizontalIcon,
};

export function Notifications() {
	const notifications = useLifeinvaderStore((s) => s.notifications);
	const markAllRead = useLifeinvaderStore((s) => s.markAllRead);

	const [tab, setTab] = useState('all');

	const shown = tab === 'all' ? notifications : notifications.filter((n) => n.kind === tab);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<header className="flex shrink-0 items-center gap-3 px-4 pb-2 pt-1">
				<h1 className="flex-1 text-[20px] font-bold tracking-tight text-white">Notifications</h1>
				<button
					onClick={markAllRead}
					className="text-[12.5px] font-medium text-sky-400 transition hover:text-sky-300"
				>
					Mark All As Read
				</button>
			</header>

			<Tabs tabs={NOTIFY_TABS} value={tab} onChange={setTab} className="border-b border-white/[0.07] px-2" />

			<div className="royal-scroll min-h-0 flex-1 overflow-y-auto px-4">
				{shown.length === 0 ? (
					<Empty icon={Comment02Icon} label="No notifications" />
				) : (
					shown.map((item) => (
						<div
							key={item.id}
							className={`flex items-center gap-3 border-b border-white/[0.05] py-3 ${
								item.read ? 'opacity-55' : ''
							}`}
						>
							<span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.08] text-sky-400">
								<HugeiconsIcon icon={NOTIFY_ICON[item.kind] ?? Comment02Icon} size={16} strokeWidth={2} />
							</span>

							<div className="min-w-0 flex-1">
								<div className="truncate text-[13.5px] text-white">
									<span className="font-bold">{item.name}</span> {item.text}
								</div>
								<div className="text-[11.5px] text-white/30">{formatRelative(item.createdAt)}</div>
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
}

export function Settings({ onSignUp }) {
	const { accounts, account, switchAccount, updateAccount, blocked, block, me } = useLifeinvaderStore();
	const photos = useDataStore((s) => s.photos);

	const [pane, setPane] = useState(null);
	const profile = me();

	const [name, setName] = useState(profile?.name ?? '');
	const [bio, setBio] = useState(profile?.bio ?? '');

	if (pane === 'profile') {
		return (
			<div className="flex min-h-0 flex-1 flex-col">
				<header className="flex shrink-0 items-center gap-3 px-4 pb-2 pt-1">
					<button onClick={() => setPane(null)} className="text-white/70 transition hover:text-white">
						<HugeiconsIcon icon={ArrowLeft01Icon} size={19} strokeWidth={2} />
					</button>
					<h1 className="flex-1 text-[18px] font-bold text-white">Edit profile</h1>
				</header>

				<div className="royal-scroll min-h-0 flex-1 overflow-y-auto px-4 pt-2">
					<Field label="Display name">
						<input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
					</Field>

					<Field label="Bio">
						<textarea
							value={bio}
							onChange={(e) => setBio(e.target.value)}
							rows={3}
							maxLength={160}
							className={`${inputClass} resize-none font-normal`}
						/>
					</Field>

					<Field label="Profile picture">
						<div className="royal-scroll flex gap-2 overflow-x-auto rounded-xl bg-black/25 p-2">
							{photos.length === 0 ? (
								<span className="px-2 py-3 text-[12.5px] text-white/35">No photos yet.</span>
							) : (
								photos.map((photo, index) => (
									<button
										key={`${photo.takenAt}-${index}`}
										onClick={() => updateAccount({ avatar: photo.url })}
										className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white/[0.06] ring-2 transition ${
											profile?.avatar === photo.url ? 'ring-sky-500' : 'ring-transparent'
										}`}
									>
										{photo.url && <img src={photo.url} alt="" className="h-full w-full object-cover" />}
									</button>
								))
							)}
						</div>
					</Field>

					<button
						onClick={() => {
							updateAccount({ name: name.trim() || profile.name, bio: bio.trim() });
							setPane(null);
						}}
						className="mb-4 w-full rounded-xl bg-sky-500 py-2.5 text-[14px] font-bold text-white"
					>
						Save
					</button>
				</div>
			</div>
		);
	}

	if (pane === 'accounts' || pane === 'blocked') {
		const isAccounts = pane === 'accounts';

		return (
			<div className="flex min-h-0 flex-1 flex-col">
				<header className="flex shrink-0 items-center gap-3 px-4 pb-2 pt-1">
					<button onClick={() => setPane(null)} className="text-white/70 transition hover:text-white">
						<HugeiconsIcon icon={ArrowLeft01Icon} size={19} strokeWidth={2} />
					</button>
					<h1 className="flex-1 text-[18px] font-bold text-white">
						{isAccounts ? 'Switch Account' : 'Blocked Accounts'}
					</h1>
				</header>

				<div className="royal-scroll min-h-0 flex-1 overflow-y-auto px-4 pt-2">
					{isAccounts ? (
						<>
							{accounts.map((item) => (
								<button
									key={item.id}
									onClick={() => switchAccount(item.id)}
									className="flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left transition hover:bg-white/[0.04]"
								>
									<Face src={item.avatar} name={item.name} size="h-10 w-10" />
									<div className="min-w-0 flex-1">
										<div className="truncate text-[14px] font-bold text-white">{item.name}</div>
										<div className="truncate text-[12.5px] text-white/35">@{item.handle}</div>
									</div>
									{item.id === account && (
										<span className="shrink-0 rounded-full bg-sky-500/20 px-2 py-0.5 text-[11px] font-bold text-sky-400">
											Active
										</span>
									)}
								</button>
							))}

							<button
								onClick={onSignUp}
								className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.07] py-2.5 text-[13.5px] font-bold text-white"
							>
								<HugeiconsIcon icon={UserAdd01Icon} size={15} strokeWidth={2} /> Add account
							</button>
						</>
					) : blocked.length === 0 ? (
						<Empty icon={UserBlock01Icon} label="Nobody blocked" />
					) : (
						blocked.map((handle) => (
							<div key={handle} className="flex items-center gap-3 py-2.5">
								<Face name={handle} size="h-10 w-10" />
								<span className="min-w-0 flex-1 truncate text-[14px] text-white">@{handle}</span>
								<button
									onClick={() => block(handle)}
									className="shrink-0 rounded-full bg-white/[0.09] px-3 py-1.5 text-[12.5px] font-bold text-white"
								>
									Unblock
								</button>
							</div>
						))
					)}
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<header className="shrink-0 px-4 pb-3 pt-1">
				<h1 className="text-[20px] font-bold tracking-tight text-white">Settings</h1>
			</header>

			<div className="royal-scroll min-h-0 flex-1 overflow-y-auto px-4">
				<div className="mb-5 flex items-center gap-3">
					<Face src={profile?.avatar} name={profile?.name} size="h-12 w-12" text="text-[16px]" />

					<div className="min-w-0 flex-1">
						<div className="truncate text-[15px] font-bold text-white">{profile?.name}</div>
						<div className="truncate text-[12.5px] text-white/35">@{profile?.handle}</div>
					</div>

					<button
						onClick={() => setPane('profile')}
						className="shrink-0 text-white/50 transition hover:text-white"
					>
						<HugeiconsIcon icon={Settings01Icon} size={18} strokeWidth={1.9} />
					</button>
				</div>

				{[
					{ id: 'accounts', label: 'Switch Account', icon: UserSwitchIcon },
					{ id: 'blocked', label: 'Blocked Accounts', icon: UserBlock01Icon },
				].map((row) => (
					<button
						key={row.id}
						onClick={() => setPane(row.id)}
						className="flex w-full items-center gap-3 border-b border-white/[0.05] py-3.5 text-left"
					>
						<span className="flex-1 text-[15px] font-bold text-white">{row.label}</span>
						<HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={2.2} className="text-white/30" />
					</button>
				))}
			</div>
		</div>
	);
}

