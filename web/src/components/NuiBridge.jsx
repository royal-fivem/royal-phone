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
import { allAppIds } from '../config/apps';
import useCustomStore from '../state/customStore';

let layoutOwner = null;

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
		const owner = payload?.data?.sim ?? payload?.data?.number ?? null;

		if (owner && owner !== layoutOwner) {
			if (payload?.data?.layout) setLayout(payload.data.layout);
			layoutOwner = owner;
		}

		if (payload?.data) setData(payload.data);
		if (payload?.lifeinvader) setLifeinvaderData(payload.lifeinvader);
		if (payload?.documents) setDocumentsData(payload.documents);
		if (payload?.customApps) useCustomStore.getState().setApps(payload.customApps);

		const peekDuration = payload?.config?.peekDuration;

		if (peekDuration && peekDuration !== usePhoneStore.getState().settings.peekDuration) {
			usePhoneStore.getState().setSetting('peekDuration', peekDuration);
		}

		syncLayout(allAppIds());
	});

	useNuiEvent('refresh', (payload) => {
		if (!payload) return;

		if (payload.data) setData(payload.data);
		if (payload.lifeinvader) setLifeinvaderData(payload.lifeinvader);
		if (payload.documents) setDocumentsData(payload.documents);
	});

	useNuiEvent('openApp', (payload) => {
		if (!payload?.app) return;
		usePhoneStore.getState().openApp(payload.app, payload.props ?? null);
	});

	useNuiEvent('customApps', (list) => {
		useCustomStore.getState().setApps(list ?? []);
		syncLayout(allAppIds());
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

	// Tells Lua which app is on screen, for the royal-phone:appOpened /
	// royal-phone:appClosed events other resources listen to.
	useEffect(() => {
		if (isEnvBrowser()) return;

		return usePhoneStore.subscribe((state, previous) => {
			if (state.activeApp !== previous.activeApp) fetchNui('appChanged', { app: state.activeApp ?? null });
		});
	}, []);

	return children;
}
