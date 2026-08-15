import React, { useCallback } from 'react';

import AppIcon from './AppIcon';
import usePhoneStore from '../state/phoneStore';
import { getApp } from '../config/apps';
import { clamp } from '../utils/format';

export default function Dock({ dockRef, badges }) {
	const dock = usePhoneStore((s) => s.dock);
	const editMode = usePhoneStore((s) => s.editMode);
	const openApp = usePhoneStore((s) => s.openApp);
	const setEditMode = usePhoneStore((s) => s.setEditMode);
	const moveToDock = usePhoneStore((s) => s.moveToDock);
	const moveApp = usePhoneStore((s) => s.moveApp);

	const onDragEnd = useCallback(
		(id, info) => {
			const rect = dockRef.current?.getBoundingClientRect();
			if (!rect) return;

			if (info.point.y < rect.top) {
				const { page, pages } = usePhoneStore.getState();
				moveApp(id, page, pages[page]?.length ?? 0);
				return;
			}

			const slot = clamp(Math.floor(((info.point.x - rect.left) / rect.width) * 4), 0, 3);
			moveToDock(id, slot);
		},
		[dockRef, moveApp, moveToDock]
	);

	const onOpen = useCallback((id, origin) => openApp(id, null, origin), [openApp]);
	const onEnterEdit = useCallback(() => setEditMode(true), [setEditMode]);

	return (
		<div
			ref={dockRef}
			className="mx-auto flex w-full shrink-0 items-center justify-between"
			style={{
				maxWidth: 'var(--pw)',
				paddingInline: 'var(--pad)',
				paddingBottom: 'calc(var(--pw) * 0.03)',
			}}
		>
			{dock.map((id) => {
				const app = getApp(id);
				if (!app) return null;

				return (
					<AppIcon
						key={id}
						app={app}
						compact
						badge={badges?.[id] ?? 0}
						editMode={editMode}
						onOpen={onOpen}
						onEnterEdit={onEnterEdit}
						onDragEnd={onDragEnd}
					/>
				);
			})}
		</div>
	);
}
