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

		const phoneOpen = usePhoneStore.getState().open;

		setCall({
			...call,
			direction: 'in',
			state: 'incoming',

			minimized: !phoneOpen,
			expanded: !phoneOpen,
		});

		startLoop('ringtone');
	});

	useNuiEvent('callConnected', () => {
		stopLoop('ringtone');
		usePhoneStore.getState().connectCall();
	});

	useNuiEvent('answerCall', () => {
		stopLoop('ringtone');
		usePhoneStore.getState().connectCall();
	});

	useNuiEvent('callEnded', () => {
		stopLoop('ringtone');
		setCall(null);
	});

	useNuiEvent('cameraHud', (visible) => useCameraStore.setState({ hud: visible !== false }));

	useNuiEvent('cameraState', (data) => useCameraStore.getState().sync(data));

	useNuiEvent('lifeinvader', (payload) => payload && setLifeinvaderData(payload));

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

	useEffect(() => {
		if (isEnvBrowser()) return;
		fetchNui('ready');
	}, []);

	return children;
}
