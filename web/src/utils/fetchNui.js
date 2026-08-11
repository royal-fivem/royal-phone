import isEnvBrowser from './isEnvBrowser';

/**
 * Call a RegisterNUICallback on the Lua side.
 * In the browser the request is skipped entirely and `mock` is returned, so the
 * UI can be developed with `npm run dev` without a running server.
 *
 * @template T
 * @param {string} event   callback name registered in client/main.lua
 * @param {any}    [data]  payload
 * @param {T}      [mock]  value resolved when running outside FiveM
 * @returns {Promise<T>}
 */
export default async function fetchNui(event, data = {}, mock = undefined) {
	if (isEnvBrowser()) {
		// Keep the same async shape as the real call so callers behave identically.
		return new Promise((resolve) => setTimeout(() => resolve(mock), 60));
	}

	// @ts-ignore
	const resource = window.GetParentResourceName ? window.GetParentResourceName() : 'royal-phone';

	try {
		const response = await fetch(`https://${resource}/${event}`, {
			method: 'post',
			headers: { 'Content-Type': 'application/json; charset=UTF-8' },
			body: JSON.stringify(data),
		});

		return await response.json();
	} catch {
		return mock;
	}
}
