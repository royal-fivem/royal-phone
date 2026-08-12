import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import AppIcon from './AppIcon';
import usePhoneStore, { GRID_ROWS, PAGE_SIZE, chunk } from '../state/phoneStore';
import { getApp } from '../config/apps';
import { clamp } from '../utils/format';

/** Width of the page-flip hot zone on each side of the screen. */
const EDGE = 44;
/** How long an icon has to sit in the hot zone before the page turns. */
const EDGE_DWELL_MS = 550;

const PAGE_SPRING = { type: 'spring', stiffness: 380, damping: 40, mass: 0.6 };

/**
 * Direction-aware slide. Only the current page is mounted, which keeps layout
 * animations from fighting a transformed track — the source of most of the
 * jitter in a naive carousel.
 */
const variants = {
	enter: (dir) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
	center: { x: 0, opacity: 1 },
	exit: (dir) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
};

export default function AppGrid({ screenRef, dockRef, badges, columns }) {
	const pages = usePhoneStore((s) => s.pages);
	const page = usePhoneStore((s) => s.page);
	const editMode = usePhoneStore((s) => s.editMode);
	const setPage = usePhoneStore((s) => s.setPage);
	const setEditMode = usePhoneStore((s) => s.setEditMode);
	const openApp = usePhoneStore((s) => s.openApp);
	const moveApp = usePhoneStore((s) => s.moveApp);
	const moveToDock = usePhoneStore((s) => s.moveToDock);
	const addPage = usePhoneStore((s) => s.addPage);

	const wide = columns > 4;
	const pageSize = columns * GRID_ROWS;

	/**
	 * Folded, the stored pages are shown as-is. Unfolded, the same order is
	 * flattened and re-chunked so it fills the wider grid — the arrangement is
	 * always persisted in the canonical folded shape.
	 */
	const view = useMemo(
		() => (wide ? chunk(pages.flat(), pageSize) : pages),
		[pages, wide, pageSize]
	);

	const [direction, setDirection] = useState(0);
	const [dragging, setDragging] = useState(false);
	const gridRef = useRef(null);
	const swipe = useRef(null);
	const dwell = useRef({ side: null, timer: null });
	/** Set when an edge-hold has already relocated the icon mid-gesture. */
	const handled = useRef(false);

	useEffect(() => {
		if (page > view.length - 1) setPage(view.length - 1);
	}, [view.length, page, setPage]);

	const clearDwell = () => {
		clearTimeout(dwell.current.timer);
		dwell.current = { side: null, timer: null };
	};

	useEffect(() => clearDwell, []);

	const goTo = (next, dir) => {
		const target = clamp(next, 0, view.length - 1);
		if (target === page) return;

		setDirection(dir ?? (target > page ? 1 : -1));
		setPage(target);
	};

	/** Translate a drop point into a page index and slot. */
	const slotAt = (info) => {
		const rect = gridRef.current?.getBoundingClientRect();
		if (!rect) return null;

		const col = clamp(Math.floor(((info.point.x - rect.left) / rect.width) * columns), 0, columns - 1);
		const row = clamp(Math.floor(((info.point.y - rect.top) / rect.height) * GRID_ROWS), 0, GRID_ROWS - 1);

		return row * columns + col;
	};

	/** Map a display page + slot back onto the canonical folded pages. */
	const toCanonical = (displayPage, slot) => {
		if (!wide) return { page: displayPage, slot };

		const flatIndex = displayPage * pageSize + slot;
		return { page: Math.floor(flatIndex / PAGE_SIZE), slot: flatIndex % PAGE_SIZE };
	};

	const edgeAt = (x) => {
		const rect = screenRef.current?.getBoundingClientRect();
		if (!rect) return null;

		if (x < rect.left + EDGE) return 'left';
		if (x > rect.right - EDGE) return 'right';
		return null;
	};

	/**
	 * Holding an icon against an edge turns the page under it — and past the
	 * last page, makes a new one. The icon is relocated at that moment (the
	 * gesture cannot survive its own element unmounting), so the drop is done.
	 */
	const onDrag = (id, info) => {
		if (handled.current) return;

		const side = edgeAt(info.point.x);
		if (!side) return clearDwell();
		if (dwell.current.side === side) return;

		clearDwell();
		dwell.current.side = side;

		dwell.current.timer = setTimeout(() => {
			const current = usePhoneStore.getState().page;

			const relocating = () => {
				handled.current = true;
				setDragging(false);
			};

			if (side === 'left') {
				if (current === 0) return;

				relocating();
				setDirection(-1);

				const { page: p, slot } = toCanonical(current - 1, pageSize - 1);
				moveApp(id, p, slot);
				return;
			}

			// Right edge: next page, creating one if we are on the last.
			const isLast = current >= view.length - 1;
			relocating();
			setDirection(1);

			if (isLast) {
				const created = addPage();
				moveApp(id, wide ? Math.floor((created * pageSize) / PAGE_SIZE) : created, 0);
				return;
			}

			const { page: p, slot } = toCanonical(current + 1, 0);
			moveApp(id, p, slot);
		}, EDGE_DWELL_MS);
	};

	const onDragStart = useCallback(() => setDragging(true), []);

	const onDragEnd = useCallback(
		(id, info) => {
			clearDwell();
			setDragging(false);

			if (handled.current) {
				handled.current = false;
				return;
			}

			// Dropped onto the dock.
			const dock = dockRef?.current?.getBoundingClientRect();
			if (dock && info.point.y > dock.top && info.point.x > dock.left && info.point.x < dock.right) {
				const slot = clamp(Math.floor(((info.point.x - dock.left) / dock.width) * 4), 0, 3);
				moveToDock(id, slot);
				return;
			}

			// Dropped on an edge without holding: treat as a plain move across.
			const side = edgeAt(info.point.x);
			if (side) {
				const target = side === 'left' ? page - 1 : page + 1;
				if (target < 0 || target > view.length - 1) return;

				setDirection(side === 'left' ? -1 : 1);
				const { page: p, slot } = toCanonical(target, side === 'left' ? pageSize - 1 : 0);
				moveApp(id, p, slot);
				return;
			}

			const slot = slotAt(info);
			if (slot === null) return;

			const { page: p, slot: s } = toCanonical(page, slot);
			moveApp(id, p, s);
		},
		[page, pageSize, columns, view.length, wide, dockRef, screenRef, moveApp, moveToDock]
	);

	const onOpen = useCallback((id, origin) => openApp(id, null, origin), [openApp]);
	const onEnterEdit = useCallback(() => setEditMode(true), [setEditMode]);

	// Flick left/right to page through.
	const pointerDown = (event) => {
		swipe.current = { x: event.clientX, y: event.clientY };
	};

	const pointerUp = (event) => {
		const start = swipe.current;
		swipe.current = null;
		if (!start || editMode) return;

		const dx = event.clientX - start.x;
		if (Math.abs(dx) < 70 || Math.abs(event.clientY - start.y) > 60) return;

		goTo(page + (dx < 0 ? 1 : -1));
	};

	const current = view[clamp(page, 0, view.length - 1)] ?? [];

	return (
		<div className="flex min-h-0 flex-1 flex-col" onPointerDown={pointerDown} onPointerUp={pointerUp}>
			<div className={`relative min-h-0 flex-1 ${dragging ? 'overflow-visible' : 'overflow-hidden'}`}>
				<AnimatePresence initial={false} custom={direction}>
					<motion.div
						key={page}
						custom={direction}
						variants={variants}
						initial="enter"
						animate="center"
						exit="exit"
						transition={PAGE_SPRING}
						className="absolute inset-0"
					>
						<div
							ref={gridRef}
							className="grid content-start"
							style={{
								gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
								gridTemplateRows: `repeat(${GRID_ROWS}, min-content)`,
								columnGap: 'var(--gap-x)',
								rowGap: 'var(--gap-y)',
								paddingInline: 'var(--pad)',
							}}
						>
							{current.map((id) => {
								const app = getApp(id);
								if (!app) return null;

								return (
									<AppIcon
										key={id}
										app={app}
										badge={badges?.[id] ?? 0}
										editMode={editMode}
										onOpen={onOpen}
										onEnterEdit={onEnterEdit}
										onDragStart={onDragStart}
										onDrag={onDrag}
										onDragEnd={onDragEnd}
									/>
								);
							})}
						</div>
					</motion.div>
				</AnimatePresence>
			</div>

			{/* page dots */}
			<div
				className="flex shrink-0 items-center justify-center"
				style={{ gap: 'calc(var(--pw) * 0.017)', paddingBlock: 'calc(var(--pw) * 0.028)' }}
			>
				{view.map((_, index) => (
					<button
						key={index}
						onClick={() => goTo(index)}
						className={`rounded-full transition-colors ${index === page ? 'bg-white' : 'bg-white/30 hover:bg-white/60'}`}
						style={{ height: 'calc(var(--pw) * 0.016)', width: 'calc(var(--pw) * 0.016)' }}
					/>
				))}
			</div>
		</div>
	);
}
