import { useEffect, useState } from 'react';

/**
 * Seconds a call has been connected. Derived from `startedAt` rather than an
 * incrementing counter, so it stays correct across mounts — the status bar pill
 * and the full-screen overlay each mount and unmount independently while the
 * same call runs.
 *
 * @param {number|null|undefined} connectedAt epoch ms the call connected
 */
export default function useCallTimer(connectedAt) {
	const [seconds, setSeconds] = useState(() =>
		connectedAt ? Math.max(0, Math.floor((Date.now() - connectedAt) / 1000)) : 0
	);

	useEffect(() => {
		if (!connectedAt) {
			setSeconds(0);
			return;
		}

		const tick = () => setSeconds(Math.max(0, Math.floor((Date.now() - connectedAt) / 1000)));

		tick();
		const id = setInterval(tick, 1000);

		return () => clearInterval(id);
	}, [connectedAt]);

	return seconds;
}

export const formatDuration = (seconds) =>
	`${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
