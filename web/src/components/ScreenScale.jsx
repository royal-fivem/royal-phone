import React, { useLayoutEffect, useRef, useState } from 'react';

import { cssVars } from '../utils/usePhoneMetrics';

/**
 * Width the app screens were laid out against, in CSS pixels. Raised from the
 * design's 356 so Quantico — which sets noticeably wider than the grotesque the
 * screens were typed in — renders proportionally smaller and still fits.
 */
export const REFERENCE_WIDTH = 380;

export const scaleFor = (panelWidth) => (panelWidth || REFERENCE_WIDTH) / REFERENCE_WIDTH;

/**
 * Scales app content with the device.
 *
 * The home screen sizes everything off `--pw`, but app screens are ordinary
 * typography — at the smallest setting they would keep 15px text inside a 230px
 * phone. `zoom` scales layout rather than painting over it, so scroll
 * containers and hit testing stay correct where a transform would break them.
 *
 * Sizing is measured from the parent and written back in pixels: Chromium
 * changed how percentages resolve inside a zoomed box, but a pixel length is
 * multiplied by the zoom factor under both behaviours.
 *
 * Inside the subtree `--pw` is rebased to the reference width, so `--status-h`
 * and friends stay correct once zoom has multiplied them back out.
 *
 * IMPORTANT: nothing inside may use framer-motion's `layout` prop or `drag`.
 * Both work off getBoundingClientRect, which reports zoomed coordinates, while
 * the transforms they write are applied in the element's own scaled space — the
 * element ends up flying off by the zoom factor. Animate `x`/`y` explicitly
 * instead, and keep draggable UI outside this wrapper.
 *
 * @param {{ panelWidth: number }} props width of one folded panel
 */
export default function ScreenScale({ panelWidth, children, className = '', style }) {
	const ref = useRef(null);
	const [box, setBox] = useState(null);

	useLayoutEffect(() => {
		const parent = ref.current?.parentElement;
		if (!parent) return;

		const read = ({ width, height }) =>
			setBox((current) => (current && current.width === width && current.height === height ? current : { width, height }));

		read(parent.getBoundingClientRect());

		const observer = new ResizeObserver(([entry]) => read(entry.contentRect));

		observer.observe(parent);
		return () => observer.disconnect();
	}, []);

	const scale = scaleFor(panelWidth);

	return (
		<div
			ref={ref}
			className={className}
			style={{
				zoom: scale,
				width: box ? box.width / scale : '100%',
				height: box ? box.height / scale : '100%',
				...cssVars(REFERENCE_WIDTH),
				...style,
			}}
		>
			{children}
		</div>
	);
}
