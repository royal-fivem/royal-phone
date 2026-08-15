import React, { useMemo, useRef } from 'react';

import AppGrid from './AppGrid';
import Dock from './Dock';
import usePhoneStore from '../state/phoneStore';
import useDataStore from '../state/dataStore';
import useNotifyStore from '../state/notifyStore';
import { columnsFor } from '../utils/usePhoneMetrics';

function useBadges() {
	const messages = useDataStore((s) => s.messages);
	const calls = useDataStore((s) => s.calls);
	const number = useDataStore((s) => s.number);
	const history = useNotifyStore((s) => s.history);

	return useMemo(() => {
		const badges = {
			messages: messages.filter((m) => m.receiver === number && !m.read).length,
			dialer: calls.filter((c) => c.receiver === number && !c.answered).length,
		};

		for (const notification of history) {
			if (notification.read || !notification.app) continue;
			badges[notification.app] = (badges[notification.app] ?? 0) + 1;
		}

		return badges;
	}, [messages, calls, number, history]);
}

export default function HomeScreen({ screenRef, metrics }) {
	const expanded = usePhoneStore((s) => s.expanded);
	const editMode = usePhoneStore((s) => s.editMode);
	const setEditMode = usePhoneStore((s) => s.setEditMode);

	const badges = useBadges();
	const dockRef = useRef(null);

	const columns = columnsFor(expanded ? metrics.expandedWidth : metrics.width, metrics.width);

	return (
		<div className="relative flex min-h-0 flex-1 flex-col">

			{editMode && <div className="absolute inset-0 z-0" onClick={() => setEditMode(false)} />}

			<AppGrid screenRef={screenRef} dockRef={dockRef} badges={badges} columns={columns} />
			<Dock dockRef={dockRef} badges={badges} />
		</div>
	);
}
