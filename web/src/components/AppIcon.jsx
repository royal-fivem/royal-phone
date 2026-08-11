import React, { memo, useRef, useState } from 'react';
import { motion, useDragControls } from 'framer-motion';

import AppGlyph from './AppGlyph';

const LONG_PRESS_MS = 320;

/**
 * A single home screen icon.
 *
 * Dragging is gated behind a long press: `dragListener` is off and the press
 * timer hands the original pointer event to `dragControls.start`, so the icon
 * picks up mid-gesture without the user releasing and grabbing again.
 *
 * Every dimension comes from the `--*` custom properties the frame publishes,
 * which is what keeps the grid on the reference proportions at any resolution.
 *
 * The grid paints in one frame: no entrance animation, and `layout` is enabled
 * only while editing. Left on permanently it measures against the phone frame
 * — which is itself springing on open — and every icon animates to its own slot
 * independently, so the grid appears to assemble itself. Scoped to edit mode the
 * frame is long since settled, and reordering slides properly.
 */
function AppIcon({
	app,
	badge = 0,
	editMode,
	onOpen,
	onEnterEdit,
	onDrag,
	onDragEnd,
	compact = false,
}) {
	const controls = useDragControls();
	const timer = useRef(null);
	const moved = useRef(false);
	const [dragging, setDragging] = useState(false);

	const size = compact ? 'var(--dock-icon)' : 'var(--icon)';

	const cancelPress = () => {
		clearTimeout(timer.current);
		timer.current = null;
	};

	const pointerDown = (event) => {
		if (event.button !== 0) return;
		moved.current = false;

		const native = event.nativeEvent ?? event;

		timer.current = setTimeout(() => {
			onEnterEdit?.();
			controls.start(native);
		}, LONG_PRESS_MS);
	};

	// Handlers take the id so callers can pass stable references and let the
	// memo above actually do something.
	const click = () => {
		cancelPress();
		if (moved.current || editMode) return;
		onOpen?.(app.id);
	};

	return (
		<motion.button
			layout={editMode ? 'position' : false}
			drag
			dragListener={false}
			dragControls={controls}
			dragSnapToOrigin
			dragMomentum={false}
			dragElastic={0.15}
			onPointerDown={pointerDown}
			onPointerUp={cancelPress}
			onPointerCancel={cancelPress}
			onPointerLeave={cancelPress}
			onClick={click}
			onDragStart={() => {
				moved.current = true;
				setDragging(true);
			}}
			onDrag={(event, info) => onDrag?.(app.id, info)}
			onDragEnd={(event, info) => {
				setDragging(false);
				onDragEnd?.(app.id, info);
				// Let the click handler see the drag before it resets.
				setTimeout(() => {
					moved.current = false;
				}, 0);
			}}
			initial={false}
			whileTap={editMode ? undefined : { scale: 0.92 }}
			whileDrag={{ scale: 1.12, zIndex: 60, cursor: 'grabbing' }}
			// The jiggle is suppressed on the icon being dragged so the wobble
			// transform never fights the drag transform.
			animate={
				editMode && !dragging
					? { rotate: [-1.2, 1.2, -1.2], transition: { duration: 0.3, repeat: Infinity, ease: 'easeInOut' } }
					: { rotate: 0 }
			}
			transition={{ layout: { type: 'spring', stiffness: 500, damping: 40, mass: 0.6 } }}
			className="relative flex min-w-0 touch-none select-none flex-col items-center outline-none"
		>
			<div className="relative" style={{ width: size, height: size }}>
				<AppGlyph app={app} />

				{badge > 0 && (
					<span
						className="absolute grid place-items-center rounded-full bg-rose-600 font-bold leading-none text-white"
						style={{
							top: 'calc(var(--pw) * -0.014)',
							right: 'calc(var(--pw) * -0.014)',
							height: 'calc(var(--pw) * 0.048)',
							minWidth: 'calc(var(--pw) * 0.048)',
							paddingInline: 'calc(var(--pw) * 0.008)',
							fontSize: 'calc(var(--pw) * 0.028)',
						}}
					>
						{badge > 99 ? '99+' : badge}
					</span>
				)}
			</div>

			{!compact && (
				// Names spill past the tile — the reference lets "Lifeinvader" run
				// wider — but stop just short of the column pitch so neighbouring
				// labels can never collide.
				<span
					className="truncate text-center font-medium leading-none text-white"
					style={{
						fontSize: 'var(--label)',
						marginTop: 'var(--label-gap)',
						maxWidth: 'calc(var(--icon) * 1.24)',
					}}
				>
					{app.label}
				</span>
			)}
		</motion.button>
	);
}

// The grid re-renders on every page change and drag; an icon only needs to
// repaint when its own inputs move.
export default memo(AppIcon);
