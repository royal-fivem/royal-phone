import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Notification03Icon } from '@hugeicons/core-free-icons';

import { imageFor } from '../config/appImages';

/**
 * An app's tile artwork: the `.webp` from `src/assets/icons/` if one exists,
 * otherwise the gradient + Hugeicons glyph. Fills its parent, so the caller
 * owns the size.
 *
 * @param {{ app: object, radius?: string, glyph?: string }} props
 */
export default function AppGlyph({ app, radius = '29%', glyph = '54%', className = '' }) {
	const image = imageFor(app?.image ?? app?.id);

	if (image) {
		return (
			<img
				src={image}
				alt=""
				draggable={false}
				decoding="async"
				className={`h-full w-full select-none object-cover ${className}`}
				style={{ borderRadius: radius }}
			/>
		);
	}

	return (
		<div
			className={`grid h-full w-full place-items-center ${app?.gradient ?? 'bg-white/10'} ${className}`}
			style={{ borderRadius: radius }}
		>
			<HugeiconsIcon
				icon={app?.icon ?? Notification03Icon}
				size={26}
				strokeWidth={1.7}
				color="#ffffff"
				className="drop-shadow"
				style={{ width: glyph, height: glyph }}
			/>
		</div>
	);
}
