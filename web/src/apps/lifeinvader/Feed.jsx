import React, { useEffect, useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
	Comment01Icon,
	ArrowReloadHorizontalIcon,
	FavouriteIcon,
	PlusSignIcon,
	Message01Icon,
	Video01Icon,
	UserIcon,
} from '@hugeicons/core-free-icons';

import { Face, Tabs, Empty } from './parts';
import Media from './Media';
import useLifeinvaderStore from '../../state/lifeinvaderStore';
import { formatRelative } from '../../utils/format';

const TABS = [
	{ id: 'following', label: 'Following' },
	{ id: 'live', label: 'Live' },
	{ id: 'discover', label: 'Discover' },
];

function Stories({ onAdd }) {
	const stories = useLifeinvaderStore((s) => s.stories);

	return (
		<div className="royal-scroll flex shrink-0 gap-3 overflow-x-auto px-4 py-3">
			<button onClick={onAdd} className="flex w-[62px] shrink-0 flex-col items-center gap-1.5">
				<span className="grid h-[58px] w-[58px] place-items-center rounded-2xl border border-white/15 bg-white/[0.04] text-white/70">
					<HugeiconsIcon icon={PlusSignIcon} size={20} strokeWidth={2} />
				</span>
				<span className="w-full truncate text-center text-[10.5px] text-white/50">Your St…</span>
			</button>

			{stories.map((story) => (
				<button key={story.id} className="flex w-[62px] shrink-0 flex-col items-center gap-1.5">
					<span className="h-[58px] w-[58px] overflow-hidden rounded-2xl bg-white/[0.06] ring-2 ring-sky-500">
						{story.media && <img src={story.media} alt="" className="h-full w-full object-cover" />}
					</span>
					<span className="w-full truncate text-center text-[10.5px] text-white/50">{story.name}</span>
				</button>
			))}
		</div>
	);
}

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
					onClick={() => repost(post.id)}
					activeClass="text-emerald-400"
				/>
				<Action icon={FavouriteIcon} count={post.likes} active={post.liked} onClick={() => toggleLike(post.id)} />
			</div>
		</article>
	);
}

function Live() {
	const streams = useLifeinvaderStore((s) => s.live);
	const [open, setOpen] = useState(null);

	if (streams.length === 0) {
		return <Empty icon={Video01Icon} label="Nobody is live" hint="Streams show up here while they run." />;
	}

	return (
		<div className="px-4 py-3">
			{streams.map((stream) => (
				<div key={stream.id} className="mb-4">
					{open === stream.id && stream.url ? (
						<Media src={stream.url} />
					) : (
						<button
							onClick={() => setOpen(stream.id)}
							className="relative block w-full overflow-hidden rounded-2xl bg-white/[0.06]"
						>
							{stream.thumb ? (
								<img src={stream.thumb} alt="" className="aspect-video w-full object-cover" />
							) : (
								<span className="grid aspect-video w-full place-items-center text-white/20">
									<HugeiconsIcon icon={Video01Icon} size={26} strokeWidth={1.4} />
								</span>
							)}

							<span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-md bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
								<span className="h-1.5 w-1.5 rounded-full bg-white" /> Live
							</span>

							<span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10.5px] font-bold text-white">
								<HugeiconsIcon icon={UserIcon} size={10} strokeWidth={2.4} />
								{stream.viewers}
							</span>
						</button>
					)}

					<div className="mt-2 flex items-center gap-2.5">
						<Face src={stream.avatar} name={stream.name} size="h-8 w-8" text="text-[12px]" />
						<div className="min-w-0 flex-1">
							<div className="truncate text-[13.5px] font-bold text-white">{stream.title}</div>
							<div className="truncate text-[12px] text-white/35">
								{stream.name} · @{stream.handle}
							</div>
						</div>
					</div>
				</div>
			))}
		</div>
	);
}

export default function Feed({ onAddStory, onOpenPost }) {
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
			<Tabs tabs={TABS} value={tab} onChange={setTab} className="border-b border-white/[0.07] px-2" />

			<div className="royal-scroll min-h-0 flex-1 overflow-y-auto">
				{tab === 'live' ? (
					<Live />
				) : (
					<>
						<Stories onAdd={onAddStory} />

						{shown.length === 0 ? (
							<Empty
								icon={Message01Icon}
								label={tab === 'following' ? 'Nothing from your follows' : 'Nothing here yet'}
								hint={
									tab === 'following'
										? 'Follow people to fill this feed.'
										: 'Be the first to post something.'
								}
							/>
						) : (
							shown.map((item) => <Post key={item.id} post={item} onOpen={() => onOpenPost(item.id)} />)
						)}
					</>
				)}
			</div>
		</div>
	);
}
