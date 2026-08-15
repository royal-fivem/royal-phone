import React, { memo, useRef, useState } from 'react';
import { motion, useDragControls } from 'framer-motion';

import AppGlyph from './AppGlyph';

const LONG_PRESS_MS = 320;

function AppIcon({
	app,
	badge = 0,
	editMode,
	onOpen,
	onEnterEdit,
	onDragStart,
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

	const click = (event) => {
		cancelPress();
		if (moved.current || editMode) return;

		const rect = event.currentTarget.getBoundingClientRect();
		onOpen?.(app.id, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
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
				onDragStart?.(app.id);
			}}
			onDrag={(event, info) => onDrag?.(app.id, info)}
			onDragEnd={(event, info) => {
				setDragging(false);
				onDragEnd?.(app.id, info);

				setTimeout(() => {
					moved.current = false;
				}, 0);
			}}
			initial={false}
			whileTap={editMode ? undefined : { scale: 0.92 }}
			whileDrag={{ scale: 1.12, zIndex: 60, cursor: 'grabbing' }}

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

export default memo(AppIcon);
