import React, { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlayIcon, LinkSquare01Icon } from '@hugeicons/core-free-icons';

import { parseMedia, youtubeEmbed, youtubeThumb } from '../../utils/embed';

export default function Media({ src, className = '' }) {
	const [playing, setPlaying] = useState(false);
	const media = parseMedia(src);

	if (!media) return null;

	if (media.kind === 'youtube') {
		return (
			<div className={`relative overflow-hidden rounded-2xl bg-black ${className}`}>
				{playing ? (
					<iframe
						src={`${youtubeEmbed(media.id)}&autoplay=1`}
						title="YouTube"
						allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
						allowFullScreen
						className="aspect-video w-full"
					/>
				) : (
					<button onClick={() => setPlaying(true)} className="relative block w-full">
						<img
							src={youtubeThumb(media.id)}
							alt=""
							className="aspect-video w-full object-cover"
							loading="lazy"
						/>

						<span className="absolute inset-0 grid place-items-center bg-black/25">
							<span className="grid h-12 w-12 place-items-center rounded-full bg-rose-600 text-white shadow-lg">
								<HugeiconsIcon icon={PlayIcon} size={22} strokeWidth={2.4} />
							</span>
						</span>
					</button>
				)}
			</div>
		);
	}

	if (media.kind === 'video') {
		return (
			<video
				src={media.url}
				controls
				playsInline
				preload="metadata"
				className={`max-h-[260px] w-full rounded-2xl bg-black object-contain ${className}`}
			/>
		);
	}

	if (media.kind === 'image') {
		return (
			<img
				src={media.url}
				alt=""
				loading="lazy"
				className={`max-h-[260px] w-full rounded-2xl object-cover ${className}`}
			/>
		);
	}

	return (
		<div
			className={`flex items-center gap-2.5 rounded-2xl border border-white/[0.09] bg-white/[0.04] px-3 py-2.5 ${className}`}
		>
			<HugeiconsIcon icon={LinkSquare01Icon} size={16} strokeWidth={2} className="shrink-0 text-white/40" />
			<span className="min-w-0 flex-1 truncate text-[12.5px] text-sky-400">{media.url}</span>
		</div>
	);
}
