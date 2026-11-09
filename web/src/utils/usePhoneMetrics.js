import { useEffect, useState } from 'react';
import { clamp } from './format';

const ASPECT = 0.482;

const MARGIN = 0.035;

export const EXPAND_FACTOR = 3;

export const RATIOS = {
	pad: 0.062,
	icon: 0.181,
	gapX: 0.048,
	gapY: 0.062,

	label: 0.029,
	labelGap: 0.023,
	dockIcon: 0.193,

	radius: 0.026,
	statusH: 0.175,

	chromeB: 0.085,
	indicatorW: 0.31,
};

const CARD_BOTTOM = RATIOS.statusH * 0.84 + 0.157;

const PEEK_PAD = 5;

// How much of the phone a notification peek shows past the first card's
// nominal bottom: room for a two-line toast plus a strip of screen below it,
// so the card is never cut off at the edge of the monitor.
const PEEK_EXTRA = 0.085;
const PEEK_EXTRA_PAD = 10;

export const SIZE_MIN = 100;
export const SIZE_MAX = 130;

const BASE_SCALE = 0.8;

/** @param {number} scale 1 = the default size, driven by Settings › Zoom */
const measure = (scale = 1) => {
	const vw = window.innerWidth;
	const vh = window.innerHeight;

	const base = clamp(vh * 0.8, 480, 920) * BASE_SCALE;
	const height = Math.round(clamp(base * scale, 360, vh - 24));
	const width = Math.round(height * ASPECT);

	const margin = Math.max(32, Math.round(vw * MARGIN));

	const expandedWidth = Math.min(width * EXPAND_FACTOR, vw - margin * 2);

	const cardVisible = Math.round(width * CARD_BOTTOM) + PEEK_PAD;
	const peekVisible = Math.round(width * (CARD_BOTTOM + PEEK_EXTRA)) + PEEK_EXTRA_PAD;
	const callVisible = Math.max(
		Math.round(cardVisible * 0.5),
		Math.round(width * RATIOS.statusH) + 4
	);

	return {
		width,
		height,
		expandedWidth,

		top: Math.max(8, vh - margin - height),

		peekTop: vh - peekVisible,

		callTop: vh - callVisible,

		offscreenTop: vh,
		collapsedX: vw - margin - width,
		expandedX: Math.round((vw - expandedWidth) / 2),
	};
};

const BASE_COLUMNS = 4;

/**
 * How many columns fit in `frameWidth`, using the folded grid's own column
 * pitch. Rounded down to a multiple of four so an unfolded page still reads as
 * whole phone-widths side by side — and so a clamped fold (a viewport too
 * narrow for a true 3×) degrades to 8 columns instead of squashing 12.
 *
 * @param {number} frameWidth current width of the device
 * @param {number} panelWidth width of one folded panel
 */
export const columnsFor = (frameWidth, panelWidth) => {
	const pitch = panelWidth * (RATIOS.icon + RATIOS.gapX);
	const usable = frameWidth - panelWidth * RATIOS.pad * 2 + panelWidth * RATIOS.gapX;

	const fits = Math.floor(usable / pitch);

	return Math.max(BASE_COLUMNS, Math.floor(fits / BASE_COLUMNS) * BASE_COLUMNS);
};

export const cssVars = (width) => {
	const px = (ratio) => `${+(width * ratio).toFixed(2)}px`;

	return {
		'--pw': `${width}px`,
		'--pad': px(RATIOS.pad),
		'--icon': px(RATIOS.icon),
		'--gap-x': px(RATIOS.gapX),
		'--gap-y': px(RATIOS.gapY),
		'--label': px(RATIOS.label),
		'--label-gap': px(RATIOS.labelGap),
		'--dock-icon': px(RATIOS.dockIcon),
		'--radius': px(RATIOS.radius),
		'--status-h': px(RATIOS.statusH),
		'--chrome-b': px(RATIOS.chromeB),
		'--indicator-w': px(RATIOS.indicatorW),
	};
};

/**
 * Viewport-derived geometry for the phone frame. Recomputed on resize and when
 * the size setting changes — the fold animation itself runs on springs.
 *
 * @param {number} scale 1 = default size
 */
export default function usePhoneMetrics(scale = 1) {
	const [metrics, setMetrics] = useState(() => measure(scale));

	useEffect(() => {
		let frame = 0;

		const update = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => setMetrics(measure(scale)));
		};

		update();
		window.addEventListener('resize', update);

		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener('resize', update);
		};
	}, [scale]);

	return metrics;
}
