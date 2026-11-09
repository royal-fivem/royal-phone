/*
 * Royal Phone app SDK — include it before your own script:
 *
 *   <script src="royal-phone.js"></script>
 *
 * It talks to the phone (the page your app is framed in) over postMessage, and
 * to your own resource's RegisterNUICallback handlers over fetch. Opened
 * straight in a browser it fakes the phone, so the page can be built without
 * starting the game.
 *
 *   const phone = await RoyalPhone.ready();   // { number, name, job, route, ... }
 *   RoyalPhone.on('pong', (data) => ...);     // from the SendAppMessage exports
 *   RoyalPhone.notify({ title: 'Hi', content: 'From my app' });
 *   const contacts = await RoyalPhone.fetch('getContacts', {}, mockValue);
 *   RoyalPhone.close();
 */
(function () {
	'use strict';

	const host = location.hostname || '';

	// Pages served by FiveM are https://cfx-nui-<resource>/... or nui://<resource>/...
	const inGame = host.startsWith('cfx-nui-') || location.protocol === 'nui:';
	const framed = window.parent !== window;

	const resourceFromUrl = host.startsWith('cfx-nui-') ? host.slice('cfx-nui-'.length) : host || null;

	const listeners = {};
	let readyPromise = null;

	const state = {
		inGame,
		appId: null,
		resource: inGame ? resourceFromUrl : null,
		number: null,
		name: null,
		job: null,
		route: null,
		settings: {},
	};

	function emit(type, data) {
		for (const fn of listeners[type] || []) {
			try {
				fn(data);
			} catch (error) {
				console.error(`[royal-phone] listener for "${type}" failed`, error);
			}
		}
	}

	function send(type, data) {
		if (framed) window.parent.postMessage({ type, data }, '*');
	}

	function applyInsets(insets) {
		if (!insets) return;

		const root = document.documentElement.style;
		if (insets.top) root.setProperty('--rp-top', insets.top);
		if (insets.bottom) root.setProperty('--rp-bottom', insets.bottom);
	}

	function receive(type, data) {
		if (type === 'init') {
			Object.assign(state, {
				appId: data.appId ?? null,
				resource: data.resource || state.resource,
				number: data.number ?? null,
				name: data.name ?? null,
				job: data.job ?? null,
				route: data.route ?? null,
				settings: data.settings || {},
			});

			applyInsets(data.insets);
		}

		if (type === 'route') state.route = data ?? null;

		emit(type, data);
	}

	window.addEventListener('message', (event) => {
		if (framed && event.source !== window.parent) return;

		const { type, data } = event.data || {};
		if (typeof type === 'string') receive(type, data);
	});

	// The phone cannot see focus inside the frame, so it has to be told when a
	// field wants the keyboard — otherwise typing "w" walks the player forward.
	const editable = (node) =>
		node instanceof HTMLElement &&
		(node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.tagName === 'SELECT' || node.isContentEditable);

	document.addEventListener('focusin', (event) => {
		if (editable(event.target)) send('typing', { active: true });
	});

	document.addEventListener('focusout', () => send('typing', { active: false }));

	// Escape is caught here, not by the phone, while the frame has focus.
	document.addEventListener('keydown', (event) => {
		if (event.key !== 'Escape') return;
		event.preventDefault();

		if (document.activeElement && editable(document.activeElement)) {
			document.activeElement.blur();
			return;
		}

		if (listeners.back && listeners.back.length) emit('back');
		else send('back');
	});

	const RoyalPhone = {
		state,

		/** True inside the game; false in a browser (dev server or file). */
		get inGame() {
			return state.inGame;
		},

		/**
		 * Resolves once the phone has sent `init`. Outside the phone it resolves
		 * with placeholder data so the page still renders.
		 * @returns {Promise<typeof state>}
		 */
		ready() {
			if (readyPromise) return readyPromise;

			readyPromise = new Promise((resolve) => {
				const off = RoyalPhone.on('init', () => {
					off();
					resolve(state);
				});

				if (framed) send('ready');

				if (!inGame) {
					setTimeout(() => {
						if (state.number) return;
						receive('init', {
							appId: 'dev',
							resource: null,
							number: '555-0134',
							name: 'Dev Player',
							job: 'Unemployed',
							insets: framed ? null : { top: '44px', bottom: '28px' },
						});
					}, framed ? 400 : 50);
				}
			});

			return readyPromise;
		},

		/**
		 * Listen for a message: 'init', 'route', or any type your resource sends
		 * with exports['royal-phone']:SendAppMessage. Register 'back' to handle
		 * Escape yourself (closing a sub-screen); without one, Escape goes back
		 * to the home screen.
		 * @returns {() => void} unsubscribe
		 */
		on(type, fn) {
			(listeners[type] = listeners[type] || []).push(fn);
			return () => {
				listeners[type] = (listeners[type] || []).filter((f) => f !== fn);
			};
		},

		/**
		 * POST to a RegisterNUICallback in your own resource's client script.
		 * Outside the game resolves with `mock` instead.
		 */
		async fetch(event, data = {}, mock = undefined) {
			if (!inGame || !state.resource) {
				return new Promise((resolve) => setTimeout(() => resolve(mock), 80));
			}

			try {
				const response = await fetch(`https://${state.resource}/${event}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json; charset=UTF-8' },
					body: JSON.stringify(data ?? {}),
				});

				const text = await response.text();
				return text ? JSON.parse(text) : null;
			} catch (error) {
				console.error(`[royal-phone] fetch ${event} failed`, error);
				return null;
			}
		},

		/** Phone notification under this app's icon. { title, content?, duration?, sound?, route? } */
		notify(data) {
			if (!framed) return console.info('[royal-phone] notify', data);
			send('notify', data);
		},

		/** Back to the home screen. */
		close() {
			send('close');
		},

		/** Same as the phone's back gesture. */
		back() {
			send('back');
		},

		/** Open another app, e.g. openApp('messages', { number: '555-0134' }). */
		openApp(app, route) {
			send('openApp', { app, route });
		},
	};

	window.RoyalPhone = RoyalPhone;
})();
