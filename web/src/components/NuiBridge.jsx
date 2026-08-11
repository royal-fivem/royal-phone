import { useEffect } from 'react';

import useNuiEvent from '../utils/useNuiEvent';
import usePhoneStore from '../state/phoneStore';
import useDataStore from '../state/dataStore';
import useNotifyStore from '../state/notifyStore';
import useLifeinvaderStore from '../state/lifeinvaderStore';
import useDocumentsStore from '../state/documentsStore';
import useCameraStore from '../state/cameraStore';
import fetchNui from '../utils/fetchNui';
import isEnvBrowser from '../utils/isEnvBrowser';
import { playSound, startLoop, stopLoop } from '../utils/sound';
import { APP_IDS } from '../config/apps';

/**
 * Every message from Lua lands here. Nothing else in the tree talks to NUI, so
 * the wiring stays in one file.
 */
export default function NuiBridge({ children }) {
	const setOpen = usePhoneStore((s) => s.setOpen);
	const setClock = usePhoneStore((s) => s.setClock);
	const setLayout = usePhoneStore((s) => s.setLayout);
	const syncLayout = usePhoneStore((s) => s.syncLayout);
	const setCall = usePhoneStore((s) => s.setCall);

	const setData = useDataStore((s) => s.setData);
	const setLifeinvaderData = useLifeinvaderStore((s) => s.setData);
	const setDocumentsData = useDocumentsStore((s) => s.setData);
	const pushMessage = useDataStore((s) => s.pushMessage);
	const notify = useNotifyStore((s) => s.add);

	useNuiEvent('setOpen', (open) => setOpen(Boolean(open)));
	useNuiEvent('time', (clock) => clock && setClock(clock));

	useNuiEvent('bootstrap', (payload) => {
		if (payload?.data) setData(payload.data);
		if (payload?.lifeinvader) setLifeinvaderData(payload.lifeinvader);
		if (payload?.documents) setDocumentsData(payload.documents);
		if (payload?.config?.peekDuration) {
			usePhoneStore.getState().setSetting('peekDuration', payload.config.peekDuration);
		}
		syncLayout(APP_IDS);
	});

	/**
	 * The same payloads the bootstrap carries, pushed again while the phone is
	 * already open.
	 *
	 * The phone fetches once per open and never polls, so anything that happened
	 * to you — a contact shared, a document invite, a group you were added to —
	 * used to require closing and reopening. The server pushes whichever slice
	 * changed and the matching store swallows it.
	 */
	useNuiEvent('refresh', (payload) => {
		if (!payload) return;

		if (payload.data) setData(payload.data);
		if (payload.lifeinvader) setLifeinvaderData(payload.lifeinvader);
		if (payload.documents) setDocumentsData(payload.documents);
	});

	useNuiEvent('layout', (layout) => {
		if (!layout) return;
		setLayout(layout);
		syncLayout(APP_IDS);
	});

	useNuiEvent('notify', (data) => {
		if (usePhoneStore.getState().settings.dnd) return;
		notify(data || {});
	});

	useNuiEvent('newMessage', (message) => {
		if (!message) return;
		pushMessage({ ...message, read: 0 });
	});

	useNuiEvent('incomingCall', (call) => {
		if (!call) return;

		// Ringing straight into the card: with the phone pocketed it rises to
		// peek height showing answer/decline, rather than seizing the screen.
		const phoneOpen = usePhoneStore.getState().open;

		setCall({
			...call,
			direction: 'in',
			state: 'incoming',
			// Phone already open: ring full screen. Pocketed: ring in the card.
			minimized: !phoneOpen,
			expanded: !phoneOpen,
		});

		// Rings until it is answered, declined or the caller gives up — a one-shot
		// blip would be over before the player had reached for the phone.
		startLoop('ringtone');
	});

	// The pickup is confirmed by the server, which is also the moment both ends
	// join the voice channel — see client/main.lua.
	useNuiEvent('callConnected', () => {
		stopLoop('ringtone');
		usePhoneStore.getState().connectCall();
	});

	// Keyboard answer (the phone is pocketed and has no focus, so Lua handles the
	// keybind and tells us after the fact).
	useNuiEvent('answerCall', () => {
		stopLoop('ringtone');
		usePhoneStore.getState().connectCall();
	});

	useNuiEvent('callEnded', () => {
		stopLoop('ringtone');
		setCall(null);
	});

	// Lua hides the viewfinder's own chrome for the frame it captures, otherwise
	// the brackets and buttons end up in the photo.
	useNuiEvent('cameraHud', (visible) => useCameraStore.setState({ hud: visible !== false }));

	// The whole social payload, re-pushed when someone else posts or follows.
	useNuiEvent('lifeinvader', (payload) => payload && setLifeinvaderData(payload));

	// Escape mirrors the bottom button: back out one layer, then close.
	useEffect(() => {
		const onKey = (event) => {
			if (event.key !== 'Escape') return;
			if (!usePhoneStore.getState().open) return;

			event.preventDefault();
			usePhoneStore.getState().back();
		};

		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

	/**
	 * Report caret focus to Lua.
	 *
	 * The phone hands the keyboard back to the game so the player can walk around
	 * with it open, which means every keystroke reaches both. While a text box is
	 * focused Lua takes the keyboard back, so typing "was" into a message does not
	 * also send the ped walking. Uses focusin/focusout because they bubble —
	 * focus/blur do not, and the inputs are deep in the tree.
	 */
	useEffect(() => {
		if (isEnvBrowser()) return;

		const editable = (node) =>
			node instanceof HTMLElement &&
			(node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.isContentEditable);

		const onFocusIn = (event) => editable(event.target) && fetchNui('typing', { active: true });
		const onFocusOut = () => fetchNui('typing', { active: false });

		document.addEventListener('focusin', onFocusIn);
		document.addEventListener('focusout', onFocusOut);

		return () => {
			document.removeEventListener('focusin', onFocusIn);
			document.removeEventListener('focusout', onFocusOut);
		};
	}, []);

	// Tell Lua the frame is alive; until this lands the phone refuses to open.
	useEffect(() => {
		if (isEnvBrowser()) return;
		fetchNui('ready');
	}, []);

	return children;
}
