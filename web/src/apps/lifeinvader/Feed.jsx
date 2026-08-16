import React, { useEffect, useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
	Comment01Icon,
	ArrowReloadHorizontalIcon,
	FavouriteIcon,
	Message01Icon,
	PlusSignIcon,
} from '@hugeicons/core-free-icons';

import { Face, Tabs, Empty } from './parts';
import Media from './Media';
import useLifeinvaderStore from '../../state/lifeinvaderStore';
import { formatRelative } from '../../utils/format';

const TABS = [
	{ id: 'following', label: 'Following' },
	{ id: 'discover', label: 'Discover' },
];

function Action({ icon, count, active, onClick, activeClass = 'text-rose-500' }) {
	return (
		<button
			onClick={onClick}
			className={`flex items-center gap-1.5 transition ${active ? activeClass : 'text-white/40 hover:text-white/70'}`}
		>
			<HugeiconsIcon icon={icon} size={17} strokeWidth={1.9} />
			{count > 0 && <span className="text-[12px] tabular-nums">{count}</span>}
		</button>
	);
}

export function Post({ post, onOpen }) {
	const { toggleLike, repost } = useLifeinvaderStore();

	return (
		<article className="border-b border-white/[0.06] px-4 py-3">
			<div className="flex items-center gap-2.5">
				<Face src={post.avatar} name={post.name} />

				<div className="flex min-w-0 flex-1 items-baseline gap-1.5">
					<span className="truncate text-[14px] font-bold text-white">{post.name}</span>
					<span className="truncate text-[12.5px] text-white/35">@{post.handle}</span>
					<span className="ml-auto shrink-0 text-[11.5px] text-white/30">
						{formatRelative(post.createdAt)}
					</span>
				</div>
			</div>

			{post.text && (
				<p className="mt-2 whitespace-pre-wrap break-words text-[13.5px] leading-snug text-white/90">
					{post.text}
				</p>
			)}

			{post.media && <Media src={post.media} className="mt-2.5" />}

			<div className="mt-3 flex items-center gap-8">
				<Action icon={Comment01Icon} count={post.comments.length} onClick={onOpen} activeClass="text-sky-400" />
				<Action
					icon={ArrowReloadHorizontalIcon}
					count={post.reposts}
					active={post.reposted}
					onClick={() => repost(post.id)}
					activeClass="text-emerald-400"
				/>
				<Action icon={FavouriteIcon} count={post.likes} active={post.liked} onClick={() => toggleLike(post.id)} />
			</div>
		</article>
	);
}

export default function Feed({ onCompose, onOpenPost }) {
	const posts = useLifeinvaderStore((s) => s.posts);
	const following = useLifeinvaderStore((s) => s.following);
	const blocked = useLifeinvaderStore((s) => s.blocked);
	const refresh = useLifeinvaderStore((s) => s.refresh);

	const [tab, setTab] = useState('discover');

	useEffect(() => {
		refresh();
	}, []);

	const shown = useMemo(() => {
		const visible = posts.filter((p) => !blocked.includes(p.handle));
		if (tab === 'following') return visible.filter((p) => following.includes(p.handle));

		return visible;
	}, [posts, tab, following, blocked]);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<header className="flex shrink-0 items-center gap-2 border-b border-white/[0.07] px-2">
				<Tabs tabs={TABS} value={tab} onChange={setTab} className="flex-1" />

				<button
					onClick={onCompose}
					className="mb-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sky-500 text-white transition hover:bg-sky-400 active:scale-95"
				>
					<HugeiconsIcon icon={PlusSignIcon} size={17} strokeWidth={2.4} />
				</button>
			</header>

			<div className="royal-scroll min-h-0 flex-1 overflow-y-auto">
				{shown.length === 0 ? (
					<Empty
						icon={Message01Icon}
						label={tab === 'following' ? 'Nothing from your follows' : 'Nothing here yet'}
						hint={tab === 'following' ? 'Follow people to fill this feed.' : 'Be the first to post something.'}
					/>
				) : (
					shown.map((item) => <Post key={item.id} post={item} onOpen={() => onOpenPost(item.id)} />)
				)}
			</div>
		</div>
	);
}
