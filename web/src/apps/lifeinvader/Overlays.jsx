import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, SentIcon, Image01Icon, LinkSquare01Icon } from '@hugeicons/core-free-icons';

import { Face } from './parts';
import Media from './Media';
import { Post } from './Feed';
import useDataStore from '../../state/dataStore';
import useLifeinvaderStore from '../../state/lifeinvaderStore';
import { formatRelative } from '../../utils/format';

const sheet = 'absolute inset-0 z-30 flex flex-col bg-[#07080c]';
const chrome = { paddingTop: 'var(--status-h)', paddingBottom: 'var(--chrome-b)' };

const slide = {
	initial: { y: '100%' },
	animate: { y: 0 },
	exit: { y: '100%' },
	transition: { type: 'spring', stiffness: 460, damping: 42, mass: 0.7 },
};

export function Thread({ post, onClose }) {
	const comment = useLifeinvaderStore((s) => s.comment);
	const [draft, setDraft] = useState('');

	const submit = (event) => {
		event.preventDefault();
		if (!draft.trim()) return;

		comment(post.id, draft);
		setDraft('');
	};

	return (
		<motion.div {...slide} className={sheet} style={chrome}>
			<header className="flex shrink-0 items-center gap-3 border-b border-white/[0.07] px-4 py-2.5">
				<button onClick={onClose} className="text-white/70 transition hover:text-white">
					<HugeiconsIcon icon={Cancel01Icon} size={19} strokeWidth={2} />
				</button>
				<span className="text-[14.5px] font-bold text-white">Post</span>
			</header>

			<div className="royal-scroll min-h-0 flex-1 overflow-y-auto">
				<Post post={post} onOpen={() => {}} />

				{post.comments.length === 0 ? (
					<p className="px-4 py-6 text-center text-[12.5px] text-white/30">No replies yet</p>
				) : (
					post.comments.map((item) => (
						<div key={item.id} className="flex gap-2.5 border-b border-white/[0.04] px-4 py-3">
							<Face name={item.name} size="h-8 w-8" text="text-[12px]" />
							<div className="min-w-0 flex-1">
								<div className="flex items-baseline gap-1.5">
									<span className="truncate text-[13px] font-bold text-white">{item.name}</span>
									<span className="truncate text-[11.5px] text-white/30">@{item.handle}</span>
									<span className="ml-auto shrink-0 text-[11px] text-white/25">
										{formatRelative(item.createdAt)}
									</span>
								</div>
								<p className="mt-0.5 break-words text-[13px] text-white/80">{item.text}</p>
							</div>
						</div>
					))
				)}
			</div>

			<form
				onSubmit={submit}
				className="flex shrink-0 items-center gap-2 border-t border-white/[0.07] px-3 py-3"
			>
				<input
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					placeholder="Post your reply"
					className="min-w-0 flex-1 rounded-full bg-white/[0.07] px-4 py-2.5 text-[13.5px] text-white outline-none placeholder:text-white/30"
				/>
				<button
					type="submit"
					disabled={!draft.trim()}
					className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sky-500 text-white disabled:opacity-30"
				>
					<HugeiconsIcon icon={SentIcon} size={17} strokeWidth={2} />
				</button>
			</form>
		</motion.div>
	);
}

export function Compose({ onClose }) {
	const post = useLifeinvaderStore((s) => s.post);
	const me = useLifeinvaderStore((s) => s.me());
	const photos = useDataStore((s) => s.photos);

	const [text, setText] = useState('');
	const [media, setMedia] = useState(null);
	const [link, setLink] = useState('');
	const [showLink, setShowLink] = useState(false);

	const submit = async (event) => {
		event.preventDefault();
		if (!text.trim() && !media) return;

		await post({ text, media });
		onClose();
	};

	return (
		<motion.form onSubmit={submit} {...slide} className={sheet} style={chrome}>
			<header className="flex shrink-0 items-center gap-3 px-4 py-2.5">
				<button type="button" onClick={onClose} className="text-white/70 transition hover:text-white">
					<HugeiconsIcon icon={Cancel01Icon} size={19} strokeWidth={2} />
				</button>

				<span className="flex-1 text-[14.5px] font-bold text-white">New post</span>

				<button
					type="submit"
					disabled={!text.trim() && !media}
					className="rounded-full bg-sky-500 px-4 py-1.5 text-[13px] font-bold text-white disabled:opacity-30"
				>
					Post
				</button>
			</header>

			<div className="royal-scroll min-h-0 flex-1 overflow-y-auto px-4">
				<div className="flex gap-2.5">
					<Face src={me?.avatar} name={me?.name} />
					<textarea
						value={text}
						onChange={(e) => setText(e.target.value)}
						placeholder="What's happening?"
						autoFocus
						maxLength={280}
						className="min-h-[96px] w-full resize-none bg-transparent text-[14.5px] text-white outline-none placeholder:text-white/25"
					/>
				</div>

				{media && (
					<div className="relative mt-2">
						<Media src={media} />
						<button
							type="button"
							onClick={() => setMedia(null)}
							className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/70 text-white"
						>
							<HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={2.4} />
						</button>
					</div>
				)}

				{showLink && (
					<div className="mt-2 flex gap-2">
						<input
							value={link}
							onChange={(e) => setLink(e.target.value)}
							placeholder="Paste an image, video or YouTube link"
							spellCheck={false}
							className="min-w-0 flex-1 rounded-xl bg-white/[0.07] px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/25"
						/>
						<button
							type="button"
							onClick={() => {
								setMedia(link.trim() || null);
								setLink('');
								setShowLink(false);
							}}
							disabled={!link.trim()}
							className="shrink-0 rounded-xl bg-white px-3 py-2 text-[12.5px] font-bold text-black disabled:opacity-30"
						>
							Attach
						</button>
					</div>
				)}
			</div>

			<div className="shrink-0 border-t border-white/[0.07] px-3 py-2.5">
				<div className="mb-1.5 flex items-center gap-3 text-white/40">
					<span className="flex items-center gap-1.5">
						<HugeiconsIcon icon={Image01Icon} size={16} strokeWidth={2} />
						<span className="text-[11.5px] font-bold uppercase tracking-[0.14em]">Gallery</span>
					</span>

					<button
						type="button"
						onClick={() => setShowLink((v) => !v)}
						className={`flex items-center gap-1.5 transition ${showLink ? 'text-sky-400' : 'hover:text-white'}`}
					>
						<HugeiconsIcon icon={LinkSquare01Icon} size={16} strokeWidth={2} />
						<span className="text-[11.5px] font-bold uppercase tracking-[0.14em]">Link</span>
					</button>

					<span className="ml-auto text-[11.5px] tabular-nums text-white/30">{text.length}/280</span>
				</div>

				{photos.length === 0 ? (
					<p className="py-2 text-[12.5px] text-white/30">No photos yet.</p>
				) : (
					<div className="royal-scroll flex gap-2 overflow-x-auto pb-1">
						{photos.map((photo, index) => (
							<button
								key={`${photo.takenAt}-${index}`}
								type="button"
								onClick={() => setMedia(media === photo.url ? null : photo.url)}
								className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white/[0.06] ring-2 transition ${
									media === photo.url ? 'ring-sky-500' : 'ring-transparent'
								}`}
							>
								{photo.url && <img src={photo.url} alt="" className="h-full w-full object-cover" />}
							</button>
						))}
					</div>
				)}
			</div>
		</motion.form>
	);
}

