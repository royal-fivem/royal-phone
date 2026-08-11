import { useEffect, useRef } from 'react';

/**
 * Subscribe to a single `SendNUIMessage({ action, data })` action.
 * The handler is kept in a ref so re-renders never re-bind the window listener.
 *
 * @param {string} action
 * @param {(data: any) => void} handler
 */
export default function useNuiEvent(action, handler) {
	const saved = useRef(handler);
	saved.current = handler;

	useEffect(() => {
		const listener = (event) => {
			const message = event.data;
			if (!message || message.action !== action) return;
			saved.current(message.data);
		};

		window.addEventListener('message', listener);
		return () => window.removeEventListener('message', listener);
	}, [action]);
}
