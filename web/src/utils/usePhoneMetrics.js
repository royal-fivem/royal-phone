import { useEffect, useState } from 'react';
import { clamp } from './format';

/**
 * Geometry is expressed as fractions of the closed phone's width so the whole
 * UI keeps the reference proportions at any resolution. Values were measured
 * off the design: a 356px-wide screen with 33px side padding, 58px tiles and
 * 19px gutters.
 */
const ASPECT = 0.482;
/** Distance from the right edge when the phone is closed. */
const MARGIN = 0.035;
/** Width multiplier when the phone is flipped open. */
export const EXPAND_FACTOR = 3;

/** Fractions of `--pw`, straight off the reference. */
export const RATIOS = {
	// Tighter margin and larger tiles than the reference: the grid runs closer
	// to the bezel. 2·pad + 4·icon + 3·gapX has to stay just under 1.
	pad: 0.062,
	icon: 0.181,
	gapX: 0.048,
	gapY: 0.062,
	/** Trimmed a touch for Quantico, which sets wider than a grotesque. */
	label: 0.029,
	labelGap: 0.023,
	dockIcon: 0.193,
	/** Near-square body. The app tiles carry all the roundness. */
	radius: 0.026,
	statusH: 0.175,
	/** Height reserved for the home indicator strip. */
	chromeB: 0.085,
	indicatorW: 0.31,
};

/**
 * Where the bottom of a toast (or the call card) sits, as a fraction of `--pw`.
 *
 * Both are pinned at `--status-h * 0.84` and are one line tall — see
 * NotificationStack and CallCard, which share the padding and avatar size. This
 * is what peek height is measured against: peek exists to show the banner, so it
 * should stop just under it rather than lifting a third of the phone into view.
 */
const CARD_BOTTOM = RATIOS.statusH * 0.84 + 0.157;

/** Breathing room under the card when peeking. */
const PEEK_PAD = 5;

/** Size bounds in percent. 100% is the default frame; it only scales up. */
export const SIZE_MIN = 100;
export const SIZE_MAX = 130;

/**
 * Folded into the viewport calculation so 100% lands on the size the phone
 * already shipped at, rather than making everyone's saved setting jump.
 */
const BASE_SCALE = 0.8;

/** @param {number} scale 1 = the default size, driven by Settings › Zoom */
const measure = (scale = 1) => {
	const vw = window.innerWidth;
	const vh = window.innerHeight;

	const base = clamp(vh * 0.8, 480, 920) * BASE_SCALE;
	const height = Math.round(clamp(base * scale, 360, vh - 24));
	const width = Math.round(height * ASPECT);

	const margin = Math.max(32, Math.round(vw * MARGIN));

	// Three panels wide, unless the viewport cannot hold that — then the
	// unfolded phone stops at the screen edges rather than running off them.
	const expandedWidth = Math.min(width * EXPAND_FACTOR, vw - margin * 2);

	const peekVisible = Math.round(width * CARD_BOTTOM) + PEEK_PAD;
	const callVisible = Math.max(
		Math.round(peekVisible * 0.5),
		Math.round(width * RATIOS.statusH) + 4
	);

	return {
		width,
		height,
		expandedWidth,
		// Rests in the bottom-right corner with the same gap on both edges, but
		// never pushed off the top on a short viewport at the largest size.
		top: Math.max(8, vh - margin - height),
		// Just enough to clear the banner, measured off the card rather than a
		// fraction of the phone — the old height-based figure lifted roughly a
		// third of the device into view for a one-line toast.
		peekTop: vh - peekVisible,
		// Call mode is half that, but never so short that the status bar with its
		// green chip is clipped — that chip is the whole point of the mode.
		callTop: vh - callVisible,
		// Fully below the viewport — where the phone slides in from and back to.
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

/** CSS custom properties every child sizes itself from. */
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
